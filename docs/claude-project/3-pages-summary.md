# Serene — Pages Summary (Claude Project digest)

> Digest of the per-route specs in `docs/pages/` (23 specs) verified against the live tree
> 2026-08-24. Each spec's "Deep dive" holds the full invariant lists — attach the individual
> `docs/pages/<route>.md` for page-level work. The `/m` mobile rooms are covered in
> `11-mobile-and-pwa.md`, not here.

All list pages follow the canonical layout: `<h1 class="type-page-title">Title<span
class="page-title-dot">.</span></h1>` + top-right CTA → paper filter strip (`<FilterBar>`) →
Suspense-wrapped async content. Loading files compose `PageSkeletons`; empty states compose
`<EmptyState>` (Playfair italic, never "No data available"). Detail pages get a back link, no
title-dot.

**Shared chrome added since 2026-07-03 (present on every page):** the ⌘K **command palette**
(`CommandPaletteProvider`, mounted once in the dashboard layout — Actions · live lead/deal/task
search via `paletteSearchAction` · Go-to filtered by `canAccessRoute`), the layout-mounted
**`NotificationsProvider`** (bell state + one Realtime subscription that survives navigation), the
**`AppBootScreen`** (once per hard load), and **`CondensingPageHeader`** on Leads / Deals / Tasks /
Notes / Budget (paint-only condensing: background + blur + hairline, never a layout animation).
There is **no route veil** — it was deleted in the 2026-07-03 motion calm-down and must never
return; navigation feedback is each route's `loading.tsx`.

## /dashboard

Personalised **spatial bento grid** (react-grid-layout) of independently code-split widgets. Registry
`dashboard-widgets.ts`: agent widgets (`agent-tasks`, `agent-activity`, `agent-pending-calls`,
`agent-new-leads`, `elaya-presence`), manager cohort (`manager-lead-status`, `manager-lead-volume`,
`manager-campaigns`, `manager-cold-leads`, `manager-budget`). One server-side `get_dashboard_summary`
RPC (React `cache()`) seeds first paint; a global URL date filter scopes pipeline/campaign/volume by
`leads.created_at` (IST); snapshot counts (pending calls / new leads / going cold) are live and ignore
the date filter. Domain scope is a **single global selector** (`resolveDomainParam`; default =
all-domains aggregated) — per-widget domain tabs were removed 2026-06-17. Layout persists per user in
localStorage (`useDashboardLayout`, versioned key); widgets support drag-to-resize and an Add-widget
menu.

Since 2026-07-10: below 768px the canvas collapses to a **derived, read-only single column** built at
render time from the stored desktop placements (per-widget `mobileH`) — that `xs` layout is never
persisted, so a phone visit can't clobber the saved desktop layout, and edit mode is disabled there.
`.serene-dashboard-grid` caps at `max-width: 1760px` so 12 fluid columns don't stretch on ultrawide.
`manager-budget` is now **manager+**: managers get `scope:'domain'` (their domain's spend total +
campaigns + CPL, no gauge arc — recharges carry no domain, so scoping them would misstate finance);
admin/founder keep `scope:'org'`, the ad-account fuel gauge. KPI heroes animate via `AnimatedNumber`.
An admin/founder on a **mobile browser** landing bare on `/dashboard` is redirected to `/m` (see
`11-mobile-and-pwa.md`). Page never throws on RPC failure — renders zeroed data.

## /elaya

In-app chat with Elaya, the AI presence (all roles, `ALWAYS_ALLOWED_PREFIXES`; access is gated
per-principal in the tool layer, not the route). RSC seeds the 24h server-side conversation window +
last-50 transcript + remaining daily budget (deterministic greeting, no model call on load) via the
shared `resolveElayaChatSeed(profile)` helper — THE single source of `ElayaChatShell`'s props.
`ElayaChatShell` POSTs to `/api/elaya/chat` and pumps **`streamElayaChat()`** (`components/elaya/
elaya-stream.ts`) — THE one SSE transport; the mobile `/m/elaya` screen pumps the same one, never a
fork. **Second entry point:** a floating bottom-right `ElayaWidget` (mounted in the dashboard layout,
hidden on `/elaya`) opens a modal with the same shell, seeded via `getElayaChatSeedAction()`.
**Tools:** 12 read + 12 write, all role-gated (full list + the propose→confirm model in
`5-elaya-jarvis.md`). **Voice input** via `DictationButton` (Deepgram Nova-2, Hinglish) → editable
draft, never auto-send. **Per-user persona** ("how Elaya talks to me") edited from `/profile`, plus
durable learned memory and the `/notes` section she reads. Assistant text renders through
`<ChatMarkdown>` (no `dangerouslySetInnerHTML`). Daily cap **200/day** from IST midnight, **shared
across channels**, enforced server-side. Layout: `serene-dossier-grid--340` (chat card + breathing
glyph identity sidebar). Never render Elaya data without a tool round-trip.

## /leads (list)

The Gia pipeline list — display-only dense table; filters/search/pagination are server-side URL
params. `getLeadsByRole` (Redis 30s, version-counter invalidation); search via the `leads.search_text`
trigram column; status-count pills via `get_leads_status_counts`. Column visibility/order per user
(`useLeadColumnPreferences`, localStorage). `AddLeadButton` + on-intent `AddLeadModal`; bulk-edit from
table selection; CSV/XLSX export is **client-side only** (`lib/utils/export.ts`). Page size 30. The
toolbar always shows the filtered total ("7 leads" via `formatCount`), and the table card sits on the
lifted `--neu-surface-high` + `--neu-shadow-raised` pairing so it floats off the shell paper.

Since 2026-08-07 the **Domain filter is open to agents** as *additive narrowing*: an agent reads the
`?domain=` param only (never the `serene-domain` cookie), and `getLeadsByRole` composes it as an extra
`AND domain = X` **on top of** the unconditional `assigned_to = userId` — a crafted param can never
widen scope. `getLeadsForExport` and `get_leads_status_counts` (v4, migration `20260807000161`) mirror
the same predicate so the pills, the total, the table and the export always agree.

**Revival review tab** (`?revival=true`): the same `LeadsTable`, scoped to leads with an open
`revival_candidates` row, under a `RevivalReviewBanner`; each row carries a `ReviveLeadButton`.
Revival never mutates the lead status/columns.

## /leads/[id] (dossier)

The per-lead workspace. Slug-first lookup (UUID fallback). Wave-1 blocking fetch for header + status
panel only; everything else streamed behind per-section Suspense; streamed children fetch by `lead.id`
UUID, never the URL param. Components: `StatusActionPanel` (lifecycle CTAs +
`CalledModal`/`WonDealModal`/resolution confirms), `LeadInfoCard` (inline field edits), notes input +
timeline, `LeadDealCard`, `LeadWhatsAppCard` (can initiate via the `lead_initiation` template),
`LeadTasksCard`, `ServiceInterestCard` (Call Intelligence, capped at 300px with internal scroll). All
seven cards compose `<CardHeader>` — the themed header strip on `--neu-header-wash` with
`--neu-header-ink` text and `--neu-header-icon` glyphs (never `--theme-accent` on the wash: measured
1.6–2.0:1). Won flow: `recordDeal` inserts the `deals` row **before** the status flip and returns the
`dealId`, which `StatusActionPanel` stamps into sessionStorage so the petal celebration fires once on
`/deals`. The 1280px width cap was removed 2026-07-02 — the dossier is full-width like its sibling
detail pages. No access → `redirect('/leads')`. **Voice dictation** in note inputs; audio never stored.

## /deals

Every closed transaction (lead-won + walk-in). `getDealsByRole`, summary strip via `get_deals_summary`
(`StatTile` cells, values in the mono number font since 2026-07-06), card-list mode (`DealCard` motion
cards showing domain + source + walk-in pill; gold `PetalFall` plays once on arrival after a win).
Two write paths: `recordDeal` (dossier) and `createWalkInDeal` (`lead_id = null`, domain-locked
server-side for agents); both `revalidatePath('/deals')`. `deal_type` is domain-derived
(`DOMAIN_DEAL_CONFIG`), never client-picked; `won_at` immutable; membership deals need duration,
retail needs category. The in-page Domain dropdown was dropped 2026-07-10 — the global
`DomainSelector` is the single domain control (the bar reads the param read-only for the shop-slice
Category dropdown). Cold landing **defaults to This Month**. Agents own / managers domain /
admin+founder all.

## /tasks and /tasks/[id]

Tabbed hub: **Gia tab** (lead-linked follow-ups), **My Tasks** (personal, calendar view that
auto-loads the whole active schedule), **Group Tasks** (cards → `/tasks/[id]` group workspace with
list/board + Realtime). One `tasks` table; lead follow-up = a personal task + a `task_gia_meta` link
row (the meta row IS the link since 0138); status changes ride append-only `task_remarks`. Group
visibility is data-driven (creator OR assigned a subtask — no role/domain branching). Create modals
all compose `TaskFormFields`; `SubTaskModal` is two-zone with `TaskRemarksPanel` +
`AssigneePickerModal` and its checklist uses `<CheckTile>` (inset well ↔ accent-gradient flip + check
draw + one ring pulse). My-Tasks rows show the linked lead's name ("Call · Sonu Singh"). Task lists
compose the shared `<MotionRow>` choreography inside `<AnimatePresence>`.

**Deletes are undo-first since 2026-07-10:** a single task/subtask delete removes the row
optimistically and shows `toast.undo` (accent depletion bar); the actual `deleteTaskAction` fires on
the toast timeout, owned by the layout-mounted `ToastProvider` so it still commits if the user
navigates away. The destructive **group** delete (cascades subtasks) keeps `ConfirmDialog`.
Clicking a dotted past day in the calendar filters the overdue bucket to that day. Due reminders via
Trigger.dev (cancel-before-delete); a task assigned to someone else also fires a WhatsApp
"assigned to you" template.

## /subscriptions

**New (2026-08-06, Phase 1).** The Finance + Tech tracker for recurring bills, memberships, and
prepaid (top-up) accounts. Route access = the `finance` + `tech` domains in `DOMAIN_ROUTE_MAP`;
admin/founder bypass. Three `?view=` toggles:

- **List** — dense table + mobile cards, Active/Archived tabs, Department/Type/Status filters,
  computed status pills (Upcoming / Due Today / Overdue *N*d / Paid). Status is **computed, never
  stored** (`utils/subscription-status.ts`, IST-anchored).
- **Calendar** — a month grid that **projects recurrence**: `occurrenceInMonthISO(sub, year, month)`
  puts a monthly bill on its `due_day` in *every* month and a yearly one on its date each year
  (top-ups never recur). Each projected occurrence gets a truthful pill from `paidCycleKeys` (the
  settled cycles computed from payment history), and occurrences before `created_at` are never
  projected — no phantom overdue history. The shared `<Calendar>` gained an additive
  `onMonthChange(year, month)` for this.
- **Overview** — INR month/year totals, By Type / By Department / **By Tool** breakdowns, and a
  trailing 12-month trend. `OverviewFilters` composes the shared `FilterBar` (Range presets + From/To
  and Department), URL-driven (`department`, `date_from`, `date_to`). A department filter counts only
  the **attributable share** of shared bills (equal split); a date range scopes the tiles and the
  breakdowns but the trend stays a trailing window.

Writes: Add/Edit modal (Departments is the canonical multi-select `FilterDropdown`), Record Payment,
Log Top-up (client-side invoice upload to the **private** `subscription-invoices` bucket), archive,
per-subscription history, and a monthly CSV/XLSX export. The top-right **Add Subscription** button is
a two-item menu — *New* (create) and *Renewal* (a searchable picker of active subscriptions that
routes to Record Payment or Log Top-up by `type`).

**Two invariants worth memorising:** currency is **never auto-converted** — `paid_amount_inr` is the
manually entered INR and all analytics use it, with the original-currency `rate`/`amount` stored
separately; and the `password` column is **pgcrypto-encrypted with a Supabase Vault key**, never
selected into list/detail payloads, produced only by `revealSubscriptionPasswordAction`, which writes
an append-only `subscription_password_reveals` audit row first and fails closed if that insert fails.
The password field is tri-state in Zod: `undefined` = keep, `null` = clear, string = replace.

## /notes

**New (2026-06-26).** Per-user free-form notes that Elaya reads as **context, never permission**
(`elaya_notes`, migration 0152; the brain folds them in via `buildNotesPromptBlock`, which emits zero
bytes for a user with no notes so the shared prompt cache prefix is preserved). Notes are private to
their author. The list composes `<MotionRow>`; delete is optimistic + `toast.undo` (no
ConfirmDialog); the first-note empty state is the `brand` `<EmptyState>` composition (centred mandala
watermark + Playfair italic + one action, Elaya named).

## /oversight

Manager+ "what is my team doing right now, and where is work stuck?" — a read surface over task data
plus the append-only `task_events` stream (0144). Three tiers, one `card → open` grammar:
**Tier 1 Teams** (founder/admin) — one card per `app_domain` with open/overdue/completed counts +
agent count + a live "present agents now" pulse; **Tier 2 Team detail** (managers land here, clamped
to their own team) — per-agent cards + a live team activity rail; **Tier 3 Agent detail** — that
agent's personal + group tasks + metrics + a rail scoped to the agent. Three SECURITY DEFINER
scope-param RPCs (`get_team_task_overview` / `get_team_agent_breakdown` / `get_agent_tasks_oversight`,
EXECUTE revoked → admin-client only). Manager isolation is enforced in **three layers** (action denies
a mismatched domain/agent, page redirect, SQL force-clamp of `p_caller_domain`) because the manager
`tasks` RLS is role-only. Events are emitted from the **task-mutation cores** (so Elaya's writes
inherit them), never UI. Reads are never `auth.uid()`-scoped — oversight must read *other* users'
load. `lib/actions/oversight.ts` was **deleted** 2026-07-02 (zero callers): the trust boundary is the
page gate + the SQL clamp, and the pages call `oversight-service` directly.

## /campaigns and /campaigns/[id]

Campaigns are **not** table rows — a campaign is a distinct `leads.utm_campaign` value; all metrics
derive from grouping `leads` (`archived_at IS NULL`). List = one card per (utm_campaign, domain);
detail = metrics strip + agent distribution + leads table + optional ad-creative carousel. Three
SECURITY DEFINER RPCs, always live (no Redis), client EXECUTE revoked. Campaign names display **raw**
(the title beautifier was deleted 2026-06-23 — never reintroduce one); the key is always
`normalizeCampaignKey()` (lowercase+trim). First-touch response time is now **business minutes**
(0161) and carries a negative-interval guard. manager/admin/founder only (managers domain-locked
server-side); agents redirected.

## /performance

One URL, three role layouts. **Agent:** a lean single-page self-scorecard — Today pulse → period KPIs
→ a real activity-over-time trend (`get_agent_performance_trend`, 0146) + live-pipeline line →
call-outcome mix → recent activity → Elaya footer. Fabricated sparklines were removed; only Leads Won
carries a real daily series. **Manager:** domain roster + per-agent detail
(`get_agent_roster_performance` pins managers to `get_user_domain()` in SQL). **Founder/admin:**
Agents tab (all-domain roster) + Domains tab (default; health cards + comparative chart, the metric
toggle sized `fit-content` on desktop and even-split below md). The global domain selector scopes the
Domains tab. Domain stat cards drill to leads → dossier and (for Deals/Revenue tiles) to a deals drill
that **ties out to the card** (deals by `won_at`, not leads by `created_at`). Drill-modal subtitles
wrap their inline counts in `<Num>` (the mono number-token wrapper). Every response-time figure is
business minutes (09:00–19:00 IST, Mon–Sat) since 0161. **Critical date-field rule:**
`leadsWon`/`conversionRate` by `status_changed_at`; `touchRate` by `created_at` cohort. `MetricCard`
is deliberately bespoke.

## /escalations

manager+ and agents (self-scoped) — "what needs intervention right now." Three sections built on
artifacts the follow-up engine already produces — **no new tables, no jobs, no cache**: **SLA
breaches** (computed **live** — a `fired` timer OR a `pending` timer whose `scheduled_fire_at` already
passed, so the surface is correct even when the Trigger.dev worker hasn't fired; re-checked so a lead
that moved past the triggering status drops), **overdue tasks**, and **going cold**
(`last_activity_at` older than 5 days, via the `cold_lead_cutoff()` SQL helper). Each section passes
`previewRows={50}` to the shared `<Table>` — the built-in P-03 "paginated approach" (only the first N
render, then a one-way "Show all N" expander; the header count pill always shows the true total). The
breaches table shows "Stalled since" + an "Alerted" recipient-chip cluster. The global domain selector
works here. Agents see a self-scoped mirror (`selfView`, second-person copy). Reads are **never
cached**.

## /budget

**Manager+ since 2026-07-10** (it had been admin/founder-only). Spend-vs-outcomes per campaign, fed
**only** from CSV/XLSX uploads — never a Meta API. `ad_spend_daily` (day grain) is joined to lead
counts (`created_at` cohort) and deals (`won_at`) on the shared `campaign_key` via the
`get_budget_summary(from, to)` RPC (EXECUTE revoked, admin-client, **no Redis** — always live;
CPL/CPD `null` → "—" at zero denominators).

**A manager sees only their own domain's campaign SPEND plane:** the page pins
`scopeDomain = profile.domain` server-side (never a `?domain=` param, so it can't be widened), filters
rows via `filterBudgetRowsByDomain`, skips the recharge fetch, and renders the totals strip + campaign
table only. The **recharge ledger, balance, per-account report and fuel gauge stay admin/founder-only**
because recharges carry no domain. Upload + Add-Recharge remain admin/founder; agents still redirect.

The Meta parser (`ad-spend-parse.ts`) is **client-side only** and **rejects the entire file** when any
row's reporting-start ≠ reporting-end (a range-grain file would double-count) — never soften that to a
per-row skip. Since 2026-07-10 it **ingests zero-spend days**, so a re-uploaded month-to-date export
fully overrides every day it covers, including days that dropped to zero; the row cap is 10,000.
**Per-account recharge ledger:** `ad_account_recharges` (0139) records money sent to each Meta ad
account; the Accounts tab groups spend by ad account (DERIVED from the campaign key's index-2 segment
via `resolveAccountFromCampaign`) with an **Unattributed** block, and balance is **INR-only**.

## /helpdesk

The Call Intelligence library (all roles, `ALWAYS_ALLOWED_PREFIXES`). RSC fetches the **full**
domain-scoped library once (`getHelpdeskLibrary(domain)` — Redis 1hr `{cases,hooks}` envelope) and
hands it to `<HelpdeskSearch>` as `initialData`; **all filtering is client-side** — never add a
per-keystroke server search. Domain shelf resolved via `resolveDomainParam`. Tables `service_cases` +
`conversation_hooks` (all-authenticated read / admin+founder write); the same library powers the
dossier `ServiceInterestCard`. Every write awaits the helpdesk Redis key `del` before
`revalidatePath('/helpdesk')` (P-08). The "+ Suggestion" CTA and in-modal Edit are admin/founder-only
(the server re-checks on save).

## /whatsapp

Shared WhatsApp inbox: split-pane conversation list + thread, Realtime sync, optimistic composer with
rollback, **inbound + outbound media** (image/video/PDF/audio — inbound media is durably copied to
private Supabase Storage). One conversation per lead phone; inherits lead assignment/domain rules
(`can_access_wa_conversation`). Unread counts via `get_wa_unread_count`. Resolve/reopen: manager+.
Agent-initiated conversations from the dossier open the 24h session via the `lead_initiation` template.
The pane wears the neumorphic treatment: header on `--neu-header-wash` (subtitle in header ink, not
tertiary — it measured 1.8:1), date separators as raised pill chips, composer docked on
`--theme-paper`, outbound bubbles on `--neu-chat-user-bg`, and three distinct delivery tick states
(sent / delivered / read). This page is the documented **full-bleed exception** to
`CondensingPageHeader`.

**Two Elaya channels touch this webhook, in order:** `tryHandleElayaWhatsAppMessage` routes a
recognised **staff** number to the same brain/tools/daily cap (one reply, lead pipeline untouched);
then, for an unknown number, the normal lead pipeline runs and the **customer** welcome-blast hook can
fire (see `5-elaya-jarvis.md`). Inbound staff voice notes are transcribed (Deepgram).

## /settings (hub + sub-pages)

A **hub**: the agent roster (Team Shifts & Pool over `agent_routing_config` — pool toggle, shift
windows, work days) stays inline as the default surface; two admin/founder-only editors live on their
own routes, reached from link cards: **`/settings/follow-up-engine`** (the SLA/cadence/escalation
editor, written as plain-language **situation cards** — raw rule codes never surfaced) and
**`/settings/lead-revival`** (the nightly-sweep policy editor). Since 2026-07-06 the filter bar sits
directly under the title and the link cards render through `AgentSettingsTable`'s `beforeList` slot,
so the page reads title → filter bar → config cards → roster like every other list page.
manager/admin/founder (managers limited to own domain). Optimistic toggles roll back on error. Shift
fields are advisory (read by ingestion + the SLA shift overrides), not DB-enforced.

## /admin/users (+ /new, /[id])

Team management over `profiles`: browse, create (password or magic-link invite — both via the
`on_auth_user_created` trigger, which also persists `job_title` from invite metadata, 0125), edit
fields, change role/domain (privileged, audited, second-actor rule), soft-deactivate, toggle agent
routing. List+create: admin/founder. Detail: managers may **view** agents (profile form + routing
toggle only). Email immutable after creation.

## /admin/elaya-training

Admin/founder page behind the **customer** Elaya: upload and curate the material she may send and
quote — videos, brochures, images, docs, URLs, and the company-facts brief (`elaya_training_assets`,
migration 0150). Built by cloning the ad-creatives admin shape. The curated KB is the **only** source
of company facts the customer persona may use — she may never invent services or prices, and money is
₹ only.

## /admin/usage

Admin/founder adoption dashboard (`redirect('/dashboard')` otherwise; `getAgentUsage` re-gates in the
service — defence in depth). Built over `usage_daily` (0126) via `get_agent_usage`. "Active" = tab
visible AND interaction in the last ~2 min, gated client-side; a Redis presence key feeds a 1-min
`usage-snapshot.ts` job → `usage_heartbeats`; a 15-min + nightly `usage-rollup.ts` recomputes
`usage_daily` (idempotent UPSERT, never counts login span). Headline "Active today", a per-agent table,
and a per-domain stacked-area history. RSC returns `null` on failure — never throws.

## /admin/suggestions

Admin/founder staff suggestion/bug triage (the service re-gates). Reads `suggestions` (0134);
screenshots live in the **private** `suggestions` bucket (0135) — the row stores **paths**, never
URLs, with short-lived signed URLs minted server-side. Categories bug/idea/other. Resolving fires a
`suggestion_resolved` notification (0136) inside `after()` (the A-16 fix). Anyone can *file* a
suggestion (a "Send feedback" composer in the sidebar footer / dashboard overlay / `/elaya` rail);
triage is admin/founder-only.

## /admin/ad-creatives

Admin/founder upload/manage campaign videos (`ad_creatives` + `ad-creatives` Storage bucket), keyed by
normalised `campaign_key` matching `leads.utm_campaign` (string equality, **no FK**; multiple per
campaign). Read-only surfaces: dossier video modal, campaign detail card, campaign list carousel. **No
Redis** for this service — freshness via `revalidatePath`.

## /error-log

Admin/founder read-only audit of `lead_raw_payloads` rows with `ingestion_error` set — every webhook
payload that failed auth/validation/insert, original payload preserved (full PII, two audit roles
only). Append-only. No replay action yet.

## /profile

Self-management for every role (`ALWAYS_ALLOWED_PREFIXES`): name/username/phone/job title, avatar (≤2
MB → `avatars` bucket), password (browser Supabase client — documented exception). Role/domain never
self-editable; email read-only. **Appearance card** carries three controls: the `AppearanceSelector`
(segmented **Light · Dark · Auto**, `profiles.appearance`, 0158), the `ThemeSelector` swatches (the
eight accent themes), and the `IconSelector` (`profiles.app_icon` — the PWA home-screen icon). All
three apply instantly to the DOM, mirror to their cookie, and persist to `profiles` in the background
through the one existing `updateProfile` action. **`ElayaPersonaSettings`** (the "Elaya" card —
language/tone/depth/length chips + a 600-char note; "how Elaya talks to me", takes effect next
message). **`InstallPrompt`** offers Add-to-Home-Screen; **`PushNotificationSettings`** manages Web
Push device subscriptions; a notification-preferences surface mutes non-transactional categories per
channel. In-place save forms (`EditProfileForm`, `EditAuthorizationForm`, `PasswordChangeForm`) use
the `useButtonStatus` success morph (idle → pending → sage "Saved" + check draw).

## Auth pages (/login, /forgot-password, /update-password)

The one atmospheric surface — a raised cream auth card on the canvas with the mandala mask behind it,
no app chrome. `loginAction` (`signInWithPassword` + `is_active` gate). Password reset is an **OTP
code** flow: `requestPasswordResetAction` (`resetPasswordForEmail`, **no** `redirectTo`; email renders
a 6-digit `{{ .Token }}`; never reveals account existence) → `verifyResetOtpAction` (`verifyOtp` type
`recovery`, establishes the session) → `updatePasswordAction` + `PasswordStrengthBar`.
`/update-password` is two-step, gated only by an `?email` param. This blocks corporate link-scanners
from pre-burning the single-use token. Button-level pending states (width-preserving), no skeletons;
fields never cleared on error.
