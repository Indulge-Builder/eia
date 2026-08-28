# Serene — Roadmap & Open Items (Claude Project digest)

> Digest of `docs/01-vision.md`, `docs/TODO.md`, `docs/audits/*`, and `docs/changelog.md` (through
> 2026-08-22). **This is the canonical built-vs-planned ledger for the pack** — when a feature's
> status matters, trust this file. The live record of change is `docs/changelog.md`; verify against
> the live DB before assuming a migration/table/RPC exists.

## Module status (as of 2026-08-24)

| Module | Status | "Done" means |
| ------ | ------ | ------------ |
| **Serene** (base OS) | ✅ LIVE | one login; the neumorphic design system (8 themes + light/dark/auto); 3-layer role/domain auth; dashboard shell; ⌘K palette; in-app + Web Push notifications with per-user channel mutes; tasks; OTP reset; PWA + per-user icon + branded boot. Stable; hardened through the audit cycle. |
| **Gia** (CRM) | ✅ LIVE, daily use | a lead travels ad → ingestion → fair assignment → worked dossier → resolution → deal without leaving the system, with SLA guardrails and role-correct reporting end-to-end. |
| **Elaya** (AI presence) | ✅ LIVE (Jarvis 1–4 + the customer channel) | provider-neutral brain; 12 read + 12 write tools; in-app SSE + WhatsApp staff channel + the `/m` screen; the outward customer welcome-blast persona; voice input; propose→confirm; per-user persona, learned memory, and Notes. *Remaining:* in-app proposal cards, semantic retrieval, TTS. |
| **Call Intelligence / Helpdesk** | ✅ LIVE (Phase 1) | service-interest taxonomy + `service_cases`/`conversation_hooks` + `/helpdesk` + the dossier card. *Phase 2 (embedding similarity / HNSW) deferred.* |
| **Lead Revival** | ✅ LIVE (R1) | a daily sweep finds silent leads, runs the note-AI gate, revives confident ones with a "Revived" task or sends borderline ones to a review tab — never touching the lead row. |
| **Oversight** | ✅ LIVE | manager+ three-tier drill over `task_events` + live presence. |
| **Mobile Ops** (`/m`) | ✅ LIVE | four real rooms on real reads + the Elaya knob on the real brain; admin/founder phones auto-open it. *Remaining:* agent room set, the tech-expense tracker card (a deliberate Coming-Soon placeholder). |
| **Subscriptions & Bills** | ✅ LIVE (Phase 1) | list/calendar/overview, payments + top-ups, private invoices, encrypted credentials with an audited reveal, per-tool spend. *By contract Phase 1 has no reminders, no WhatsApp, nothing background.* |
| **Client records** | 🔨 CURRENT FOCUS | a won deal opens a client record; relationship history continues post-win (`deals.client_id` is the reserved hook). Not built yet. |
| **Sia** (Concierge) | ⏸ NOT STARTED | the concierge team runs post-won client work inside Serene the way sales runs Gia. No scope defined. |

## What's live vs. what's written but not applied

Almost everything in the tree is live. Two known exceptions, both flagged in their changelog entries
as **"not yet applied — run `supabase db push`"**:

- **`20260710000161_business_minutes_response_time.sql`** — the `business_minutes_between()` helper
  and the six RPCs that call it. Until it is applied, response-time figures still include nights and
  Sundays. (Display units and RPC return shapes are unchanged either way, so the app compiles and
  runs regardless.)
- **`20260710000162_notifications_type_check_sync.sql`** — syncs the `notifications.type` CHECK with
  the full TS `NotificationType` union. Until applied, `sla_breach_agent/manager/founder`,
  `task_overdue_manager` and `suggestion_resolved` inserts fail silently.

**Verify both against the live DB before relying on them** — the repo cannot tell you what has been
pushed since, and migrations are sometimes applied out of band (0163–0168 were, during the
subscriptions merge). Confirmed applied and verified in the changelog: 0144–0158, 0159 + 0160
(pushed and verified 2026-07-06, including a one-time `supabase migration repair` that reconciled the
MCP-applied history with `db push`), and 0163–0168.

**One environment step is still outstanding for a shipped feature:**
`GUPSHUP_CUSTOMER_WELCOME_TEMPLATE_ID` must be set to a real approved Gupshup template id before the
customer welcome-blast sends anything. The code path exists and no-ops with a skip log until then;
creating and getting that template approved is a founder-side Gupshup step. Whether it has since been
set on Vercel is not verifiable from the repo.

## Next up

### 1. Client records (post-won flow) — the current focus

A won deal should open a client record; the relationship continues past "won". `deals.client_id` is
the reserved hook. Nothing is built. This is the prerequisite for Sia.

### 2. Sia (Concierge module) — after client records

The concierge team's post-won work, run inside Serene the way sales runs Gia. Scope undefined; see
`docs/modules/sia.md`. The `task_module` enum already carries a `sia` value.

### 3. DPDP Act 2023 / DPDP Rules 2025 — Phase 2 of the compliance roadmap

The largest known non-feature obligation. The substantive obligations for private Data Fiduciaries
(notice, security safeguards, breach intimation, retention, rights, cross-border) come into force
**~14 May 2027**. From the 2026-07-02 audit (`docs/audits/2026-07-02-dpdp-compliance-audit.md`):

- **What already holds up:** RLS everywhere, `requireProfile`, timing-safe webhook secrets,
  append-only write audits, `maskPii` before the LLM, in-memory-only audio, and now Vault-encrypted
  stored credentials with an audited reveal.
- **What is missing (the 11-item gap register G-01…G-11):** no consent/lawful-basis record at any
  ingestion point; no WhatsApp STOP/opt-out; no breach-notification workflow (72h Board clock);
  **erasure is structurally impossible** (no lead delete path, and ten append-only tables hold PII
  immutably, `lead_raw_payloads` forever); no DSR/grievance/nomination flow; no read-access logging
  (Rule 6(c)); no processor/DPA registry; hosting regions still `TODO: verify`.
- **Confirmed not applicable at current scale:** Third-Schedule erasure clocks, Consent-Manager
  registration, SDF duties.
- **Planned Phase 2:** a consent/lawful-basis + `do_not_contact` migration on `leads`, STOP-keyword
  handling in the WhatsApp webhook, and an anonymisation/erasure core.

### 4. Known smaller items

- **Subscriptions Phase 2** — renewal reminders and notifications. Deliberately excluded from
  Phase 1; the tables and the computed-status layer are ready for it.
- **Call Intelligence Phase 2** — embedding similarity over the dormant `embedding vector(1536)`
  column (no HNSW index yet).
- **Elaya semantic retrieval** — notes and learned memory load whole today; the swap starts from
  `getUserPersona`/`getNotesForElaya` (the `vector` extension is installed).
- **In-app proposal cards** — an SSE `proposal` frame + an Approve/Dismiss modal (audit M8).
- **WhatsApp closed-window template fallback** — re-opening an expired 24h session (audit H4b).
- **`get_usage` Elaya tool** — `getAgentUsage` is session-bound; it needs a sessionless twin first.
- **Voice replies / TTS (ElevenLabs)** — locked for a future phase; voice is input-only.
- **Mobile agent rooms** — manager/agent stay on the responsive `/dashboard` until their room sets
  ship; the `/m` Budget room's tech-expense card is a contract-specified placeholder.
- **`/error-log` replay** — failed webhook payloads are preserved but there is no replay action.
- **The orphaned `--z-veil` token** — the route veil was deliberately deleted and must never return;
  the token is dead and can be removed in a cleanup pass.

## Open Elaya audit items (still unfixed)

The Elaya subsystem is fundamentally healthy — **no critical or High-severity bugs remain** (the audit
doc removes resolved findings, so it lists only what's open). Remaining:

**Medium (enhancement, not defects):** M8 (no in-app proposal card) · H4b (no WhatsApp closed-window
template fallback).

**Low/nit cluster (~20 items), e.g.:**

- `get_performance_snapshot` lacks a domain arg for admin/founder on WhatsApp.
- `supersedePriorProposals` failure could leave two live proposals (a partial UNIQUE index would fix
  it structurally).
- `executeProposedAction` can leave a `proposed` row after the write succeeds (stamp at start).
- No "cancel" acknowledgement on a declined proposal — the injection-critical `classifyConfirmation`
  gate is deliberately binary, and adding a third verdict is deferred.
- `delete_task` lacks a before-snapshot (existence re-check only).
- No per-turn inline-write idempotency (a model double-emit could duplicate a note/task).
- Cross-channel confirmation (a "yes" on WhatsApp could confirm an in-app proposal) — document or
  compare channel.
- Token accounting ignores cache tokens; the `isError` flag isn't threaded into Anthropic `is_error`.
- The cap check is mildly TOCTOU (concurrent messages can exceed the soft cap by one).

**Founder preference:** when one of these is fixed, **delete it** from
`docs/audits/2026-06-25-elaya-full-audit.md` (don't annotate "resolved").

## Design items found and deliberately deferred

- **Quiet-text contrast, app-wide.** `--theme-text-tertiary` measures **2.14:1** and
  `--theme-text-secondary` **3.26:1** on plain paper — both under the 4.5:1 body bar. Fixing it is a
  product decision about how quiet Serene's quiet text may be, touching hundreds of surfaces. It was
  deliberately not bundled into the 2026-08-10 header-contrast fix.
- **Accent fills stop at ~2:1**, short of the 3:1 non-text-UI bar, because pushing to L≈0.62 would
  break the whisper-pastel identity. Recorded as a conscious ceiling, not an oversight.
- **A shadow-definition garnish** (`--neu-dark` → `158 148 130`, alphas +0.03) was audited and
  deferred pending review on the live app.
- **Three latent timezone-label bugs** (browser-local or Vercel-UTC labels for an IST business:
  `MyTasksCalendarView` weekday, `ConversationPanel` date groups, dashboard-service bucket labels)
  plus two formatter-normalisation choices were node-verified and **left**, because fixing any of
  them changes displayed output — a product decision, not a refactor.
- **The WhatsApp conversation-list Redis cache** stays deliberately un-cached: Realtime keeps the
  panel live and stale unread state is worse than one indexed read.

## Other known TODOs

- **Email deliverability (Brevo):** auth emails send via a custom Brevo SMTP but land in spam —
  `indulge.global` isn't fully authenticated in Brevo. Fix = add/authenticate the domain (DKIM + SPF)
  and match the Supabase "Sender email" to the verified sender. (`docs/TODO.md`.)
- **Trigger.dev prod worker:** SLA/task notifications only fire once the worker is deployed against
  the `tr_prod_` key (`npx trigger.dev@latest deploy` + swap `TRIGGER_SECRET_KEY`). The
  `/escalations` *surface* computes breaches live regardless; this is about the *alerts* firing.
- **Installed-PWA icon staleness:** home-screen icons and the OS splash are baked at install time, so
  devices installed before the 2026-07-10 cream re-plate keep the old black icon until the user
  re-adds the app.

## Per-module open product questions (from the page specs)

Small, known gaps that aren't bugs: archived leads are invisible to phone search (RLS bakes in
`archived_at IS NULL`); group accent/icon/member chips are UI-only (no DB columns); a duplicate active
resubmission doesn't re-ping the original agent; the subscriptions access model is
department-membership-wide (everyone with access sees every subscription — the `departments` array is
metadata, **not** a security boundary) and may need narrowing if the data gets more sensitive. These
live in the individual `docs/pages/*.md` and `docs/modules/*.md` specs.
