# Handoff: Serene — Polish Layer (refined interactions & micro-motion)

## Overview
Eight refinement patterns that upgrade the Serene app (Indulge Global's concierge CRM) from "nice neumorphic CRM" to a modern, expensive-feeling product: a ⌘K command palette, list choreography, success moments, animated numbers, a tooltip primitive, undo-instead-of-confirm, header condense on scroll, and branded empty states. Builds on the neumorphic FINAL system and the logo/loading handoff — both assumed applied (`--neu-*` tokens, `.neu-*` motion classes, `SeedMandala` component).

## About the Design Files
`Serene Polish.dc.html` is a **design reference created in HTML** — a live, interactive prototype (open in a browser with `support.js` beside it; every behavior is clickable and every element carries exact inline styles). It is not production code. Recreate these patterns inside the existing Serene Next.js codebase (React 19 / App Router, Tailwind v4, CSS variables, framer-motion) using its established components and conventions.

## Fidelity
**High-fidelity.** Colors, shadows, radii, timings and easings are final. Express everything through `--neu-*` tokens — never hardcode hex in components. The two easings used throughout: **spring-out** `cubic-bezier(0.22,1,0.36,1)` and **springy-press** `cubic-bezier(0.34,1.3,0.64,1)` (already in design-tokens as `--ease-*`; map to the nearest existing token).

---

## 01 · Command palette (⌘K) — NEW component
- Global overlay: scrim `rgba(56,51,43,0.28)` + `backdrop-filter: blur(3px)`; panel 640px, radius 28, `--neu-surface`, floating shadow `12px 12px 32px rgba(120,110,92,0.35), -6px -6px 16px rgba(255,255,255,0.5)`, white hairline. Enters with 320ms spring-out rise (opacity 0→1, translateY 10px→0, scale 0.985→1).
- Anatomy: input row (⌕ glyph · bare 15px input · inset `esc` kbd chip) / hairline / scrollable results (max ~300px) / hairline / footer kbd hints (↑↓ navigate, ↵ open) with a right-aligned status slot.
- Results grouped: **Actions** (Ask Elaya, New lead, New task, New note) · **Leads/Deals/Tasks** (live fuzzy search across entities) · **Go to** (pages, with G-key chord hints). Each row: 26px inset icon tile, 14px label, 11px tertiary hint; radius 14.
- Active row (keyboard or hover): `color-mix(in srgb, var(--neu-accent) 16%, transparent)` wash — selection floats, never inset.
- Behavior: ⌘K / Ctrl-K opens anywhere; typing filters and resets selection to 0; ↑↓ move; ↵ executes (navigate or run action); esc closes. Empty result: serif-italic line "Nothing matches — Elaya can look wider." optionally with an Ask-Elaya CTA.
- kbd chip recipe (reused everywhere): 10px 600, padding 3px 8px, radius 7, `--neu-well` bg, inset shadow pair.
- Implement as `CommandPalette.tsx` + a provider hooked into the dashboard layout; search server action can reuse existing lead/task queries (debounced).

## 02 · List choreography — pattern, apply broadly
- Every row addition/removal/completion animates; nothing snaps.
- Enter: max-height 0→row, opacity 0→1, translateY(-8px)→0. Exit: collapse height, fade, translateX(+24px). **380ms spring-out** on height/transform, 320ms ease on opacity.
- In the codebase use framer-motion: `<AnimatePresence>` + `layout` on rows (tasks, notifications, notes, filtered tables, checklist items). The HTML reference implements it with max-height transitions — replicate the *feel*, use motion's height:auto animation.
- Delete affordance: ghost × button, hover → `rgba(217,142,133,0.14)` wash + danger-deep text.

## 03 · Success moments
- **Save morph** (all submit buttons): idle "Save changes" → pending: 17px currentColor SeedMandala spinning 3.5s + "Saving…", opacity .85, cursor wait → success: button re-tints to sage gradient `linear-gradient(145deg,#B8CFAF,#98B58E)` / ink `#26301F`, check draws in (see below), label "Saved" → back to idle after ~1.8s. Extend `Button.tsx` with a `status: 'idle'|'pending'|'success'` prop.
- **Check draw-in** (checkboxes, task tiles, save morph): SVG path `M5 12.5 L10 17.5 L19 6.5`, `pathLength=1`, dasharray 1, dashoffset 1→0, 400–450ms spring-out. Tile flips from inset well to accent gradient + raised shadow simultaneously.
- **Complete ring pulse**: on completion the tile emits one ring — `box-shadow: 0 0 0 0 rgba(--neu-accent, 0.45)` → `0 0 0 20px transparent`, 700ms ease-out, once.
- **Deal won petal fall**: when a deal is marked Won, ~14 gold petals (7–15px, `border-radius: 50% 50% 50% 0`, `linear-gradient(145deg,#E8CFA0,#C08A4E)` — brand-fixed gold, not theme accent) fall through the card: translateY(-12px→230px) + rotate(220deg), fade in at 12%, fade out at end; duration 1.6–2.7s randomized, delay 0–500ms, `forwards`, container `overflow:hidden; pointer-events:none`; DOM removed after 3.2s. **Reserved exclusively for Won** — never reuse for lesser events. Status chip crossfades to Won pastel (`#DCE8D6`/`#5F7D57`, semantic — never theme-tinted).

## 04 · Living numbers
- KPI/stat numbers count up on mount: 1.4s, ease-out-cubic (`1-(1-p)^3`), rAF-driven; format during animation (currency `toLocaleString`, one decimal for %/hours).
- `font-variant-numeric: tabular-nums` on every animated number so digits don't jitter.
- Wrap as `<AnimatedNumber value format />`; use in StatTile, CoreFourGrid/StatAtom, TargetMeter labels, dashboard widgets. Re-run when the underlying value changes (animate from previous value, not 0). Honors reduced motion (jump to final).
- Charts continue to use the shipped `.neu-draw`/`.neu-grow` entrances alongside.

## 05 · Tooltip — NEW primitive
- Charcoal pill on cream: bg `#2D2920`, text `--neu-surface` cream, 11.5px/500, padding 7px 12px, radius 12, shadow `4px 4px 12px rgba(120,110,92,0.35)`, `pointer-events:none`, white-space nowrap.
- Motion: 180ms fade + 5px directional slide (from the trigger side); ~500ms hover intent delay; instant reshow when moving between adjacent triggers. Never on touch/coarse pointers; also show on focus-visible.
- Optional kbd slot: 9.5px chip, `rgba(255,255,255,0.14)` bg, radius 5.
- Required call sites: collapsed 64px sidebar rail (right placement), truncated table cells (top, full text), icon-only buttons (bottom, label + shortcut).
- Build `Tooltip.tsx` on the existing FloatingPanel/portal utilities (no new dependency).

## 06 · Undo, not confirm
- Replace ConfirmDialog for reversible destructive actions (note delete, task delete, filter clear…): the item exits immediately (choreography above) and a charcoal action toast appears: message · **Undo** button (accent text on `rgba(255,255,255,0.1)` pill) · a 2.5px accent **depletion bar** along the bottom edge animating width 100%→0 over **5s linear** — the bar *is* the countdown.
- Undo: cancel timer, item re-enters with the same choreography. Timeout: commit the deletion server-side only then (optimistic-UI pattern).
- Toast enters 320ms spring-out rise. Extend the existing toast system (`toast-item.tsx`) with an `action` + `duration` variant. Keep ConfirmDialog only for truly irreversible operations (user deletion, campaign purge).

## 07 · Header condense on scroll
- Page headers are sticky; past 24px scroll they condense (300ms spring-out on padding/font-size, ease on the rest):
  - title 26px → 17px (Playfair 600 stays), subtitle folds away (opacity→0, max-height→0)
  - padding 24/14 → 12px vertical; bg transparent → `rgba(236,232,225,0.82)` + `backdrop-filter: blur(10px)` + bottom hairline `0 1px 0 rgba(166,156,140,0.22)`
- Drive from the scroll container's scrollTop (threshold + hysteresis or IntersectionObserver sentinel). Apply to PageHeader across list pages (Leads, Deals, Tasks, Notes, WhatsApp). Page actions (PageControls) stay visible in the condensed row.

## 08 · Empty states
- Centered composition on the module's card: 76px SeedMandala (gradient variant, opacity .85) · serif-italic Playfair 22px headline (voice: calm, a touch poetic — reference copy: "Nothing here yet — beautifully so.") · 13px secondary explainer (mention Elaya where she's relevant) · exactly ONE primary action button.
- Watermark: a second mandala, 240px, top-right, bleeding off the corner, opacity 0.08, rotating 120s/rev linear.
- Upgrade the existing `EmptyState.tsx` to this recipe; write module-specific copy per screen (notes, tasks, deals, escalations, helpdesk, notifications).

---

## Interactions & Behavior — global rules
- Hover effects only under `(hover:hover) and (pointer:fine)`; press = scale(0.96–0.98); all clickables keep the `.neu-interactive` springy transition.
- Every animation honors `prefers-reduced-motion: reduce` (jump to end state; petals/pulses skipped entirely).
- Fixed durations: palette rise 320ms · row choreography 380ms · check draw 400–450ms · ring pulse 700ms · tooltip 180ms · number count 1.4s · header condense 300ms · undo window 5s.

## Design Tokens
All from the shipped neumorphic layer: canvas `#ECE8E1` · surface `#F1EDE6` · well `#E9E4DB` · charcoal `#2D2920` (tooltip/toast/scrim family) · text `#38332B`/`#8A8274`/`#ABA396` · accent `var(--neu-accent)` (theme-derived; selection washes via color-mix 16%). Brand-fixed (never theme-tinted): petal gold `#E8CFA0→#C08A4E`, Won chip `#DCE8D6`/`#5F7D57`, sage success gradient.

## State Management
- Palette: provider + keyboard listener in dashboard layout; debounced entity search; recent-items list optional later.
- Undo: optimistic removal + deferred server commit; timer per toast.
- Numbers: animate on mount and on value change; keep previous value as start.
- No new dependencies — framer-motion, existing portals and toast system cover everything.

## Assets
None beyond the SeedMandala component from the logo/loading handoff (`design_handoff_logo_loading_motion/`).

## Files
- `Serene Polish.dc.html` — live interactive specimen, sections 01–08 (each carries a `data-screen-label`). Component mapping: 01 → new `CommandPalette.tsx` · 02 → row patterns in tasks/notifications/tables · 03 → `Button.tsx`, task tiles, `DealCard` · 04 → new `AnimatedNumber.tsx` + `StatTile.tsx` · 05 → new `Tooltip.tsx` · 06 → `toast-provider.tsx`/`toast-item.tsx` · 07 → PageHeader/layout · 08 → `EmptyState.tsx`.
- `support.js` — runtime to open the HTML locally.
