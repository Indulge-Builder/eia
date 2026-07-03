# Claude Code Prompt — Serene Neumorphic FINAL (theme-aware, v4)

Paste this into Claude Code from the repo root, with this handoff folder at `design_handoff_neumorphic_system/` inside the repo.

---

A previous version of this neumorphic handoff was already applied to this codebase (an earlier `serene-neumorphic-tokens.css` and possibly component changes derived from it). This is the FINAL revision — supersede the old one everywhere; where the old values conflict with this package, this package wins.

Read `design_handoff_neumorphic_system/README.md` first — it contains the five design rules, all token values, the theme scope, the motion layer, and a component-by-component inventory. The two `.dc.html` files are high-fidelity references (open in a browser; every element carries exact inline styles). Do NOT copy the HTML — recreate through our React/Tailwind/CSS-variable conventions. Never hardcode hex in components.

## 0. Supersede the previous drop
- Replace the existing `src/styles/serene-neumorphic-tokens.css` wholesale with the one in this folder.
- The old file's depth recipes (offsets 6px/14px "reference") and radii (24px cards) are obsolete: the FINAL feel is **Whisper shadows + Marshmallow radii** — there is exactly ONE depth and ONE radius scale now, shipped as the defaults. Remove any component-level overrides that reproduce old values.
- Audit for stray hardcoded values from the previous pass: shadows containing `0.38`/`0.42` putty alphas or 14px offsets, 24px card radii, and the old rose-hardcoded accent `#D9A0A5` used as a literal — all must resolve to `--neu-*` tokens instead.

## 1. Theme system (the core of this revision)
- All `--neu-accent*` tokens derive from `--theme-accent*`; the tokens file also ships design-approved SOFTENED accent overrides per theme (the stock accents were too heavy for the cream material).
- FINAL theme lineup — EIGHT themes: **earth** (honey gold #D6BC82) · **air** (powder sky #97B5D2) · **water** (seafoam #8FC3B9) · **fire** (terracotta peach #DC9877) · **candy** (soft pink #F0B5D2) · **rose** (English rose #D9A0A5) · **moss** (matcha sage #A9C4A0) · **lilac** (light lilac #C9C0E4).
- **Retire the "martini" theme**: remove its `[data-theme="martini"]` blocks from design-tokens.css, remove it from the ThemeSelector, and migrate any stored user preference for martini → lilac.
- Register rose/moss/lilac as full `[data-theme]` blocks in design-tokens.css (accent triplets in the tokens file) and add them to the ThemeSelector.
- All accents take DARK INK `--neu-accent-fg` on fills — never white (pastels can't hold it).
- Verify: switch all eight themes — accent-role elements re-tint (buttons, selections, washes, focus rings, toggle knobs, single-series progress, primary chart series, unread dots); surfaces/shadows/text stay identical; semantic status chips and multi-series `--domain-*` chart colors do NOT re-tint (see "Theme Scope" in README).
- Dark mode: `data-neu="dark"` warm charcoal block; accents auto-lift lighter via color-mix.

## 2. Structure & components
Follow the five rules and the inventory in README (all sections, 01 Actions through 11 Screens & shell), matching each specimen card to its codebase component. Critical grammar:
- Paired shadows + 1px white hairline on every raised surface; no lone drop shadows, no gray borders.
- Text inputs FLOAT with the gradient sheen + inner top highlight — never sunken.
- Inset marks state only (pressed, toggle/tab tracks, skeletons). Selected = accent wash + lift, never inset.
- Hover: `--neu-shadow-hover` + translateY(-1px), gated `(hover:hover) and (pointer:fine)`. Press: pressed shadow + scale(0.98). Focus-visible: `--neu-focus-ring`.
- Playfair Display 500/600 for display + numbers; Geist for UI; tracked-caps section labels in `--neu-accent-deep`.
- Radii via `--neu-radius-*` only (card 32 / panel 28 / field 22 / tile 18 / chip 14 / pill 999).

## 3. Motion layer (ship it all)
Implement the MOTION appendix in the tokens file:
- `.neu-reveal` scroll-driven card entrance (`animation-timeline: view()`; fallback: IntersectionObserver class-toggle or framer-motion `whileInView` with the same values; must end at `transform: none`).
- `.neu-draw` chart stroke draw-in (`pathLength="1" stroke-dasharray="1"`); `.neu-grow` bars from baseline; `.neu-sweep` progress fills from left. In Recharts approximate with its animation props.
- `.neu-interactive` springy transitions on every clickable (220ms transform `cubic-bezier(0.34,1.3,0.64,1)`, 300ms shadow bloom).
- Idle loops: Elaya breathe 3s · typing dots 1.2s/150ms stagger · ActivityMarquee 30s linear pause-on-hover · MotionButton halo 2.6s · logo twinkle 5s.
- Everything honors `prefers-reduced-motion: reduce`.

## 4. Elaya glyph
The Elaya glyph is the company logo `assets/elaya-glyph-192.png` (gold lotus mandala on near-black), shown as a circular image filling the charcoal disc with the 3s breathe loop — use in elaya-glyph, chat assistant avatar, TypingIndicator avatar, ElayaWidget bubble + header. Tiny inline mentions (< 24px: badge pills, MessageBar sparkle) keep the ✦ character in `--neu-accent`.

## 5. Charts
Recharts restyle via props: warm putty dashed gridlines `rgba(166,156,140,0.22)`, theme accent for the PRIMARY series + fixed pastel family for series 2+, `--domain-*` palette for domain-categorized lines (never theme accent), rounded bar corners in soft tracks, `strokeLinecap="round"` on radial charts, charts inside the raised gradient chart panel (never a well).

## Don'ts
No hardcoded hex; no pure white/black surfaces; no borders-instead-of-highlights; never sink selected states; don't re-tint status chips or domain palettes with the theme; don't change component APIs, data flow, or copy; no depth/radius variants other than the shipped defaults.

Work incrementally: supersede tokens → audit old values → theme registration (incl. martini removal) → ui/ primitives → charts → domain components → screens; type-check and visually verify against the specimen HTML after each group.
