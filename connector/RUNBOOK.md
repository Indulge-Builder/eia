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
3. On any machine with the repo (ALWAYS with the bucket env — a run without it
   saves media to that machine's disk where the app can never reach it):
   `cd connector && WAG_MEDIA_BUCKET=serene-prod-watcher-addonsstack-1k9-siamediabucket-89fxizwajvaq npm start`
   → scan the QR (WhatsApp → Linked Devices → Link a device).
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

`src/trigger/sia-silence.ts` (Trigger.dev, EVERY MINUTE — dispatch latency ≤60s;
detection is instant at the source) alerts in-app + push + WhatsApp
(`sendSiaAlertNotification`, template `GUPSHUP_SIA_ALERT_TEMPLATE_ID`), most
severe condition first:

| Condition | Meaning | Fires after |
| --- | --- | --- |
| `down` | no heartbeat — the process is not running | 3 min stale beat |
| `session_lost` | logged out by WhatsApp, or sitting unpaired | ≤60s after logout state; 15 min unpaired |
| `unreachable` | process alive, stuck connecting | 15 min |
| `quiet` | connected but zero events — possible stale socket | 6 hours (soft; the long window is the 3am protection) |

Cadence + escalation (2026-08-29): first alert goes to ADMINS (the tech tier),
re-reminded every 10 minutes until resolved (per-kind Redis latch, 10 min TTL);
after 1 unresolved hour the FOUNDERS join the loop. Recovery announces once to
everyone who was alerted. Founder WhatsApp needs their profile phone set —
in-app + push reach them regardless. While deliberately unpaired, the
`session_lost` reminder is expected — it stops the moment pairing completes.
Session recovery without a terminal: Serene → Sia → gear icon → Session (the
pairing QR renders there; Restart / Re-pair buttons beside it).

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
- Historical/orphaned `pending` AND stranded `retrying` rows are drained by the
  in-process backfill drip (starts on every connect, 4 concurrent lanes,
  newest MESSAGE first): each row ends `done` or `expired` — nothing stays
  pending forever.
- Statuses: `pending → done | retrying → dead_letter | expired`.
  `dead_letter` = we hold no key material (orphan) or live retries exhausted;
  `expired` = WhatsApp refused re-upload (link gone for good).

## Replacing the number (blocked, banned, or SIM lost)

The DATA is never at risk — every captured message, media file, and raw event
stays in our database forever. Only the EAR needs replacing. Total downtime is
however long steps 1–4 take (typically under an hour once you have a SIM).

1. Get a fresh SIM and install WhatsApp on the dedicated watcher phone.
   Set two-step verification (PIN) immediately.
2. Scale the AWS service to 0, then `DELETE FROM sia.wag_auth_state;`
3. Pair the new number exactly like a first pairing (QR flow above).
4. Scale AWS back to 1.
5. **The real cost: group membership.** A new number is not in any group.
   A group admin (or the old number, if it still works) must re-add the
   watcher number to every group. Until a group re-adds it, that group is
   not captured. Track progress in /sia — re-added groups go live again
   the moment the first message arrives.
6. History: on pairing, WhatsApp delivers whatever history the NEW number
   can see (little, since it just joined the groups). The old archive is
   already in our DB; the dedup wall keeps the two eras from colliding.

What downtime loses: messages sent in a group while the watcher number was
not a member are NOT recoverable — WhatsApp only delivers history a member
is entitled to. This is the one true gap; everything else replays.

## The number itself

- It must stay a **dedicated** number — never someone's daily phone.
- Enable WhatsApp **two-step verification (PIN)** on it (Settings → Account) — SIM-swap protection.
- The phone must come online at least every ~2 weeks (WhatsApp multi-device requirement).
- Accepted risk, in writing: Baileys is an unofficial client; a ban is possible and
  costs a SIM + group re-invites, never data (raw events are kept and replay clean).

## Known-empty by design

`sia.wag_receipts` stays empty: WhatsApp only sends read receipts for messages *you*
send, and the watcher never sends. Do not debug this.
