# Claude Code Prompt — Serene Logo, Loading & Boot Motion

Paste into Claude Code from the repo root, with this folder at `design_handoff_logo_loading_motion/` inside the repo. Assumes the neumorphic FINAL handoff (`design_handoff_neumorphic_system/`) is already applied — reuse its `--neu-*` tokens; add nothing that duplicates them.

---

Read `design_handoff_logo_loading_motion/README.md` first. `Serene Loading.dc.html` is a high-fidelity reference (open in a browser; every element carries exact inline styles). Do NOT copy the HTML — recreate through our React/Tailwind/CSS-variable conventions.

## 1. SeedMandala component (do this first, get the geometry exact)
Create `src/components/ui/SeedMandala.tsx`, procedural SVG:
- viewBox `0 0 200 200`; **8 `<circle>`s, r=46, centers on a ring of radius 46** around (100,100) at 45° steps starting at −90°. Center-distance MUST equal radius — that is what makes the clean 8-petal flower at the middle. Do not eyeball it; compute `cx = 100 + 46·cos(θ)`, `cy = 100 + 46·sin(θ)`.
- Default stroke: single linearGradient across the whole mark, `#2B1D10` (top-right) → `#C08A4E` (bottom-left), stroke-width 2.2, fill none, `overflow: visible`.
- Props: `size` · `variant: 'gradient' | 'currentColor' | 'darkDisc'` (`currentColor` uses stroke-width 7 for <24px sizes; `darkDisc` uses gradient `#E8CFA0 → #C08A4E`, stroke-width 4) · `draw?: boolean` (each circle `pathLength={1}`, dasharray 1, dashoffset 1→0, 1.15s `cubic-bezier(0.22,1,0.36,1)`, 90ms stagger) · `spin?: number` (seconds/rev, linear infinite).
- Unique gradient ids per instance (useId). Brand gradient colors are fixed — never theme-tinted.
- Replace any previous lotus/mandala SVG or component from earlier passes — this geometry supersedes it.

## 2. Boot screen
`AppBootScreen`: full-viewport on `--neu-canvas`, centered column, gap 34px:
mark 190px (`draw`, then breathe scale 1→1.035 4s ease-in-out infinite from 2.6s, wrapping a 90s/rev spin — two nested wrappers so transforms compose) · 420px radial accent glow behind it pulsing opacity .25→.6 over 4s in phase with breath · "SERENE" Playfair 600 26px letter-spacing animating .1em→.42em (1.4s, delay 1.5s) · tagline "Attending to every detail" fading up (delay 2.1s) · 220×8 inset progress track with accent sweep (35% width, 1.6s, from 2.4s). Show until first shell data resolves.

## 3. Loading elements
- **Replace `Spinner` with `LogoSpinner`** everywhere (grep all Spinner usages): sizes lg 38-in-56-well / md 27-in-40-well / sm 24 bare; wells = `--neu-surface` + `--neu-shadow-inset`; spin 3.5s/rev.
- **Button pending state**: 18px `currentColor` mark spinning 3.5s + progressive-verb label, cursor wait, primary at opacity .85.
- **Elaya thinking**: while pending, the 44px charcoal disc shows a 30px `darkDisc` mark spinning 8s/rev (replaces static glyph), next to the existing typing-dots bubble.
- **PageSkeleton**: swap opacity pulse for left→right shimmer (`#E9E4DB/#F3EFE8/#E9E4DB` 200% background sweep, 1.8s linear, 150ms stagger) + top-right watermark mark 150px at opacity .10 rotating 40s/rev.
- **Route veil**: cream gradient veil rises over outgoing page with a 56px spinning mark, holds, lifts away (2.6s total, `cubic-bezier(0.65,0,0.35,1)`), wired to App Router navigation events.

## 4. Rules
- Spin speeds fixed (90s boot / 3.5s spinners / 8s Elaya / 40s watermark); never faster than 3.5s/rev.
- Everything honors `prefers-reduced-motion: reduce` (finished static mark, no loops).
- No hardcoded hex outside the three brand gradient stops — everything else via `--neu-*` tokens; theme accent only tints glow + progress sweep, never the mark's strokes.

Work incrementally: SeedMandala (verify against `assets/serene-seed-mandala-1254.webp` side-by-side) → boot screen → LogoSpinner swap → button/Elaya/skeleton/veil; type-check and visually compare with the specimen HTML after each step.
