# Serene — Data Model & RPCs (Claude Project digest)

> Digest of `docs/architecture/database.md`, `migrations.md`, `auth-and-rbac.md`, and the module
> specs — through migration file `0168` (2026-08-21), verified against `supabase/migrations/` on
> 2026-08-24. The raw schema dump is `docs/architecture/database_architecture.sql`. RLS posture and
> the two-tier RPC model are summarised here; the rules are in `6-engineering-rules.md`.

## Ground rules

- **Every table has RLS enabled** in its migration (A-08). Authorization reads only from
  `public.profiles` (A-01); RLS policies call `get_user_role()` / `get_user_domain()` (SECURITY
  DEFINER, `SET search_path = public`, wrapped `(SELECT …)`).
- **Two real Postgres enums:** `user_role` (founder/admin/manager/agent/guest), `app_domain` (9
  domains). Everything else called an "enum" is **text + CHECK**, mirrored in `src/lib/constants/` via
  `defineEnum()` (Q-02).
- **Append-only** log/activity tables (A-11). The documented UPDATE exceptions are listed in
  `6-engineering-rules.md`; the newest tables (`task_events`, `activity_events`, the three
  subscription history/audit tables) have **no write policy at all** — the admin client inside a
  gated server action is the only writer.
- **SECURITY DEFINER RPCs are two-tier (Q-13):** *self-scoped* keep `GRANT EXECUTE TO authenticated`;
  *scope-param* have EXECUTE revoked and run admin-client-only with session-derived args.
- **The "no user write RLS" posture** (introduced by `deals`, now used by subscriptions too) is
  deliberate: the `requireProfile` gate + route access + the admin client are the trust boundary,
  and SELECT policies still enforce who may *see* a row.

## Tables by domain

### Identity & access

- **`profiles`** — root of authorization. `role` (`user_role`), `domain` (`app_domain`), `is_active`,
  `theme` (8-key CHECK after 0154–0157), `appearance` (light/dark/system, 0158), `app_icon`
  (`icon-1..4`, 0121), `reports_to`, `job_title`, dormant `last_seen_at`. Created only by the
  `on_auth_user_created` trigger (which also copies `job_title` from invite metadata, 0125).
  Self-update permits cosmetic fields; `WITH CHECK` blocks self role/domain elevation. Moving a
  user's `domain` is the sanctioned round-robin pool lever.
- **`profile_audit_log`** — append-only, `ON DELETE RESTRICT`. Every role/domain/active change.
- **`agent_routing_config`** — round-robin pool switch (`is_active`) + shift windows/days. Auto-created
  for role `agent` **and** `manager` (0124). Advisory; read by ingestion + the SLA shift overrides.

### Leads (Gia)

- **`leads`** — lifecycle `new→touched→in_discussion→nurturing→won|lost|junk`. E.164 `phone`; flat
  `source`/`medium`/`utm_campaign` + immutable `attribution jsonb` (`{}` minimum, never NULL);
  `assigned_to`; `resolution_reason` (lost/junk); `archived_at` soft-delete; `previous_lead_id` dedup
  chain; trigger-generated immutable `slug` (`priya-sharma-9182`; the lower()-before-strip bug was
  fixed in 0147); `search_text` STORED column + trigram index; `service_interests text[]` (0109,
  never an enum); `last_call_outcome` + `last_call_outcome_at` (0112); `last_activity_at`;
  `welcomed_at` (0151 — the customer-Elaya one-blast-per-lead flag; bulk imports stamp it so an old
  contact can never be welcomed).
- **`lead_activities`** / **`lead_notes`** — append-only ledgers (notes are team-visible; call notes
  carry `call_outcome`).
- **`lead_raw_payloads`** — immutable webhook log incl. failures; **full PII** by recorded decision,
  admin/founder SELECT only → `/error-log`. Written before auth so rejects leave a trace.
- **`lead_sla_timers`** — service-role only; the SLA engine's timer state.

### Tasks

- **`tasks`** — one table. `task_category` ∈ `personal`/`group_subtask`; `task_module` enum
  (gia/sia/core); status `to_do/in_progress/in_review/completed/error/cancelled`; priority
  urgent/high/normal; checklist in `attachments jsonb`; `tags text[]`; `overdue_at` (0113, stamped
  once by the overdue job). Lead follow-ups are a `personal` task + a **`task_gia_meta`** link row
  (the meta row IS the link since 0138; `create_lead_gia_task` is the single writer of both).
- **`task_groups`** — flat visibility (creator OR assigned a subtask).
- **`task_remarks`** — append-only narrative; `status_change` CHECK coupled to `tasks.status`; one
  narrow admin/founder suppression UPDATE exception.
- **`task_audit_log`** — append-only, 6 fields, CASCADE on task delete.
- **`task_gia_meta`** — task↔lead link + `call_outcome`.
- **`task_events`** (0144) — **append-only** oversight stream. `task_event_type` enum
  (created/status_changed/reassigned/remark_added/overdue), `domain app_domain NOT NULL`,
  `actor_id`/`subject_id`, `task_title` snapshot, `meta jsonb`, FK→tasks CASCADE. manager+ SELECT,
  **no INSERT/UPDATE/DELETE policy ever**; Realtime enabled; written only by the task-mutation cores
  and the overdue job, via the admin client.

### Activity (the mobile feed)

- **`activity_events`** (0159) — append-only, cloned from `task_events`: domain-stamped,
  `(domain, created_at DESC)` + subject indexes, RLS (admin/founder all · manager own domain · agent
  own actions), **no write policies ever**, Realtime published, seeded with a 30-day backfill from
  `lead_activities` + `task_events` + `deals`. **Emission rule:** lead/deal mutation cores emit
  directly (`addLeadNoteCore`, `addLeadCallNoteCore`, `createLeadTaskCore`, `updateLeadStatusCore`,
  `assignLeadCore`, `recordDealCore`, `createWalkInDeal`); **task rows are DERIVED inside
  `emitTaskEvent`** (created → `task_created`, status→completed → `task_completed`) so task writes
  are never double-sourced. Never emit from an action or the UI.

### WhatsApp

- **`whatsapp_conversations`** — one per phone/lead; `wa_id` + `lead_id` UNIQUE; Realtime.
  `bot_active` is now live for the customer channel.
- **`whatsapp_messages`** — append-only except the delivery-receipt status UPDATE; partial-unique
  `wa_message_id`; Realtime; supports inbound/outbound media (durably copied into a private bucket,
  0141). `is_bot` marks customer-Elaya turns.
- **`whatsapp_conversation_reads`** — per-user read position (UPSERT).
- **`whatsapp_notification_logs`** — one row per template-send attempt; **last-4 phone digits only**;
  `delivered` = `res.ok` AND body not `{status:'error'}`; admin/founder SELECT only. Log types
  extended by 0142 (task agent reminders) and 0153 (`task_assigned`).

### Commerce / finance

- **`deals`** (first-class since 0072) — `lead_id` nullable (= walk-in); **`deal_type` is
  domain-derived** via `DOMAIN_DEAL_CONFIG` (onboarding→membership needs duration; shop→retail needs
  `deal_category`; house/legacy→sale), set server-side, with 0122 CHECKs coupling retail⇔category;
  `won_at` immutable; `source`. **No write RLS by design.** `client_id` reserved for the clients
  module.
- **`ad_creatives`** — campaign videos keyed by `campaign_key` string-match to `leads.utm_campaign`
  (no FK; multiple per campaign).
- **`ad_spend_daily`** (0104) — day-grain Meta spend; `UNIQUE(campaign_key, spend_date, source)`; RLS
  manager+ read. Zero-spend days are ingested (so a month-to-date re-upload fully overrides).
- **`ad_account_recharges`** (0139) — per-account recharge ledger; manager+ read / admin/founder write;
  `method` is a payment-method label (card-PAN-rejected at Zod + DB CHECK). Balance is INR-only.
- **`domain_targets`** (0105) — founder monthly deals-closed targets.

### Subscriptions & bills (0163–0168) — the newest module

- **`subscriptions`** (0163) — the parent. `name`; `departments text[]` (multi-select over
  `app_domain`, `<@` CHECK mirroring `APP_DOMAINS` — **no new enum**); `type`
  (monthly/yearly/top_up/other); `currency` (INR/USD/EUR); `amount`; and a **due-date shape enforced
  by CHECK**: monthly/other → `due_day` (1–31), yearly → `due_date`, top_up → neither. Plus
  `login`/`password`, `notes`, `is_archived` (soft delete), `created_by`, timestamps, and
  `tool_id` (0168). SELECT = admin/founder OR a finance/tech member; no write RLS. The same
  migration provisions the **private `subscription-invoices` bucket** (insert-own-prefix + staff
  read; rows store the storage **path**, reads mint signed URLs).
- **`subscription_payments`** (0164) — append-only payment history: `due_date`, `paid_at`, `rate` in
  the original currency, **`paid_amount_inr` (manual)**, `invoice_path`, `notes`. RLS SELECT mirrors
  the parent.
- **`subscription_topups`** (0165) — append-only top-up history, same shape and RLS.
- **Password encryption** (0166) — pgcrypto `pgp_sym_encrypt` (→ base64) with a 256-bit key generated
  at migration-run time and stored in **Supabase Vault** (`subscription_password_key`); the key never
  appears in the migration file and never leaves the DB. `encrypt_subscription_password()` /
  `decrypt_subscription_password()` are SECURITY DEFINER, **service_role only**. A
  `BEFORE INSERT/UPDATE` trigger encrypts on write and re-encrypts on UPDATE **only when the value
  changed** (`IS DISTINCT FROM OLD` — never double-encrypts). Requires the `pgcrypto` +
  `supabase_vault` extensions. `login` stays plaintext (a username).
- **`subscription_password_reveals`** (0167) — append-only reveal audit (who, which subscription,
  when). Written by the admin client **before** the plaintext is returned; the action fails closed if
  the insert fails. SELECT admin/founder only.
- **`subscription_tools`** + `subscriptions.tool_id` (0168) — the tool entity for "one tool, many
  accounts" (Claude: 2 tech accounts + 1 concierge). `name_key = lower(trim(name))` is the dedup
  identity; tools are created implicitly from the optional Tool field on the form; `tool_id` is
  nullable so a standalone bill needs no tool.

**Two invariants:** currency is **never auto-converted** (all analytics use the manually entered
`paid_amount_inr`; the original-currency figures are stored alongside), and **status is computed,
never stored** (`utils/subscription-status.ts`, IST-anchored — including the calendar's recurrence
projection and per-occurrence status).

### Notifications

- **`notifications`** — typed CHECK (synced to the full TS `NotificationType` union by 0162 — before
  that, `sla_breach_*`, `task_overdue_manager` and `suggestion_resolved` inserts were silently
  failing); `action_url` relative-only; Realtime → bell badge.
- **`push_subscriptions`** (0120) — one row per device (`endpoint` UNIQUE); owner-only RLS, **no
  UPDATE**; cross-user read + 404/410 dead-endpoint prune run service-role.
- **`notification_preferences`** (0133) — per-user × category × channel (`in_app`/`whatsapp`) mutes,
  sparse rows; **absence = ON, the gate fails OPEN**. Transactional types
  (`lead_initiation`/`elaya_reply`) have no key and are never silenceable.

### Call Intelligence

- **`service_cases`** + **`conversation_hooks`** (0110) — RLS all-authenticated read / admin+founder
  write; weighted FTS + tags GIN; dormant `embedding vector(1536)` (no HNSW yet). Power `/helpdesk` +
  the dossier `ServiceInterestCard`; served as a Redis 1hr `{cases,hooks}` envelope.

### SLA / Revival

- **`sla_policies`** (0111) — the SLA rules as data (trigger_kind status/outcome/task_due, threshold,
  recipient_role, auto_task, channels, hours_mode, active); admin/founder SELECT, service-role writes;
  read per run. Seeded with the 8 status rules + the CAD cadence + TASK task-due families.
- **`revival_policies`** (0119) — per-status silence thresholds + daily cap.
- **`revival_candidates`** (0119) — `open→actioned|dismissed` ledger; verdict revive/unsure/dismiss;
  denormalised `assigned_to` for the daily-cap count; partial UNIQUE `(lead_id) WHERE status='open'`.
  Never mutates the leads row.

### Usage (adoption)

- **`usage_heartbeats`** (0126) — raw append-only tick log (30-day prune); only the snapshot job
  writes it (the request path never writes the DB — the hot path is one Redis SET).
- **`usage_daily`** (0126) — the rollup the dashboard reads; PK `(day, user_id, domain)`; idempotent
  UPSERT (recompute-and-overwrite, never increment); never pruned.

### Suggestions

- **`suggestions`** (0134) — staff suggestion/bug triage (message + ≤4 screenshot **paths**, never
  URLs); open→resolved lifecycle, so exactly ONE narrow admin/founder UPDATE policy; no DELETE policy
  ever. Private **`suggestions`** Storage bucket (0135); `suggestion_resolved` notification type
  (0136).

### AI / Elaya

- **`elaya_conversations`** + **`elaya_messages`** (0116) — append-only; `channel` column (in_app /
  whatsapp); one active session per user across channels; `sender_id` denormalised for the cap count;
  WhatsApp dedup via a partial UNIQUE on `meta->>'wa_message_id'` (0148).
- **`user_context`** (0116) — per-user memory; `context.persona` (user-set) + `context.learned`
  (Elaya-written); RLS read-own, service-role write.
- **`elaya_notes`** (0152) — the per-user Notes section (`/notes`) Elaya reads as context. Private to
  the author.
- **`elaya_training_assets`** (0150) — the curated customer knowledge base behind
  `/admin/elaya-training`: videos, brochures, images, docs, URLs, company facts. Admin/founder write.
- **Customer welcome blast** (0151) — the `leads.welcomed_at` flag + supporting columns for the
  outward channel.
- **`elaya_actions`** (0118) — the write-proposal **state-machine** ledger
  (`proposed→executed|failed|dismissed`); before/after snapshots; partial index on `status='proposed'`;
  the proposed→terminal flip is a service-role admin-client UPDATE (an A-11 carve-out).
- **`llm_providers`** + **`elaya_settings`** (0116) — provider config (`routing`→Haiku,
  `reasoning`→Sonnet) + PII depth / daily cap / session hours; read **per request**, never cached.

## Storage buckets

| Bucket | Read | Write |
| ------ | ---- | ----- |
| `avatars` | public | own row |
| `ad-creatives` | public | admin/founder |
| `suggestions` | **private** (signed URLs only) | own-prefix insert |
| `subscription-invoices` (0163) | **private** (signed URLs only) | own-prefix insert (`{uid}/`) |
| WhatsApp inbound media (0141) | private | server (ingestion copies from the Gupshup CDN) |

## Load-bearing RPCs (selected)

- **Ingestion / leads:** `get_next_round_robin_agent` (SELECT FOR UPDATE SKIP LOCKED;
  `role IN ('agent','manager')` since 0124) · `get_active_lead_by_phone` · `update_lead_status` ·
  `add_lead_call_note` · `get_leads_status_counts` (**v4**, `20260807000161` — the agent branch now
  honours `p_domain` as an additive AND, so the pills can't drift from the table) ·
  `generate_lead_slug` (fixed 0147) · `lead_phone_key` + the active-phone partial UNIQUE index (0137).
- **Dashboard / performance:** `get_dashboard_summary` · `get_agent_performance` /
  `get_agent_roster_performance` · `get_agent_today_pulse` · `get_agent_performance_trend` (0146) ·
  `get_agent_first_touch_pairs` (0123) · `get_recent_lead_activity` (0132) ·
  **`business_minutes_between()`** (`20260710000161`) — the shared 09:00–19:00 IST, Mon–Sat elapsed
  helper every response-time metric now uses.
- **Deals / budget:** `get_deals_summary` · `get_budget_summary` (0106) · the domain-health
  total_deals aggregate (0107).
- **Oversight (0144, scope-param, admin-client only):** `get_team_task_overview` ·
  `get_team_agent_breakdown` · `get_agent_tasks_oversight`.
- **Mobile (0160, scope-param):** `get_domain_task_summary(p_domain, p_from, p_to)` — per-assignee
  created/completed (period) + open/overdue (live), with the domain derived
  `COALESCE(task_groups.domain, assignee profiles.domain)` (the `resolveTaskDomain` rule, in SQL).
- **Revival:** `get_silent_leads_for_revival` (0128, pushes the judge-once anti-join into SQL).
- **Tasks:** `get_personal_tasks` (0145 widened to carry the linked lead's identity) ·
  `get_group_task_summaries` · `add_task_remark_with_status`.
- **Elaya sessionless twins (0149, scope-param, admin-client only):**
  `get_group_task_summaries_for_user` · `get_agent_today_pulse_for_user` ·
  `get_agent_roster_performance_for_elaya`.
- **Subscriptions (0166):** `encrypt_subscription_password` / `decrypt_subscription_password`
  (SECURITY DEFINER, service_role only — EXECUTE revoked from `authenticated`).
- **Usage:** `get_agent_usage` (0126).

## Migration numbering reality (don't be surprised)

- The migration ledger was **repaired 2026-06-12** (0001–0064 recorded; 0065–0108 catalog-verified
  and recorded) and **repaired again 2026-07-06** when `supabase db push` first met the MCP-applied
  history: 14 orphan MCP version stamps were reverted and local versions 0138–0153 marked applied
  (their DDL was already live — verified by sentinel objects before repairing). After that repair
  `db push` and the MCP flow are reconciled.
- **There are two `0161` files** — `20260710000161_business_minutes_response_time.sql` and
  `20260807000161_status_counts_agent_domain.sql`. The full timestamped filename is the version, so
  they don't collide, but "migration 0161" is ambiguous in prose. Always cite the full filename when
  it matters.
- The docs index in `migrations.md` **jumps 0137 → 0144** (0138–0143 shipped but were never
  back-added to that docs-side index; the `supabase/migrations/CLAUDE.md` inventory + the SQL files
  are truth).
- **Applied-vs-written is a real distinction.** Confirmed applied and verified: 0154–0158 (themes +
  appearance), 0159 + 0160 (activity events + the mobile task summary, pushed and verified
  2026-07-06 with 1,584 backfilled rows), 0163–0168 (subscriptions — applied out of band during the
  PR merge). The changelog flags **`20260710000161` (business minutes) and 0162 (the notifications
  CHECK sync) as "not yet applied — run `supabase db push`"** at the time of writing; **verify both
  against the live DB before relying on them.** Never assume a table/column/RPC exists from a file
  on disk.
- `lead_health` is **fully removed** (0084) — any reference anywhere is stale. (Unrelated: *Domain
  Health* — `getDomainHealthMetrics` — is a separate live feature.)
- `src/lib/types/database.ts` was regenerated from the live schema on 2026-07-02 and again on
  2026-08-22 (to pick up the subscription tables). It carries a hand-written "Derived type aliases"
  appendix below the generated block — the app imports `Profile`/`Lead`/`Task` from there, and a
  regen must splice **above** it, leaving the appendix byte-identical.
