# Claude Code Prompt — Serene Polish Layer

Paste into Claude Code from the repo root, with this folder at `design_handoff_polish_layer/` inside the repo. Prerequisites already applied: the neumorphic FINAL system (`design_handoff_neumorphic_system/`) and the logo/loading handoff (`design_handoff_logo_loading_motion/` — provides `SeedMandala`). Reuse `--neu-*` tokens and existing motion tokens; add no new dependencies (framer-motion is already installed).

---

Read `design_handoff_polish_layer/README.md` first — it has exact recipes, timings, and component mappings. `Serene Polish.dc.html` is a live high-fidelity reference: open it in a browser and CLICK everything (palette typing/arrows, task add/complete/delete, save morph, mark-won petals, undo toast, scrollable condense frame, hover tooltips). Do NOT copy the HTML — recreate through our React/Tailwind/CSS-variable conventions. No hardcoded hex except the documented brand-fixed values.

Build in this order (each step independently shippable):

## 1. Primitives
- `src/components/ui/Tooltip.tsx` — charcoal pill per README §05, built on our portal utilities; 500ms hover intent, 180ms fade+slide, focus-visible support, disabled on coarse pointers. Wire into: collapsed sidebar rail items, icon-only buttons (PageControls, table row actions), truncated table cells.
- `src/components/ui/AnimatedNumber.tsx` — rAF count-up per README §04 (1.4s ease-out-cubic, tabular-nums, animates from previous value, reduced-motion jumps). Adopt in StatTile, StatAtom/CoreFourGrid, TargetMeter, dashboard KPI widgets.

## 2. Button + success grammar (§03)
- Extend `Button.tsx` with `status: 'idle' | 'pending' | 'success'` — pending shows 17px currentColor SeedMandala (3.5s spin) + progressive label; success re-tints sage + draws the check (path `M5 12.5 L10 17.5 L19 6.5`, pathLength 1, dashoffset 1→0, 400ms) then auto-returns to idle. Migrate existing manual isSubmitting spinners to it.
- Checkbox/task-complete tiles: inset well ↔ accent-gradient flip + check draw + one 700ms ring pulse (`0 0 0 0 → 0 0 0 20px` accent fade).
- `DealCard` Won: petal-fall effect exactly per README (14 gold petals, brand-fixed gradient, randomized 1.6–2.7s, forwards, cleanup after 3.2s, `overflow:hidden pointer-events:none` layer) + chip crossfade to Won pastel. Fire ONLY on transition into Won.

## 3. List choreography (§02)
- Shared row-motion pattern with framer-motion `AnimatePresence` + `layout`: enter (height 0→auto, y −8→0, fade, 380ms spring) / exit (collapse, x +24, fade). Apply to: task lists, notifications panel, notes list, filtered table rows, checklist items. Guard against double-animation with existing `.neu-reveal` cards (row motion wins inside lists; drop `.neu-reveal` on individual rows).

## 4. Undo toasts (§06)
- Extend toast system with `action` + `duration`: charcoal toast, Undo pill (accent text), 2.5px accent depletion bar animating width 100%→0 over 5s linear.
- Convert reversible deletes (notes, tasks) to optimistic-remove + undo; server commit only on timeout. Keep ConfirmDialog for irreversible admin operations only.

## 5. Command palette (§01)
- `src/components/ui/CommandPalette.tsx` + provider in the dashboard layout; ⌘K/Ctrl-K global listener. 640px neumorphic panel (exact recipe in README), scrim + blur(3px), 320ms spring rise.
- Groups: Actions (Ask Elaya, New lead, New task, New note) · entity results (debounced server search across leads/deals/tasks — reuse existing query actions) · Go to (dashboard pages). Keyboard: ↑↓/↵/esc; active row = accent color-mix wash. Empty state line: "Nothing matches — Elaya can look wider."
- Actions route or open the relevant modal (reuse existing create-modal hooks).

## 6. Header condense (§07)
- PageHeader becomes sticky and condenses past 24px scroll: title 26→17px, subtitle folds, blur backdrop + hairline (exact values in README), 300ms. Use a sentinel IntersectionObserver on the dashboard scroll container; apply hysteresis so it doesn't flicker. Roll out to Leads, Deals, Tasks, Notes, WhatsApp, Budget.

## 7. Empty states (§08)
- Upgrade `EmptyState.tsx`: 76px SeedMandala + 240px corner watermark (opacity .08, 120s spin) + Playfair serif-italic headline + one primary action. Write per-module copy (calm, one poetic touch, mention Elaya where relevant).

## Rules
- All timings/easings fixed per README ("global rules" section); everything honors `prefers-reduced-motion`.
- Theme accent only for selection washes, focus, undo bar, ring pulse; petal gold, Won chip, and sage success are brand/semantic-fixed.
- Type-check and visually compare against the specimen HTML after each step; run `pnpm check:tokens` (no stray hex).
