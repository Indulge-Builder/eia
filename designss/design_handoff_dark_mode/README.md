# Handoff: Serene — Dark Mode (warm charcoal)

## Overview
The dark variant of the Serene neumorphic system: **candlelight, not moonlight**. Same single material and top-left light source; the highlight turns candle-warm (`rgba(255,240,214,…)`), accents auto-lift lighter to hold on charcoal, and the gold seed mandala returns to its native ground. The token layer for this ALREADY EXISTS in the codebase (`[data-neu="dark"]` block in `src/styles/serene-neumorphic-tokens.css`) — this handoff is (a) the wiring of the mode switch, (b) a component-by-component verification reference, and (c) a small set of dark-specific design deltas the tokens don't yet capture.

## About the Design Files
`Serene Dark.dc.html` is a **design reference created in HTML** — a live specimen of every component family on the dark material, built against the exact `[data-neu="dark"]` values read from the codebase. Not production code: recreate/verify inside the Serene Next.js codebase using the existing `--neu-*` tokens. Open it in a browser (keep `support.js` beside it); inspect any element for its exact recipe.

## Fidelity
**High-fidelity.** All values match the shipped dark tokens; where the specimen goes beyond them (the deltas below), its values are final.

## Ground rules (already encoded in tokens — verify, don't reinvent)
- Surfaces: canvas `#28241C` · surface `#2D2920` · surface-high `#332E24` · well `#221E17`. Never the retired `#0d0c0a` — neumorphism needs a midtone.
- Shadow pairs: black dark-side + candle highlight `rgb(255 240 214 / 0.04–0.06)`; hairline edge `rgba(255,240,214,0.06)` (strong `0.09`).
- Accents lift: `--neu-accent: color-mix(in srgb, theme-accent 82%, white)`, deep at 66% white; gradient/wash derive from the lifted accent. Accent fg stays the theme's dark ink.
- Text: `#E8E0D4` / `#A39A88` / `#6E675C` (disabled `#55503F`).
- Pastels flip: base darkens for fills, deep lightens for text; chips = `color-mix(pastel 24%, surface)` bg + deep text.
- Inputs still FLOAT: gradient `#332E24 → #2D2920` + inset top highlight `rgba(255,240,214,0.06)` — never sunken.
- Scrim deepens to `rgba(12,10,7,0.5)`; modal shadow `14px 14px 40px rgba(0,0,0,0.55)`.

## Dark-specific design deltas (NEW — not yet in tokens)
1. **Tooltip inverts**: cream pill `#ECE8E1`, ink text `#38332B`, shadow `4px 4px 14px rgba(0,0,0,0.5)`; kbd chip bg `rgba(56,51,43,0.1)`. (Light mode uses charcoal-on-cream; dark flips it.)
2. **Undo/action toast**: sits on `--neu-surface-high` (`#332E24`) with `--neu-shadow-modal`-class elevation and edge-strong hairline — NOT the light mode's `#2D2920` charcoal (invisible on this canvas). Undo pill bg `rgba(255,240,214,0.06)`. Depletion bar stays lifted accent.
3. **Logo/mandala dark variants** (brand-fixed, never theme-tinted):
   - standard: gradient `#5A4426` (top-right) → `#D6AF6E` (bottom-left) — brighter than light mode's `#2B1D10 → #C08A4E` so it carries on charcoal
   - Elaya disc: `#7A5C30 → #E8CFA0`, stroke-width 4, on the `#221E17` glyph disc (deeper than surface so the gold floats)
   - watermark opacity rises 0.08 → **0.10**; boot glow drops to `rgba(214,175,110,0.18)`
4. **Skeleton shimmer**: sweep `#221E17 25% → #332E24 50% → #221E17 75%` (well → surface-high), same 1.8s/150ms stagger.
5. **Command palette**: panel on `--neu-surface-high` with modal shadow; icon tiles/kbd chips inset on `#221E17`.
6. **Chat**: incoming bubbles `#332E24`; user bubbles = accent wash (`color-mix(accent 14%, transparent)`) + hairline; typing dots lifted accent.
7. **Toggle/tab tracks**: `linear-gradient(180deg,#221E17,#2B261E)` inset; active tab pill `linear-gradient(180deg,#3A342A,#2F2A21)`; off-knob `#3A342A`.
8. **Chart**: gridlines `rgba(255,240,214,0.10)` dashed; bars = lifted accent gradient inside inset tracks; numbers stay Playfair `#E8E0D4`.

## Mode switch (the actual engineering)
- `data-neu="dark"` on `<html>` (alongside `data-theme`). Three-state preference: light / dark / system (`prefers-color-scheme`), persisted (same mechanism as theme preference) and applied pre-hydration in `ThemeInitializer` to avoid flash.
- Add the control to Settings ▸ Appearance next to the ThemeSelector (segmented: Light · Dark · Auto).
- `<meta name="theme-color">` swaps `#ECE8E1` ↔ `#28241C`; update `manifest.ts` background likewise.
- All EIGHT theme accents remain available in dark; the lift recipe handles legibility automatically (verified in the specimen's Tweaks switcher).

## Verification checklist (screen-by-screen audit)
For each dashboard screen with `data-neu="dark"` set: no hardcoded light-mode hex leaking (search components for `#ECE8E1`, `#F1EDE6`, `#38332B`, `rgba(166,156,140`, `rgba(255,255,255` literals — all must resolve via tokens); charts re-tint via chart-token file; status chips use the dark chip mixes; images/logos: swap any cream-baked assets. Semantic scope unchanged: status chips + `--domain-*` chart palettes never theme-tint in dark either.

## Files
- `Serene Dark.dc.html` — dark specimen: 01 mark-at-home · 02 actions/toggle/tabs/chips · 03 inputs · 04 tiles/table/chart · 05 feedback (toast, inverted tooltip, skeleton) · 06 chat & Elaya · 07 palette · 08 empty state. Every element carries exact inline values.
- `support.js` — runtime to open the HTML locally.
