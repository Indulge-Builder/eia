/**
 * sia-silence.ts — the Sia watcher alarm (audit P0-2; heartbeat rework same day).
 *
 * Liveness is judged by the watcher's OWN pulse (sia.wag_watcher_status — one
 * row, beat every 60s, migration 0175), never by group traffic: groups sleep at
 * night, and a traffic-based alarm either cries wolf at 3am or reacts slowly by
 * day. With the heartbeat, "process down" and "session lost" are true positives
 * at any hour.
 *
 * Four conditions, most severe first (one alert per tick):
 *   down          — no heartbeat for 5+ min: the process is not running.
 *   session_lost  — WhatsApp logged the watcher out, or it has sat unpaired
 *                   15+ min: a HUMAN must enter a pairing code (RUNBOOK).
 *   unreachable   — process alive but stuck connecting 15+ min.
 *   quiet         — connected, but zero events for 6+ hours: worth a glance
 *                   (possible zombie connection). Soft by design — this is the
 *                   only traffic-based check, and its long window is what keeps
 *                   night-time silence from paging anyone.
 *
 * Per-kind Redis latches (55 min TTL) keep a long incident to ~hourly reminders;
 * full recovery clears every latch and announces once. Fan-out rides the
 * existing createNotification pipeline (in-app + Web Push) to admins + founders.
 */

import { schedules } from "@trigger.dev/sdk/v3";

const BEAT_STALE_MIN = 5;
const STUCK_STATE_MIN = 15;
const QUIET_HOURS = 6;
const LATCH_TTL_SECONDS = 55 * 60;

type AlertKind = "down" | "session_lost" | "unreachable" | "quiet";

export const siaSilenceWatchTask = schedules.task({
  id: "sia-silence-watch",
  cron: { pattern: "*/5 * * * *" },
  maxDuration: 60,
  run: async () => {
    // Dynamic imports — keep server-only modules out of the Trigger.dev module scan.
    const { getSiaWatcherStatus, getSiaLastEventAt } = await import("@/lib/services/sia-service");
    const { getAssignableUsers } = await import("@/lib/services/profiles-service");
    const { createNotification } = await import("@/lib/services/notifications-service");
    const { redis } = await import("@/lib/redis");
    const { REDIS_KEYS, SIA_ALERT_KINDS } = await import("@/lib/constants/redis-keys");

    const now = Date.now();
    const status = await getSiaWatcherStatus();
    const beatAgeMin = status ? (now - new Date(status.beat_at).getTime()) / 60_000 : Infinity;
    const stateForMin = status ? (now - new Date(status.state_since).getTime()) / 60_000 : Infinity;

    // ── Classify (most severe first; exactly one active condition) ──
    let kind: AlertKind | null = null;
    let title = "";
    let body = "";
    if (beatAgeMin > BEAT_STALE_MIN) {
      kind = "down";
      title = "Sia watcher is down";
      body = status
        ? `No heartbeat for ${Math.floor(beatAgeMin)} minutes — the capture process is not running. Check the Fargate service.`
        : "The watcher has never reported a heartbeat. Check the Fargate service.";
    } else if (
      status!.state === "logged_out" ||
      (status!.state === "pairing" && stateForMin > STUCK_STATE_MIN)
    ) {
      kind = "session_lost";
      title = "Sia session needs pairing";
      body =
        status!.state === "logged_out"
          ? "WhatsApp logged the watcher out. Someone must enter a fresh pairing code — see connector/RUNBOOK.md."
          : `The watcher has been waiting unpaired for ${Math.floor(stateForMin)} minutes. Enter a pairing code when ready — see connector/RUNBOOK.md.`;
    } else if (status!.state === "connecting" && stateForMin > STUCK_STATE_MIN) {
      kind = "unreachable";
      title = "Sia watcher can't reach WhatsApp";
      body = `The process is alive but has been stuck connecting for ${Math.floor(stateForMin)} minutes.`;
    } else if (status!.state === "connected") {
      const lastEventAt = await getSiaLastEventAt();
      const eventAgeHr = lastEventAt ? (now - new Date(lastEventAt).getTime()) / 3_600_000 : Infinity;
      if (eventAgeHr > QUIET_HOURS) {
        kind = "quiet";
        title = "Sia capture looks quiet";
        body = `Connected, but no group events for ${Math.floor(eventAgeHr)} hours. Worth a glance — could be a stale connection.`;
      }
    }

    const notifyAll = async (t: string, b: string) => {
      const recipients = await getAssignableUsers({ roles: ["admin", "founder"] });
      await Promise.all(
        recipients.map((r) =>
          createNotification({ recipient_id: r.id, type: "system", title: t, body: b, action_url: "/sia" }),
        ),
      );
      return recipients.length;
    };

    // ── Alert (latched per kind) ──
    if (kind) {
      const latchKey = REDIS_KEYS.siaAlert(kind);
      const latched = await redis.get(latchKey).catch(() => null);
      if (latched) return { state: kind, note: "already alerted" };
      const alerted = await notifyAll(title, body);
      try {
        await redis.setex(latchKey, LATCH_TTL_SECONDS, "1");
      } catch (e) {
        console.warn("[sia-alarm] latch set failed (may re-alert next tick):", e);
      }
      return { state: kind, alerted };
    }

    // ── Healthy: clear latches, announce recovery once ──
    const latchKeys = SIA_ALERT_KINDS.map((k) => REDIS_KEYS.siaAlert(k));
    const latchValues = await Promise.all(latchKeys.map((k) => redis.get(k).catch(() => null)));
    if (latchValues.some((v) => v !== null)) {
      await Promise.all(latchKeys.map((k) => redis.del(k).catch(() => {})));
      const alerted = await notifyAll("Sia watcher recovered", "Heartbeat and connection are healthy again.");
      return { state: "recovered", alerted };
    }
    return { state: "healthy", watcher: status!.state };
  },
});
