# Serene — Engineering Rules & Conventions (Claude Project digest)

> Digest of `docs/rules/The_Rules.md` (the engineering constitution) + the code-adjacent `CLAUDE.md`
> files (`src/lib/`, `src/lib/actions/`, `src/lib/services/`, `src/lib/elaya/`, `src/components/`,
> `supabase/migrations/`, `src/app/`) + `eslint.config.mjs`. Verified 2026-08-24. The root
> `CLAUDE.md` carries the 12-rule command-layer summary and the Never-Do list; this file is the
> fuller constitution with rule IDs preserved. When a code change is in question, these are the laws
> it must satisfy.

## What is now enforced by machine (not just by review)

- **`pnpm build` = `node scripts/check-tokens.mjs && next build`.** The token guard runs first and
  fails the build on a stray hex or forbidden pattern. (It was broken on Windows until 2026-08-21 —
  `new URL('..').pathname` yields `/E:/…`; it uses `fileURLToPath()` now. The moment it ran again it
  caught a real bug: `var(--space-9)`, which no sheet defines, so a `padding-right` was silently
  dropped. **The space scale skips 9** — …7, 8, 10.)
- **ESLint 9 flat config** (`pnpm lint`, deliberately **not** in the build): correctness as errors,
  style off. It machine-enforces the A-17 `m as motion` import, no `window.confirm`/`alert`, the
  Rule-05 Supabase-client import scoping, and the "only `adapters/anthropic.ts` may import the
  Anthropic SDK" rule. React-Compiler-prep rules are deliberately off until compiler adoption.
  Keep it lean — a new rule must prevent a real bug.
- **TypeScript strict**, and since the 2026-07-02 `database.ts` regen the whole codebase types
  against the generated schema. `as any` is down from ~113 to a handful, each explained in place.

## Section 0 — Reuse First (the DRY law; the #1 violation in this codebase)

The most common mistake here is not a bad pattern — it's a **second copy of a good one**. Always
search by **behaviour**, not filename ("date picker", not `DatePicker`; "who can I assign this to",
not `getAssignableUsers`).

- **R-01** One behaviour → one implementation → one home. Search before creating anything.
- **R-02** The registry is law by reference. The "THE x" entries in the `CLAUDE.md` files and the root
  File-Locations table are the **only** implementations allowed.
- **R-03** Never copy-paste a module as the starting point for a "new" one — extend the original.
- **R-04** Deleted forks stay deleted. Re-introducing a consolidated parallel version is a violation.

### Canonical shared-helper registry (use these; never fork them)

#### Guards, data and mutation seams

| Behaviour | Canonical | Note |
| --------- | --------- | ---- |
| Session/role guard | `requireProfile(roles?)` — `lib/actions/_auth.ts` | A-18; both no-session and wrong-role return one `unauthorized` |
| Zod parse → user copy | `parseActionInput(schema, input)` — `lib/actions/_validation.ts` | first issue → `formErrors.generic` |
| Shared Zod fragments | `uuidField(msg)` / `emailField(msg)` — `lib/validations/fields.ts` | phone fields stay per-schema (different `normalizeToE164` transforms) |
| Redis cache-aside envelope | `withRedisCache(key, ttl, fetchFn, normalize?)` — `services/cache-helpers.ts` | never hand-roll get→fetch→setex |
| Revoked-tier RPC boundary | `callAdminRpc(rpc, params, mapRow, logCtx)` — `services/rpc-helpers.ts` | **not** for session-client self-scoped RPCs (`auth.uid()` in SQL) |
| Lead Redis invalidation | `invalidateLeadCaches(site, lead, scope)` — `services/lead-cache.ts` | P-08; dual-key, awaited before revalidate |
| Lead core mutations | `*Core()` in `services/lead-mutations.ts` | actions AND Elaya tools reuse the same core |
| Task core mutations | `*Core()` + `canMutateTask` + `isAssigneeActive` in `services/task-mutations.ts` | |
| Per-lead Elaya access gate | `canAccessLead` — `lib/elaya/access.ts` | ONE security predicate for both tool registries |
| Assignable-users list | `getAssignableUsers()` / `getAssignableUsersAction()` | "who can I assign this to" |
| Domain decision-makers fan-out | `getDomainDecisionMakers(domain, roles?, select?)` | the domain+roles+is_active read |
| Domain-scope resolver | `resolveDomainParam(searchParams, cookieStore, role)` — `utils/domain-scope.ts` | the ONE global selector; `allowAgentParam` is opt-in per page |
| Activity emit seam | `emitActivityEvent` / `emitLeadActivityEvent` — `services/activity-events.ts` | lead/deal cores emit directly; task rows DERIVE inside `emitTaskEvent` |
| Typed row boundary | `mapRows<TRow, TOut>()` — `utils/rows.ts` | Q-18; no new `as Record<string, unknown>` casts |
| Trigger.dev cancel-by-tag | `cancelRunsByTag(tag)` — `lib/trigger/cancel-runs.ts` | lives OUTSIDE `src/trigger` so the task scan skips it |

#### Utilities

| Behaviour | Canonical | Note |
| --------- | --------- | ---- |
| IST day/week/month math | `lib/utils/ist.ts` | never re-fork UTC+5:30 |
| Date/count/currency format | `utils/dates.ts`, `utils/numbers.ts` | `formatDate`, `formatCount`, `formatCompact`, `formatCurrency` (INR/USD/EUR) |
| Subscription cycle math | `utils/subscription-status.ts` | `computeSubscriptionStatus`, `currentDueDateISO`, `occurrenceInMonthISO`, `statusForOccurrenceISO` — one home so projection can't drift |
| Text sanitize | `sanitizeText()` — `utils/sanitize.ts` | S-02; every user text before DB write (**never** on a login/password — it would corrupt them) |
| Phone normalize | `normalizeToE164()` / `normalizeWaPhone()` — `utils/phone.ts` | S-03 |
| Campaign key | `normalizeCampaignKey()` — `utils/campaigns.ts` | lowercase+trim; DB CHECKs depend on it. Names display **raw** |
| Initials / colour pick | `getInitials()` / `hashString()` — `utils/strings.ts` | |
| CSV/XLSX export | `utils/export.ts` (`buildLeadsCSV`, `buildXLSXWorkbook`, `buildSingleSheetXLSX`) | **client-side only**; never imported by an action/service |
| Meta ad-spend parse | `parseMetaSpendFile()` — `utils/ad-spend-parse.ts` | client-side only; owns the range-grain whole-file rejection |
| Webhook JSON / rate-limit / secret | `readJsonBody()` / `createRateLimiter()` / `safeSecretCompare()` — `utils/webhook.ts` | validate credential BEFORE reading body |
| Markdown → WhatsApp text | `markdownToWhatsApp()` — `utils/whatsapp-format.ts` | every model-authored WhatsApp reply passes through it |
| Scroll helpers | `scrollToBottom()`, `lockBodyScroll()` — `utils/scroll.ts` | the lock is re-entrant |

#### UI primitives and hooks

| Behaviour | Canonical | Note |
| --------- | --------- | ---- |
| Confirm dialog | `<ConfirmDialog>` | never `window.confirm` (ESLint), never hand-rolled |
| Undoable delete | `toast.undo(...)` | reversible deletes; ConfirmDialog stays for irreversible ones |
| List-page filter bar | `<FilterBar>` + `useUrlFilters` | extend, never fork. Immediate-commit only — the Apply/draft model was removed |
| Anchored dropdown/panel | `usePortalAnchor()` + `<FloatingPanel>` | the portal-escape fix |
| Expand/collapse | `<CollapseReveal>` | grid-template-rows 0fr↔1fr, never `height: 0↔auto` |
| List row choreography | `<MotionRow>` — `ui/RowMotion.tsx` | inside `<AnimatePresence initial={false}>`; row motion wins — remove the per-row `motion.div` |
| Card header strip | `<CardHeader>` — `components/leads/CardHeader.tsx` | the themed wash + header ink/icon tokens |
| Empty state | `<EmptyState>` (+ `brand`) | Playfair italic; never "No data available" |
| Loading scaffold | `PageSkeletons` exports | compose, never re-inline |
| Loading indicator | `<LogoSpinner>` / inline `SeedMandala` / `LoadingVeil` | the arc `Spinner` is DELETED — never recreate it |
| Labelled stat tile | `<StatTile variant="card"\|"cell">` | value renders in the mono number font |
| Inline number token | `<Num>` | a number mid-sentence; inherits colour/weight |
| Animated stat value | `<AnimatedNumber>` | takes the already-formatted string |
| Completion tile | `<CheckTile>` | inset ↔ accent-gradient flip + check draw + one ring pulse |
| Won celebration | `<PetalFall>` | reserved exclusively for a Won deal |
| Hover pill | `<Tooltip>` | 500ms intent; never on coarse pointers |
| Sticky page header | `<CondensingPageHeader>` | paint-only condensing |
| Global palette | `<CommandPalette>` + `CommandPaletteProvider` | ⌘K; panel chunk loads on first open |
| Model markdown in chat | `<ChatMarkdown>` | no `dangerouslySetInnerHTML`, SSE-safe |
| Task-form fields | `TaskFormFields` | all create-task modals compose these |
| Voice dictation cluster | `<DictationButton>` | all four voice surfaces compose it |
| Dashboard widget data | `useWidgetData()` + `effectiveWidgetDomain()` | manager pinned to own domain server-side |
| Mobile room data | `useDomainRoomData()` + `<DomainSwiper>` | one swipe engine (`ui/Carousel`), never forked |
| Heavy-modal mount latch | `useMountOnFirstOpen(open)` | lazy chunk, exit animation preserved |
| Debounce | `useDebounce()` | |
| Viewport/media query | `useMediaQuery` + `MQ` | never raw matchMedia/innerWidth (V-14) |
| Chart colour resolve | `useChartTokens()` / `resolveColorMap()` | V-12; watches `data-theme` **and** `data-neu` |
| Cartesian chart frame | `ChartFrame` + `cartesianDefaults()` | Area/Line/Bar. The five chart wrapper components were deleted — live consumers import raw Recharts + this frame |
| Motion timing | `lib/constants/motion.ts` | V-13; never inline a bezier/spring/duration |
| String-enum factory | `defineEnum()` — `constants/define-enum.ts` | Q-02; richer config tables stay hand-written |
| Joined-profile shapes | `WithAuthor<T>` / `WithAssignee<T>` / `WithActor<T>` | never a fresh intersection |
| Notification fan-out | `createNotification()` | the chokepoint: in-app row + push, both or neither; optional `notificationKey` gates both |
| Notification prefs gate | `resolveChannels` / `isChannelEnabled` / `filterRecipientsByPref` — `services/notification-prefs-service.ts` | **absence = ON, fails OPEN**; never gate `lead_initiation`/`elaya_reply` |
| Web Push sender | `dispatchPush()` | non-fatal; dead-endpoint prune mandatory |
| Transcription | `transcribeAudio()` — `transcription-service.ts` | the SOLE Deepgram call, server-only |
| Template WhatsApp sends | `sendGupshupTemplate()` | one fetch, one log-row-per-attempt, for all 12 templates |
| Lead-assignment notify | `notifyLeadAssigned()` | the single entry for all 4 assignment paths, inside `after()` |
| Elaya SSE transport | `streamElayaChat()` — `components/elaya/elaya-stream.ts` | desktop shell + mobile screen pump the same one |

## Section 1 — Architecture (A-rules)

- **A-01** Authorization reads **only** from `public.profiles`. JWT claims never trusted.
- **A-02** Server Actions are the only client→DB mutation path.
- **A-03** All DB queries go through `lib/services/`. No raw Supabase in components or actions.
- **A-04** `components/ui/` imports types only — never functions/actions/hooks/services from features.
- **A-05** No cross-feature imports. Cross-feature data flows through `lib/` only.
- **A-06** UI components are display-only. Zero business logic, zero DB calls, zero decisions.
- **A-07** One table, one responsibility.
- **A-08** Every new table enables RLS in its migration.
- **A-09** Two-layer security always (RLS at the DB **and** the server action). Never rely on one.
- **A-10** Every `SECURITY DEFINER` function has `SET search_path = public`.
- **A-11** Log/activity tables are append-only. **Documented exceptions:** WhatsApp
  delivery-receipt status; `task_remarks` suppression flags (admin/founder); the
  `revival_candidates` open→actioned/dismissed resolve-once flip; the `elaya_actions`
  proposed→terminal flip; the `suggestions` open→resolved status flip. `task_events`,
  `activity_events`, `subscription_payments`, `subscription_topups` and
  `subscription_password_reveals` have **no** write policy, ever. New exceptions need a Decision Log
  entry.
- **A-12** Async work >3s or needing retry → Trigger.dev. Sub-3s post-response → `after()`. Nothing
  heavier in route handlers/actions.
- **A-13** Dashboard protected at three layers (proxy → layout guard → `canAccessRoute` over
  `DOMAIN_ROUTE_MAP`). There is **no** `src/middleware.ts` — the proxy is `src/proxy.ts`.
- **A-14** Never edit a migration that has already run in production. Write a new one.
- **A-15** `'use client'` components never `import` a value symbol from `lib/services/` (it pulls
  `next/headers` into the client bundle and hard-errors). Call a Server Action instead. `import type`
  is safe.
- **A-16** Outward network sends that must complete use `after()` + an awaited send — never
  `void fetch().catch()` (Vercel freezes the lambda on response flush → silent loss; the 2026-06-08
  outage). Routes carrying sends export `maxDuration`.
- **A-17** Framer Motion is always `import { m as motion } from 'framer-motion'`. `<MotionProvider>`
  (LazyMotion strict + async domMax + `MotionConfig reducedMotion="user"`) is mounted once in the root
  layout; the bare namespace throws. **ESLint-enforced.**
- **A-18** Every session-based Server Action begins with `requireProfile(roles?)`. **Exceptions:**
  `sla.ts` (Trigger.dev, no session), `loginAction` (`is_active` read), four `tasks.ts` actions
  (parallel-fetch optimization).

## Section 2 — Security (S-rules)

- **S-01** Every Server Action validates input with Zod **before** touching the DB. First line.
- **S-02** All user text passes `sanitizeText()` before any DB write. (Credentials are the one
  category that must **not** be sanitized — sanitizing a password corrupts it.)
- **S-03** All phones stored E.164 via `normalizeToE164()`.
- **S-04** Never spread a raw request body into an insert — whitelist via Zod.
- **S-05** Never expose raw Postgres/Zod errors to the UI. Log server-side with a `[module-action]`
  prefix (Sentry is NOT wired).
- **S-06** Never trust a client-supplied ID without verifying ownership/access.
- **S-07** No sequential integer IDs in URLs — UUIDs/slugs only.
- **S-08** No sensitive data in URL query params.
- **S-09** Auth errors never reveal whether an email exists; in-app, `requireProfile` returns one
  unified `unauthorized`.
- **S-10** Tokens/auth codes/secrets never logged.
- **S-11** `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `*_KEY`/`*_SECRET`/`*_TOKEN` are
  server-only. `NEXT_PUBLIC_` only if genuinely public.
- **S-12** Every webhook validates its credential **before** reading the body.
- **S-13** No `dangerouslySetInnerHTML` anywhere (that is why `<ChatMarkdown>` exists).
- **S-14** Users cannot update their own `role`/`domain` (server-controlled).
- **S-15 / S-16** Forward contracts: separation of duties + second-actor approval for privilege
  changes (admin/founder-gated + audited today; never ship self-approval UI).
- **S-17** Webhook routes are rate-limited (`createRateLimiter`) and compare secrets timing-safe
  (`safeSecretCompare`).
- **S-18 (as built, 2026-08-06)** A stored third-party credential is encrypted at rest with a
  **Vault-held key** (pgcrypto `pgp_sym_encrypt`, SECURITY DEFINER encrypt/decrypt functions,
  `service_role` only), never selected into a list/detail payload, and produced only by an explicit
  reveal action that writes an append-only audit row **first** and fails closed if that write fails.

## Section 3 — Data & Privacy (D-rules)

- **D-01** No raw PII reaches an external AI model. **Interim (Elaya):** every tool result passes
  `maskPii()` before serialization.
- **D-02** No hard deletes on leads/profiles/notes/activity — soft-delete with
  `archived_at`/`deleted_at`/`is_archived`.
- **D-03** Every status change, assignment, note, role/domain change, and failed auth is logged.
  Bulk data migrations write the same audit rows (`method: 'bulk_migration'` + the previous owner).
- **D-04** Full PII never in log messages — record IDs only. (WhatsApp notification logs keep last-4
  phone digits; `lead_raw_payloads` is the one deliberate raw-PII store, a logged decision.)
- **D-05** AI prompt contents containing client data are never logged.
- **D-06** No session tokens/auth codes in any log.

**DPDP status (from the 2026-07-02 audit):** the security architecture largely satisfies Rule 6, but
the statutory machinery is missing — no consent/lawful-basis record at any ingestion point, no
WhatsApp STOP/opt-out, no breach-notification workflow, no DSR/grievance flow, and erasure is
structurally impossible today (ten append-only tables hold PII immutably). Substantive obligations
bite ~14 May 2027. Treat any new PII-touching design as needing a consent/retention answer.

## Section 4 — Performance (P-rules)

- **P-01** Server-Components-first. Client widgets fetch via a Server Action inside `useEffect` — never
  bare Supabase in `useEffect`, never React Query.
- **P-02** No API routes except the two webhooks, `/api/auth/callback`, `/api/elaya/chat` (SSE), and
  `/api/manifest` (PWA carve-out). All mutations are Server Actions.
- **P-03** Any list >~100 rows is bounded server-side (`.range()` / cursor RPC). Keyset cursors over
  nullable columns must be composite. `<Table previewRows={N}>` is THE built-in in-page answer
  (first N render + a one-way "Show all N" expander; the header count stays honest).
- **P-04** Images in scroll containers use `loading="lazy"`.
- **P-05** No scroll listeners for UI logic — `IntersectionObserver`.
- **P-06** Realtime subscriptions always include a filter + a mount-scoped `useId()` nonce; cleanup is
  `supabase.removeChannel(channel)` (unsubscribe alone leaks).
- **P-07** No stray `console.log`. Permitted: `[module-action]`-prefixed `warn`/`error` for non-fatal
  server failures.
- **P-08** Every `redis.del` in an action is awaited in try/catch (logged warn) **before**
  `revalidatePath`/`revalidateTag`. Lead actions use `invalidateLeadCaches` (structural). Dashboard
  volume keys are TTL-only by design.
- **P-09** `unstable_cache` closures cannot touch `cookies()`/`headers()` — a service using the session
  client can't be wrapped; use React `cache()` instead.
- **P-10 (as built)** Heavy chunks warm post-hydration rather than sitting in the route chunk, and a
  tap that gates on a fetch shows feedback immediately (`LoadingVeil`) — never dead air.

## Section 5 — Design & Visual (V-rules)

- **V-01** Every colour is a CSS var. Sanctioned exceptions: the chart `FALLBACK` palette pre-paint,
  the `SeedMandala` brand gradient stops, and the `NEU_CANVAS_LIGHT/DARK` meta/manifest mirrors.
- **V-02** `--theme-accent-fg` on buttons/accent fills — never `--theme-text-inverse`, never white.
- **V-03** Animation ceiling 500ms; the idle/breathe loops, chart draws and the boot sequence are the
  only sanctioned exceptions.
- **V-04** No `font-bold` (700); `--weight-semibold` (600) is the max.
- **V-05** No z-index outside the `--z-*` scale.
- **V-06** No backdrop-blur except TopBar, mobile sidebar overlay, the command palette, and
  `.serene-condense-header`. It was explicitly removed from modal overlays.
- **V-07** No mixed radii within one component. One radius scale (Marshmallow).
- **V-08** No skeleton under 150ms; buttons never change width on load.
- **V-09** Empty states are Playfair-italic via `<EmptyState>`.
- **V-10** Micro labels are exactly `text-[10px] font-medium uppercase tracking-[0.12em]`.
- **V-11** No one-edge coloured border as a category/status indicator — pills/dots/icons/badges.
- **V-12** Never pass a CSS var to a Recharts `fill`/`stroke` — resolve via `useChartTokens()`.
- **V-13** Motion values come from `motion.ts` / `--duration-*`/`--ease-*` tokens — no inline beziers.
- **V-14** Responsiveness: Tailwind-default breakpoints; client-JS branches via `useMediaQuery`+`MQ`
  only when behaviour differs; responsive shells live in shared primitives; never combine inline
  `gridTemplateColumns` with responsive grid classes; full-height surfaces use `dvh`; persisted
  layouts never drive the narrow rendering.
- **V-15 (neumorphic, as built)** Depth is a **paired** shadow plus the white hairline; inset marks
  **state only**; a selected item floats on an accent wash, never inset; a card header takes
  `--neu-header-wash` + `--neu-header-ink`/`-icon`, never `--theme-accent` text and never the well
  tone.

## Section 6 — Code Quality (Q-rules)

- **Q-01** No `any` (one carve-out: an `.rpc()` not yet in generated types — cast + disable comment,
  then regenerate `database.ts`). **Regen-first is the prescribed order**; the interim cast is only
  for the migration-to-regen window.
- **Q-02** No magic strings — domain/role/status values are typed enums via `defineEnum()`.
- **Q-03** Server Actions return `{ data, error }`. Never throw, never void. Components handle both.
- **Q-04** User-facing errors come from `lib/validations/form-errors.ts` — never raw Zod, never
  "Invalid input." Never clear a form field on validation error.
- **Q-05** No npm package without a `docs/changelog.md` justification.
- **Q-06 / Q-06a** Every meaningful change gets a `docs/changelog.md` entry (single source of truth);
  no deploy without the deploy checklist passing (migration deploy-order warnings are binding).
- **Q-07** Drag-to-reorder always uses `@dnd-kit`.
- **Q-08** Column-pref hooks follow `useLeadColumnPreferences` exactly: key
  `serene:[module]:columns:${userId}:v1`.
- **Q-09** `COUNT(*)` returns `bigint` — cast with `Number()` in the service; format via
  `formatCount`/`formatCompact` in components.
- **Q-10** `decodeURIComponent` in route handlers is wrapped in `try/catch → notFound()`.
- **Q-11** Every `switch` over a union is exhaustive with `assertNever(x)` — no `default` branch.
- **Q-12** (promoted to R-01.)
- **Q-13** SECURITY DEFINER RPCs are two-tier: *self-scoped* (derive scope from `auth.uid()`, keep
  `authenticated` grant) vs *revoked* (scope params, EXECUTE revoked, admin-client only with
  session-derived args). A scope-param RPC with a live `authenticated` grant is a violation.
- **Q-14** Realtime channel names include a `useId()` nonce: `table-${id}-${mountId}`.
- **Q-15** Initial data fetch in a client component lives in `useEffect`, never a render-phase guard.
- **Q-16** `unstable_cache` and Redis keys include every scoping dimension — domain, userId, **and
  the caller role** where the underlying RPC takes `p_role` (the dashboard pipeline/campaign keys
  were fixed for exactly this). Revalidate via `revalidateTag(tag, { expire: 0 })`.
- **Q-17** Two domain registries — `APP_DOMAINS` + `DOMAIN_LABELS` (full platform enum) vs
  `GIA_DOMAINS` (the four Gia sales domains). Never mix; labels always via `DOMAIN_LABELS`.
- **Q-18** Untyped query results cross into typed code only via `mapRows<TRow,TOut>()`; joined-profile
  shapes use `WithAuthor`/`WithAssignee`/`WithActor`.
- **C-1 (param-sync)** When a query gains a scoping parameter, every sibling that must agree with it
  gains the same one in the same change — the list, the count RPC, and the export. A pill that
  disagrees with its table is a bug even if both queries are individually correct.

## File & naming conventions

```text
Components   PascalCase.tsx     Actions   kebab-case.ts (_-prefix = internal helper, e.g. _auth.ts)
Services     kebab-case.ts      Hooks     camelCase.ts (use*)        Utils  kebab-case.ts
Validations  kebab-case.ts      Constants kebab-case.ts              Pages/Layouts  page.tsx/layout.tsx
```

## Notable code-adjacent conventions (not numbered, still binding)

- **Browser Supabase client is a singleton;** Realtime teardown **must** call `removeChannel`.
- **Composite cursor** for keyset pagination over a nullable sort column.
- **Lead follow-up tasks** (since 0138) are a `personal` task + a `task_gia_meta` link row;
  `create_lead_gia_task` is the single writer of both.
- **`cold_lead_cutoff()`** (STABLE SQL, `now() - 5 days`) is the one source of the cold threshold.
- **`business_minutes_between()`** (0161) is the one source of elapsed-response-time math —
  09:00–19:00 IST, Mon–Sat. Every KPI, roster, benchmark, Elaya twin and campaign first-touch RPC
  uses it; nights and Sundays no longer inflate the number.
- **Template-send core (`sendGupshupTemplate`)** owns the fetch, the delivered check, and the
  one-log-row-per-attempt `finally { await logNotification }`.
- **Heavy modals** load via `next/dynamic` at module scope (`ssr:false`) + `useMountOnFirstOpen` when
  permanently mounted; warm the chunk post-hydration; type exports stay `import type`.
- **List rows** `LeadRow`/`GroupRow`/`CalendarTaskRow` are `memo()`-ised — keep their props
  primitive/stable; don't blanket-memo other components.
- **`SectionCard`** wraps every section on a detail page — never inline the chrome.
- **The SW (`public/sw.js`)** never caches RSC payloads, Server Action responses, or navigation
  responses — network-first; only the static shell + icons are cached, and `CACHE_VERSION` must be
  bumped when a cached asset changes.
- **An additive optional prop beats a fork.** `Calendar`'s `onMonthChange`, `Carousel`'s
  `hideControls`, `Table`'s `previewRows`, `AgentSettingsTable`'s `beforeList` — each unblocked a
  new consumer while leaving existing ones byte-identical. That is the sanctioned way to extend a
  shared primitive.

## Decision Log highlights (engineering)

Deals promoted to a first-class table (0072–0074). `after()` + awaited send, never
`void fetch().catch()` (2026-06-08). `redis.del` awaited before `revalidatePath` (P-08). Two-tier RPC
scoping (Q-13, 0102). `/api/elaya/chat` SSE carve-out + the Elaya `maskPii` interim D-01 (2026-06-12).
Responsiveness codified (V-14, 2026-06-12). Deal `deal_type` domain-derived (2026-06-15). Task events and
the 3 oversight RPCs (0144, 2026-06-24). Lead phone canonical-key + active-phone UNIQUE index
(0137). The neumorphic restyle as an additive token layer with a legacy bridge, revertible by one
import line (2026-07-03). `Dialog` portaled to `document.body` (2026-07-02). ESLint added
correctness-only and kept out of the build (2026-07-02). `activity_events` derived-not-double-sourced
for task rows (2026-07-06). Business-minutes response time (2026-07-10). Subscription credentials
encrypted with a Vault key + an audited reveal (2026-08-06/21). The full log with rationale is in
`docs/rules/The_Rules.md`.
