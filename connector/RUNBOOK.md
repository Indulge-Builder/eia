# Sia Watcher Runbook

The operational manual for the WhatsApp watcher. Written after the 2026-08-27 audit.
Keep this current: if a procedure here stops matching reality, fix the doc in the same PR.

## What runs where

- The watcher runs as ONE Fargate task: Copilot app `serene`, env `prod`, service `watcher` (ap-south-1).
- Session identity lives in Postgres: `sia.wag_auth_state` (migration 0174). No files, no volume.
- Media goes to S3 (the `sia-media` bucket addon). The app renders it through presigned URLs.
- Lifecycle is crash-only: any disconnect exits the process and ECS starts a fresh one.
  WhatsApp's offline queue redelivers whatever happened during the gap; the dedup wall
  makes every redelivery land exactly once.

## THE ONE LAW

**Exactly one runner may use the session at a time.** Two sockets on one session
put WhatsApp into a conflict loop and can log the number out.

Before running the connector locally (`npm start` in `connector/`):

```
copilot svc scale? No — use:
aws ecs update-service --cluster <serene-prod cluster> --service <watcher service> --desired-count 0 --region ap-south-1
```

And set it back to 1 when done. Never run both.

## Pairing (linking the WhatsApp number)

Pairing happens ONCE per session; deploys never re-pair (identity lives in
Postgres, so any machine resumes the same session).

THE flow is QR ON A LOCAL TERMINAL — the pairing-code flow is retired: our
crash-only restarts kill the socket a code is bound to (codes died before they
could be typed), and a failed code attempt persists a half-identity that
confuses the next boot. A local terminal renders the QR perfectly, and the
Postgres auth store makes "pair here, run there" free:

1. Scale the AWS service to 0 (THE ONE LAW above).
2. Wipe any leftover state: `DELETE FROM sia.wag_auth_state;`
3. On any machine with the repo: `cd connector && npm start` → scan the QR
   (WhatsApp → Linked Devices → Link a device).
4. Let the history sync finish locally (watch message counts settle — the
   sync is delivered around pairing time and may not resume if interrupted).
5. Ctrl+C the local connector, scale the AWS service back to 1. The task reads
   the same session from Postgres and simply resumes — no new pairing, no new
   device entry on the phone.

## Session inspection & reset (SQL)

```sql
-- Who is paired, and how much key material exists
SELECT key, octet_length(value::text) AS bytes, updated_at
FROM sia.wag_auth_state ORDER BY updated_at DESC LIMIT 5;

SELECT value->'me'->>'id' AS paired_as FROM sia.wag_auth_state WHERE key = 'creds';

-- Nuclear reset (forces a fresh pairing on next boot)
DELETE FROM sia.wag_auth_state;
```

The watcher also self-resets: on a WhatsApp `loggedOut` it wipes the state and exits,
so the next boot arms pairing automatically. A logged-out watcher never loops on a
dead login.

## The alarm (heartbeat-based — never traffic-based)

The watcher reports its own pulse: one row in `sia.wag_watcher_status`, beaten every
60 seconds with its connection state. Liveness NEVER depends on group traffic —
groups sleep at night, and a traffic-based alarm either cries wolf at 3am or gets
ignored. The /sia green dot reads the same row.

`src/trigger/sia-silence.ts` (Trigger.dev, every 5 min) alerts every active admin +
founder (in-app + push), most severe condition first:

| Condition | Meaning | Fires after |
| --- | --- | --- |
| `down` | no heartbeat — the process is not running | 5 min stale beat |
| `session_lost` | logged out by WhatsApp, or sitting unpaired | immediately on logout state; 15 min unpaired |
| `unreachable` | process alive, stuck connecting | 15 min |
| `quiet` | connected but zero events — possible stale socket | 6 hours (soft; the long window is the 3am protection) |

Each condition re-reminds roughly hourly (per-kind Redis latch, 55 min TTL); full
recovery clears everything and announces once. While deliberately unpaired, the
`session_lost` reminder is expected — it stops the moment pairing completes.

Deploying trigger tasks: `npx trigger.dev@4.4.6 deploy` from the repo root (pin the
CLI to the installed `@trigger.dev/sdk` version — a mismatched latest CLI refuses).

## Outage arithmetic (what downtime costs)

- Same-session restart (the normal case): WhatsApp redelivers offline messages on
  reconnect. Short-to-medium gaps lose nothing.
- Fresh pairing after a long gap: history sync brings the recent window per chat;
  everything replays through the dedup wall safely. The far tail beyond that window
  is the only thing at risk — which is why the silence alarm exists.

## Media

- Live media downloads immediately (concurrency 2, retries, dead-letter after 5).
- Historical/orphaned `pending` rows are drained by the in-process backfill drip
  (starts on every connect, ~1 item/1.5s, newest first): each row ends `done` or
  `expired` — nothing stays pending forever.
- Statuses: `pending → done | retrying → dead_letter | expired`.

## The number itself

- It must stay a **dedicated** number — never someone's daily phone.
- Enable WhatsApp **two-step verification (PIN)** on it (Settings → Account) — SIM-swap protection.
- The phone must come online at least every ~2 weeks (WhatsApp multi-device requirement).
- Accepted risk, in writing: Baileys is an unofficial client; a ban is possible and
  costs a SIM + group re-invites, never data (raw events are kept and replay clean).

## Known-empty by design

`sia.wag_receipts` stays empty: WhatsApp only sends read receipts for messages *you*
send, and the watcher never sends. Do not debug this.
