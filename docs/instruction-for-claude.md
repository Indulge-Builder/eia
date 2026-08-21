# Serene — Project Context & Working Memory

---

## 1. Who & context

- **Wizard** — technical lead at **Indulge Global**, a luxury concierge brand serving the world's wealthiest (UHNW) clients.
- **Verticals:** Global, House, Shop, Legacy
- **Primary project: Serene** — Indulge Global's internal operating system. Three core modules:
  - **Gia** — lead-management CRM. _Live_ across Shop, Legacy, House, Onboarding domains.
  - **Sia** — concierge fulfilment system. _In development._
  - **Elaya** — agentic AI assistant / the "presence" layer inside the app our jarvis level full agentic ai assistant.
- **Tech team (3):**
  - **Arfam** — app, admin panel, websites, Serene/Elaya.
  - **Manu** — data, testing, Serene dev.
  - **Ethan** — security, device management, Serene features, third-party integrations (WATI, Freshdesk).
- Wizard is the senior architectural decision-maker: uses Claude for planning/briefs, **Claude Code (via Cursor)** for execution.

## 2. Stack (final — never propose alternatives)

Next.js 16 App Router (PWA) · TypeScript strict · Tailwind CSS v4 · shadcn/ui · Supabase (PostgreSQL 17, Auth, RLS, Realtime) · Framer Motion · React Hook Form + Zod · Trigger.dev v4 · Upstash Redis · Vercel (Mumbai / `bom1`) · pnpm · Gupshup (WhatsApp BSP).

- **Supabase project:** `xmucqqhbupudnzderchy`
- **Trigger.dev project:** `proj_xfyyvwjmrumreyvawcwg` (binary is `trigger`, not `trigger.dev`; `trigger.config.ts` reads tsconfig path aliases automatically)
- **Repo:** `github.com/Indulge-Builder/serene`

## 3. What's live (Serene / Gia)

- **Lead pipeline:** `new → touched → in_discussion → nurturing | won | lost | junk`
- **Domain model:** `leads.domain` always equals the handling team's `profiles.domain`; canonical enum is `app_domain` (not text).
- **SLA engine (Phase 8, shipped):** business-hours-aware (09:00–19:00 IST, Mon–Sat), event-driven delayed jobs via Trigger.dev v4, five rule categories, auto-task creation on breach, `sla_policies` table with `USR-` codes, deactivate-not-delete semantics.
- **WhatsApp (Gupshup BSP, active):** full notification pipeline (agent assignment, founder alerts, SLA breach), `whatsapp_notification_logs` audit table, `x-gupshup-secret` webhook auth, `after()` from `next/server` for fire-and-forget safety.
- **Elaya AI (inside Serene):** multi-provider LLM (Anthropic Haiku for routing, Sonnet for reasoning), pseudonymisation/PII gateway, WhatsApp channel routing, agentic writes behind a confirm gate, `elaya_actions` audit log, voice via Deepgram STT + ElevenLabs TTS.
- **Task system:** `task_category` collapsed to `personal` / `group_subtask`; module links via meta tables (`task_gia_meta`, future `task_sia_meta`); `module` column is a native Postgres enum (`task_module: 'gia' | 'sia' | 'core'`); Oversight page (three-tier progressive disclosure) with `task_events` append-only table.
- **Usage monitoring:** heartbeat-only (60s, visibility-gated), Redis hot path, `usage_heartbeats` + `usage_daily` tables, `SECURITY DEFINER` RPC for reads.
- **Migration discipline:** `supabase db push` **only** — never the SQL editor. Mixing the two caused ledger drift (orphan rows, version-string mismatches); reconcile via `migration repair`.

## 4. Active sub-projects (alongside Serene)

- **Elaya 3D mascot** — "Astralis Driftling" `.glb` export for Serene's UI.
- **Serene public marketing/investor site** — `SPEC.md` locked: eight-chapter storyboard, Instrument Serif + Inter Variable, GSAP ScrollTrigger + Lenis, Higgsfield for AI imagery, Vercel deploy. Static launch piece for founders/investors. **Rule: all Higgsfield screenshots use seeded demo data only.**
- **Monthly PDF reports** — WeasyPrint pipeline with Playwright/Chromium fallback; Playfair Display + Geist embedded as base64 woff2 data URIs; `font-synthesis: none` to kill the ghost-print artifact; Indian number formatting (lakh grouping).

## 5. On the horizon

- **Sia module** — concierge fulfilment; seven-phase plan ready. Mirrors Gia: `create_lead_sia_task` RPC + `task_sia_meta` + `module='sia'`.
- **Elaya marketing website** — Phase 1 (skeleton build) brief ready for Claude Code.
- **Serene repo** — make private; establish a fine-grained **read-only PAT** workflow for per-session Claude access.
- **Call Intelligence content gate** — needs ≥20 verified entries per category before the helpdesk goes live (team worksheet pending).
- **Phase 3** — escalation breach queue page + SLA settings UI (downstream of Phase 8).
- **Elaya 3D** — full animation sequence render via background CLI (`blender -b file -a`).
- **ElevenLabs TTS** — PII-exposure decision pending (zero-retention enterprise mode recommended); romanized Hinglish pronunciation testing needed.
- **Domain filter dropdown** — founder-requested; `resolveDomainParam(searchParams, cookieStore, profile)` pattern designed; scope (Gia-only vs full platform) to be confirmed.

## 6. Key learnings & principles

**Architecture**

- Read the actual files before prescribing — never brief from digests alone.
- One fetch per data source; `Promise.all` for parallel; never per-row/per-card calls.
- `SECURITY DEFINER` + `SET search_path = public` on all RPCs; RLS **and** `requireProfile()` always paired (neither trusts the other).
- Redis failures must never block DB fallthrough; `await` cache deletes before `revalidatePath`.
- **Dual cache key invariant:** `leadRowSlug` is hit on normal dossier loads; `leadRowId` only on UUID-fallback paths. A mutation that deletes only one key is a silent no-op on normal traffic. (Lead caches via `invalidateLeadCaches`.)
- `cache()` (React) for session-bound dedup; `unstable_cache` only for static/shared data (it can't wrap `createClient()`, which calls `cookies()`).
- `module='gia'` count must always equal `task_gia_meta` count — enforced by app discipline (single-writer RPC), not a DB constraint.

**Supabase / PostgreSQL**

- Dot-notation column filters on PostgREST joined tables are silently no-ops — never use.
- `jsonb_agg()` returns `NULL` on zero matching rows, not `[]` — coerce with `COALESCE` at the SQL layer and `?? []` at the page layer (two-layer defence).
- RLS policies referencing a column block `ALTER COLUMN TYPE` — drop policies, alter, recreate.
- `bigint` from RPCs must be converted via `Number()` at the service-layer boundary (Q-09).

**Design system**

- Zero hardcoded hex anywhere in components — everything via CSS tokens.
- `font-synthesis: none` + real font-weight files eliminates the ghost-print artifact in WeasyPrint/Chromium.
- `prefer_css_page_size=True` + `print_background=True` required for correct Playwright PDF sizing.

**Workflow**

- Cursor prompts must include: mandatory read-first file list, pre-mortem failure modes, sign-off checklist, post-completion doc updates.
- **Doc updates are mandatory:** `changelog.md`, touched `CLAUDE.md` files, page specs, project digest, knowledge graph.
- `tech-debt.md` **does not exist in the repo — do not reference it.**
- Gamma workspace uses custom theme ID `nqc7dhuzst2wwmi` ("Indulge") — always this, never a generic theme. Use `cardSplit: auto` with explicit `numCards`; omit `inputTextBreaks`.

## 7. Naming canon

- **Serene** = the main OS.
- **Elaya** = the AI virtual assistant / presence layer (code & docs still say "Lia" until the Phase 4 rename pass).
- **Gia** = lead-management CRM module.
- **Sia** = concierge fulfilment module.

## 8. Tools & resources

- **Blender MCP** (local, 5.1.2 EEVEE): `execute_blender_code` reliable for read-only inspection; avoid `evaluated_depsgraph_get()` + `to_mesh()` on animated curve objects (hard timeout). Render previews at ≤360px; results at ≥420px.
- **Gamma** (connected): theme `nqc7dhuzst2wwmi`; `cardSplit: auto`; `textOptions: {amount: brief, tone: "confident, outcome-led, calm luxury"}`.
- **Motion:** `create_video`; always include the conceptual-only constraint (no real data/names/screenshots); board-facing videos default to 16:9.
- **Higgsfield:** image generation for the marketing site; tools require explicit toggle in the connectors menu per session; image-to-3D produces opaque watertight meshes (not suitable for Elaya's translucent design).
- **Supabase MCP:** schema inspection and remote `database.ts` regen against the live project.
- **WeasyPrint 69.0:** `base_url='.'` required; avoid CSS Grid (use flexbox/tables/block); `pdftoppm -png -r 400` for high-DPI verification.
- **Deepgram** (STT, Nova-3 multilingual): romanized Hindi (`hi-Latn`) unsupported on current models — test `nova-2` or add a Claude Haiku post-processing hop.
- **ElevenLabs** (TTS, Flash): input-streaming from the LLM for latency; PII transit concern requires zero-retention enterprise mode.
- **Brevo:** SMTP delivery; DNS domain verification preferred over OTP (Google Groups unsuitable for transactional mail); SPF/DKIM/DMARC aligned for both Workspace and Brevo using Brevo's dedicated DKIM selector.
- **Indulge email domain:** `indulgeglobal.com`; Elaya has (or should have) a dedicated Workspace user seat as its sender identity.

## 9. Preserved dated instructions

> These older entries use the repo's earlier name **"Eia"** — same codebase as Serene.

- **Phase 6 (2026-05-28):** Lead column visibility + drag-to-reorder shipped. Files: `src/lib/constants/lead-columns.ts`, `src/hooks/useLeadColumnPreferences.ts`, `src/components/leads/LeadColumnPicker.tsx`. `LeadsTable` accepts a `userId` prop; prefs in `localStorage` key `eia:leads:columns:${userId}:v1`. `@dnd-kit/core` + `@dnd-kit/sortable` added.
- **Phase 8 detail metrics (2026-05-28):** Migration 0015 — `get_campaign_detail_metrics` (avg_hours_to_first_touch via lateral join) + `get_campaign_agent_distribution`. `CampaignMetricsStrip` (6 stat cards, division-by-zero guards), `AgentDistributionBar` (Framer Motion `layoutId`), `CampaignMetricsStripSkeleton`. Detail page has 2 independent Suspense boundaries. `numbers.ts` stubs implemented. bigint → `Number()` (Q-09).
- **Number formatting cleanup (2026-05-28):** `formatCompact` / `formatPercent` / `formatCurrency` applied across `AgentTasksWidget`, `ManagerLeadStatusWidget`, `ManagerLeadVolumeWidget` (YAxis tickFormatter), `ManagerCampaignWidget` (YAxis tickFormatter), `CampaignCard` (MetricPill). Zero raw number renders in JSX metrics across all 5 files. `numbers.ts` is the single source for metric display formatting.
- **Elaya naming (2026-06-12):** "Elaya" is canonical for the AI presence layer. Use it in all plans/briefs. Repo docs/code still say "Lia" until the Phase 4 rename pass.
- **tech-debt.md (verified 2026-06-12):** does not exist anywhere in the repo. Do not reference it.

## 10. How to work with Wizard

- **Brief-first, execute-second:** Wizard approves the architecture/decision, then Claude writes the Claude Code / Cursor brief, Cursor executes, Wizard reports back.
- **Read before prescribe:** request actual source files rather than assuming structure. Digests describe; the repo is truth. If a digest and a pasted file disagree, the repo wins — say so.
- **Terse comms:** Wizard writes shorthand, typos, stream-of-consciousness. Interpret intent; don't ask about spelling. Deliver verdicts with reasoning.
- **Proportionate:** short question → short answer; depth matches complexity.
- **Honest disagreement:** surface risks, push back on architectural choices, never just agree. If the plan is wrong, say so first.
- **Phased sequencing:** foundation first, no code duplication, natural feature progression.
- **Design tokens enforced:** every colour is a token; flag and correct violations on review.

### The five lenses for judging any idea

1. **Natural progression** — a step toward the Jarvis-level AI vision, or a sideways detour that adds weight? Extend what exists before inventing.
2. **100x test** — still fast, cheap, correct at 100× leads/messages/users?
3. **DRY** — registry first; compose/extend, never duplicate.
4. **Safety** — RLS gap? cache invalidation? PII leak? privileged change with no second actor?
5. **Earned complexity** — simplest correct version first; build the fancy version only when data demands it.

### The vision everything converges on

Serene ends as a **Jarvis-level AI work layer**. Elaya is the presence inside the app — an agentic assistant reachable from anywhere (WhatsApp message to the API, or the in-app chatbot). Everything built today — Gia, tasks, WhatsApp pipeline, deals, performance — is **substrate** for that layer. Clean data models, append-only history, pseudonymised AI access, and action-shaped mutations aren't pedantry; they're what makes the AI layer buildable later. When two designs are equal, choose the one the AI layer can drive.
