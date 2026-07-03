# Claude Code Prompt — Serene Dark Mode

Paste into Claude Code from the repo root, with this folder at `design_handoff_dark_mode/` inside the repo. Prerequisites: neumorphic FINAL system, logo/loading handoff (SeedMandala), and polish layer applied. The `[data-neu="dark"]` token block ALREADY EXISTS in `src/styles/serene-neumorphic-tokens.css` — do not rewrite it; this task is wiring, deltas, and audit.

---

Read `design_handoff_dark_mode/README.md` first. `Serene Dark.dc.html` is the high-fidelity reference for how EVERY component family must look on charcoal — open it in a browser and compare after each step. Do NOT copy the HTML; express everything through the existing `--neu-*` tokens.

## 1. Mode switch
- Apply `data-neu="dark"` on `<html>`. Three-state preference light/dark/system (`prefers-color-scheme` listener for auto), persisted like the theme preference, applied pre-hydration in `ThemeInitializer` (no flash of light).
- Settings ▸ Appearance: segmented Light · Dark · Auto next to ThemeSelector.
- Swap `<meta name="theme-color">` (`#ECE8E1` ↔ `#28241C`) and manifest background dynamically.

## 2. Token deltas (extend the dark block / components)
Add the README's "dark-specific deltas": inverted cream tooltip (`#ECE8E1`/`#38332B`), toast surface → `--neu-surface-high` with modal-class shadow + `rgba(255,240,214,0.06)` undo pill, skeleton shimmer colors (well→surface-high sweep), palette panel on surface-high, chat bubble recipes, toggle/tab track gradients, chart grid `rgba(255,240,214,0.10)`. Prefer new `--neu-*` custom properties in the dark block over per-component conditionals.

## 3. SeedMandala dark variants
Extend the component: when under `[data-neu="dark"]`, default gradient `#5A4426 → #D6AF6E`; Elaya-disc variant `#7A5C30 → #E8CFA0` on the `#221E17` disc; watermark opacity 0.10; boot glow `rgba(214,175,110,0.18)`. Brand-fixed — never theme-tinted. (CSS-variable-driven gradient stops keep it one component.)

## 4. Audit — kill hardcoded light values
Repo-wide search in components for literals: `#ECE8E1 #F1EDE6 #F3EFE8 #E9E4DB #38332B #8A8274 #ABA396 rgba(166,156,140 rgba(255,255,255`. Each must resolve through tokens (add missing token references rather than dark conditionals). Run `pnpm check:tokens`. Charts: verify the chart-token module reads grid/tooltip colors from CSS vars so Recharts re-tints.

## 5. Verify screen-by-screen
With dark on, walk Dashboard, Leads (+ detail), Deals, Tasks, Notes, WhatsApp, Budget, Performance, Settings, Elaya against the specimen: raised surfaces show candle highlight (never gray/blue), inputs float with sheen, selected = accent wash never inset, chips use dark pastel mixes, all 8 theme accents legible (lift recipe), scrims deepen, skeletons sweep. Check both `prefers-reduced-motion` and theme switching while dark.

## Don'ts
- No neumorphism on `#0d0c0a` (retired) · no pure black/white · no cool-toned highlights · no per-component `isDark` branches where a token suffices · semantic chips and `--domain-*` chart palettes still never theme-tint.

Order: switch wiring → token deltas → SeedMandala variants → audit → screen walk. Type-check + `pnpm check:tokens` after each step.
