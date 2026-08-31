# Maintenance Ledger

The things that need doing on a clock, and the open items waiting for a hand.
This file exists so nobody has to remember them. If you finish one, tick it off
here in the same PR. If you find a new recurring duty, add it here, not in your
head.

This is NOT the product roadmap (that is `docs/01-vision.md`) and not the
changelog (that is `docs/changelog.md`). This is upkeep: the boring things that
break quietly if forgotten.

Last reviewed: 2026-08-29

---

## Date-driven duties (calendar clocks)

### 1. Add new month partitions for the Sia tables — BEFORE 1 March 2027

`sia.wag_messages` and `sia.wag_raw_events` are split into monthly partition
tables. Drawers exist for 2026-08 through 2027-03. After that, rows fall into
the `_default` catch-all. Nothing is lost, but the tables get slower over time.

Do this once a year (next batch covers 2027-04 through 2028-03). One migration:

```sql
-- repeat per month, both tables
CREATE TABLE sia.wag_messages_2027_04 PARTITION OF sia.wag_messages
  FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
CREATE TABLE sia.wag_raw_events_2027_04 PARTITION OF sia.wag_raw_events
  FOR VALUES FROM ('2027-04-01') TO ('2027-05-01');
```

Copy the pattern from migration `20260827000169_sia_wag_foundation.sql`.

### 2. The watcher phone must come online every ~2 weeks

WhatsApp unlinks companion devices when the primary phone stays offline too
long. Someone turns the watcher phone on, opens WhatsApp on Wi-Fi, done.
If it ever lapses, the alarm fires `session_lost` and the fix is the QR in
Serene → Sia → gear icon → Session.

### 3. Baileys v8 — do NOT upgrade casually

We run Baileys 7.0.0-rc14. Version 8 changes the auth-state format and needs
an offline migration of `sia.wag_auth_state` first; an unmigrated client
cannot connect at all. When v8 lands: read its migration guide, migrate the
auth table, then upgrade. Never just bump the package.

### 4. BRAIN_API_SECRET lives in FOUR places — they must move together

The Python brain's shared bearer exists in: `backend/.env` (local brain),
repo `.env.local` (local Next bridge), Vercel production env (prod bridge),
and SSM `/copilot/serene/prod/secrets/BRAIN_API_SECRET` (Fargate brain).
A drift between them makes the prod brain's writes silently 401 at the
bridge (it happened 2026-08-30 — SSM held an older value). Rotate all four
in one sitting, then force a new api deployment so the task re-reads SSM.

### 5. Trigger.dev CLI stays pinned to the SDK version

Deploy with `npx trigger.dev@4.4.6 deploy` (matches `@trigger.dev/sdk`).
A newer CLI refuses a mismatched project. If you upgrade the SDK, update the
pin everywhere it is written (RUNBOOK, this file).

---

## Open items (as of 2026-08-29)

- [ ] **Founder phone numbers missing.** Syndia, Andreas, and Advita have no
  phone on their profiles, so the Sia alarm's 1-hour WhatsApp escalation
  silently skips them (in-app + push still reach them). Add numbers on their
  profile pages.
- [ ] **Classify the ~466 Sia groups.** Serene → Sia → gear icon → Group
  mapping: mark each group client / vendor / internal, hide the noise.
  Manual work, can be done in passes.
- [ ] **Media backlog draining.** ~15.4k media rows were pending after the
  2026-08-29 full re-sync (fresh links, so recovery rates are good). Watch
  the counters in the Sia console. If it stalls or is too slow, the
  parallel-lanes speedup (3-4 concurrent downloads) is a known, approved
  next step — ask for it.
- [ ] **Regenerate database.ts types.** `supabase gen types typescript
  --linked` (splice above the hand-written appendix). Then remove the two
  interim casts in `src/lib/services/sia-service.ts` marked "retire at next
  regen" (migration 0177 columns).
- [ ] **Sia live-tail polish (candidate).** A reaction, edit, or delete on a
  message already on screen shows only after reopening the chat. Known pilot
  trade-off, not data loss. Improve when it starts to annoy.
- [ ] **Possible-ban alert (candidate).** A WhatsApp ban (disconnect code 403)
  currently surfaces as the generic `unreachable` alarm after 15 minutes.
  A distinct "possible ban - do not retry, investigate" alert would be
  clearer.

---

## Where the operational knowledge lives

| Topic | File |
| --- | --- |
| Watcher pairing, session SQL, number replacement, outage math | `connector/RUNBOOK.md` |
| The alarm conditions, cadence, escalation | `connector/RUNBOOK.md` (alarm section) + `src/trigger/sia-silence.ts` header |
| The full pipeline audit (2026-08-29) | `docs/changelog.md` entries of 2026-08-29 |
| Deploys (app, watcher, trigger tasks) | `docs/operations/deployment.md` |
