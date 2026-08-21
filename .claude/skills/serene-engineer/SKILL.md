---
name: serene-engineer
description: The Serene engineering method. Use for ANY software task in this repo, no matter the model running it (Opus, Sonnet, or newer): feature, bug fix, refactor, migration, review, debugging, or architecture question. Encodes the full working discipline (orient, search before building, diagnose before fixing, plan at the seam, build in layer order, verify by exercising the flow, record in the changelog) plus the judgment rules that keep output at senior level. Invoke BEFORE writing the first line of code or committing to a diagnosis.
---

# Serene Engineer

This skill is the method. The law lives elsewhere and this skill never overrides it:

- Root `CLAUDE.md`: the command layer, the File Locations registry, the Never-Do list.
- `docs/rules/The_Rules.md`: the constitution (R/A/S/D/P/V/Q rules + Decision Log).
- `docs/design/DESIGN-DNA.md` + `src/styles/design-tokens.css`: design law and values.
- `src/lib/CLAUDE.md`, `src/components/CLAUDE.md`, `src/app/CLAUDE.md`, `supabase/migrations/CLAUDE.md`: layer rules.

When this skill and those files disagree, those files win. What this skill adds is the
thinking process: the order of operations, the judgment calls, and the quality bar that
the rule files assume but do not spell out.

---

## The bar: what a finished piece of work looks like

Hold every task to this before calling it done.

1. **Correct at the seam it touches, and provably so.** You exercised the change
   (typecheck, lint, and where possible drove the real flow), you did not assume it.
2. **The smallest diff that fully solves the ask.** No drive-by refactors, no invented
   scope, no "while I was here" edits. Adjacent problems get named in your final
   message, not silently fixed.
3. **Zero new duplicates.** Every concept in the diff either composes an existing home
   or is a genuinely new behaviour with a new single home. A pasted-and-tweaked module
   is a failure even if it works.
4. **Every claim verified.** Anything you state in your final message (what a function
   does, what a rule says, what a query returns) you checked in this session, with
   `file:line` evidence. Never answer from memory of "how codebases usually work".
5. **Failures reported plainly.** "The build fails with X" beats any hedge. A skipped
   step is stated as skipped. Done means verified done.

---

## The loop: every task, every time

### 1. Orient before anything

- Restate the task in one sentence using the system's real seams ("add a write tool to
  the Elaya write registry that proposes, not executes"), not the user's phrasing.
- Classify the deliverable. A question or a "something looks wrong" report wants an
  **assessment**, not a patch. A bug wants a **verified diagnosis, then a fix**. A
  feature wants a **seam-correct implementation**. Do not fix when asked to explain.
- For codebase questions, run `graphify query "<question>"` first (then `graphify
  explain` / `graphify path` for concepts and relationships). Read raw files to modify
  or debug, or when the graph lacks detail.
- Read the authority files for the touched area: the registry rows in root `CLAUDE.md`,
  the feature-area `CLAUDE.md`, `DESIGN-DNA.md` for any visual call, `design-tokens.css`
  for any value.
- Know where the roadmap is. Current arc: Gia (live) → Elaya (live, Phase 2) →
  **client records (current focus)** → Sia → further modules. New modules are layers:
  they never mutate the base OS or the lead row outside the sanctioned cores. If a task
  smells like it wants to change the foundation, that is a Decision Log conversation,
  not a diff.

### 2. Search by behaviour (R-01): the most-violated law in this repo

Before building anything, list every concept in the task (every component, hook, util,
service call, constant, schema) and search for an existing home **by behaviour, not by
name**: "confirm before delete", not `ConfirmDialog`; "who can I assign this to", not
`getAssignableUsers`.

- Check the repeat-offender table in `The_Rules.md` §0 first, then the File Locations
  registry.
- Write down what you found. Only what has no home gets built.
- Near-match found: extend it (a prop, an option, a parameter) in the same PR. Never
  copy it as a starting point.
- If the changelog records a fork as consolidated, it stays dead (R-04).

### 3. Diagnose before touching (bugs and "X is broken" reports)

- Reproduce or trace the actual failure path end to end before proposing anything.
  A symptom that pattern-matches a known failure may have a different cause; this
  codebase has been burned by confident wrong fixes (see the 2026-07 audit lesson).
- State the mechanism, not the symptom: "wrong totals because `head: true` drops the
  embedded filter at `revival-service.ts:injects`", not "the query is off".
- Check whether the "bug" is actually a logged decision. The Decision Log and
  changelog record many deliberate behaviours that look like bugs (cohort-date
  filtering, absence-is-ON notification prefs, raw campaign names).

### 4. Plan at the seam

- Map each change to its one legal home. Layer order:
  `supabase/migrations` → `lib/constants` → `lib/validations` → `lib/services` →
  `lib/actions` → `components` → `app` routes. Data flows down that chain only.
- When two homes could plausibly own a change, pick the one that makes the next
  duplicate impossible. Deeper wins: a service core over an action body, a shared
  component over a page-local one. That is why lead mutations live in
  `lead-mutations.ts` cores that both UI actions and Elaya tools call.
- Enumerate the blast radius of any mutation before writing it: Redis invalidation,
  `revalidatePath`, activity log row, SLA hooks, notifications. If you are writing
  those ripples by hand, you are almost certainly outside the core that already owns
  them. Get inside it.
- A plan that needs a rule exception stops here: Decision Log entry first, code second.

### 5. Build in layer order

Per-layer non-negotiables (the full lists live in the layer CLAUDE.md files):

- **Migration:** RLS enabled, append-only posture for logs, never edit a run migration,
  `SECURITY DEFINER` sets `search_path`, scope per the Q-13 two-tier model.
- **Service:** owns every query; session client vs `createAdminClient()` chosen per
  Q-13; `mapRows()` at untyped boundaries; `Number()` on bigint counts; cache keys
  carry every scoping dimension (domain, user, role).
- **Action:** `requireProfile(roles?)` first, Zod parse second (via
  `parseActionInput` where it fits), returns `{ data, error }`, never throws;
  `sanitizeText()` / `normalizeToE164()` before any write; cache invalidation awaited
  before revalidation (`invalidateLeadCaches` for leads); outward sends inside
  `after()` with the send awaited.
- **Component:** display-only; tokens only; `import { m as motion }`; portal-based
  overlays via the existing primitives; every colour, z-index, duration, easing from
  the system.
- **AI paths:** any model call goes through the Elaya provider layer
  (`lib/elaya/provider.ts` + registry) and `maskPii()`. Never a new SDK import, never
  raw PII to a model, fail closed on uncertain verdicts.

### 6. Verify by exercising, not by reading

- `pnpm typecheck` (or `tsc --noEmit` per project scripts) and `pnpm lint` at minimum.
- Drive the changed flow when it has a runtime surface: the action's success AND error
  branch, the empty state, the loading state.
- UI changes: check at least Earth plus one other theme, light and dark
  (`data-neu="dark"`), and one narrow viewport. The responsive contract (V-14) breaks
  silently otherwise.
- After code changes, run `graphify update .` to keep the knowledge graph current.

### 7. Record

- Every meaningful change gets a `docs/changelog.md` entry, "why" first, then "what
  changed" with file paths (match the existing entry format, newest at top).
- A new canonical implementation ("THE x") gets its registry row in the relevant
  `CLAUDE.md`.
- A rule change or exception gets a Decision Log row in `The_Rules.md`. No silent
  exceptions, ever.

---

## Judgment rules: deciding when the docs are silent

- **Evidence beats pattern-match.** Before any state-changing step, confirm the
  evidence supports that specific action, not just a familiar-looking failure shape.
- **Never invent a value.** No new token, colour, copy string, domain label, status,
  or magic constant. If it does not exist in the system, that absence is a question
  for the user or a Decision Log entry, not an improvisation.
- **Prefer boring.** The codebase already made its choices (no React Query, no new API
  routes, `@dnd-kit`, Trigger.dev for heavy async). Novelty is a cost you must justify
  in the changelog; usually you should not pay it.
- **Fail in the documented direction.** AI gates fail closed (revival gate → `unsure`,
  confirmation resolver → cancel). Notification prefs fail open (absence = ON). Copy
  the posture of the seam you are in; never flip one silently.
- **Ask only when genuinely blocked.** Missing intent you cannot infer: ask. Anything
  discoverable in the repo, the graph, or the docs: discover it yourself.
- **Respect the append-only spine.** Activity, logs, ledgers: no UPDATE/DELETE outside
  the four logged A-11 exceptions. History is the product's trust layer.

---

## Traps that have actually bitten this codebase

These are not hypotheticals; each one caused a real incident or audit finding. If your
diff contains one, it is wrong.

| Trap | The rule that exists because of it |
| --- | --- |
| `void fetch().catch()` for an outward send | Vercel freezes the lambda on flush; sends vanish silently. `after()` + awaited send (A-16) |
| `void redis.del().catch()` before `revalidatePath` | Race evicts a fresh entry. Await in try/catch first; leads via `invalidateLeadCaches` (P-08) |
| Deleting only one lead-row cache key | Rows are dual-keyed (`leadRowSlug` + `leadRowId`); the helper owns both |
| `unstable_cache` around a session-client service | `createClient()` reads `cookies()`; runtime throw. React `cache()` instead (P-09) |
| Cache key missing a scoping dimension | A manager and an admin shared a dashboard slot until role was added (Q-16) |
| `import { motion } from 'framer-motion'` | LazyMotion strict throws in dev; always `{ m as motion }` (A-17) |
| `position: fixed` inside a `motion.div` | Transform creates a containing block; use `usePortalAnchor` + `FloatingPanel` / `ConfirmDialog` |
| `--z-modal-overlay` under a standalone dialog | Backdrop covers the panel and eats every click; compose `ConfirmDialog` |
| Inline `gridTemplateColumns` next to `md:` classes | The inline style wins at every width (the campaign-strip bug, V-14) |
| `head: true` on a query with an embedded filter | Supabase drops the embed; counts go wrong (revival service lesson) |
| Raw hex, `text-gray-*`, `bg-white`, `font-bold` | V-01/V-04; the token system is the only palette |

---

## Output contract: how to report

- **Lead with the outcome.** First sentence answers "what happened" or "what did you
  find". Reasoning and detail come after.
- Reference code as `file:line` so it is clickable.
- Complete sentences, technical terms spelled out, no invented shorthand the reader
  has to decode. Selective beats compressed.
- Anything the user must know (failures, skipped steps, decisions you made on their
  behalf, adjacent problems you noticed) goes in the final message explicitly.
- Serene docs (changelog, module docs, anything under `docs/`) are written in simple
  English, human tone, no em-dashes.

---

## Definition of done

- [ ] R-01 search performed and its findings stated (what was reused, what was new)
- [ ] Every change sits in its one legal home; data flows constants → validations → services → actions → components
- [ ] Actions: `requireProfile` + Zod first, `{ data, error }` return, sanitize/normalize before writes
- [ ] Mutation ripples handled by the owning core/helper, not hand-rolled
- [ ] Typecheck + lint clean; flow exercised; both result branches handled
- [ ] UI: tokens only, themes + dark + narrow viewport checked
- [ ] `docs/changelog.md` entry written; registry/Decision Log updated if applicable
- [ ] `graphify update .` run
- [ ] Final message leads with the outcome and reports anything skipped or failing
