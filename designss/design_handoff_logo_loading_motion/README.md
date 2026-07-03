# Handoff: Serene — Logo, Loading & Boot Motion System

## Overview
The loading/waiting layer of the Serene app (Indulge Global's concierge CRM), built entirely around the company logo — the **seed mandala**. One boot sequence (draw → breathe → turn → glow) is the source of truth; every other waiting state in the app (spinners, button loading, Elaya thinking, skeletons, route transitions) is a smaller quotation of it. This supersedes the generic arc `Spinner` and any old lotus/mandala rendering.

## About the Design Files
`Serene Loading.dc.html` is a **design reference created in HTML** — a living prototype showing intended look and behavior, not production code to copy. Recreate it inside the existing Serene Next.js codebase (React 19 / App Router, Tailwind v4, CSS variables in `src/styles/design-tokens.css` + `serene-neumorphic-tokens.css`, framer-motion) using the established `--neu-*` conventions from the neumorphic handoff already applied. Open the HTML in a browser (keep `support.js` beside it); every element carries exact inline styles.

## Fidelity
**High-fidelity.** Geometry, colors, timings and easings are final. Recreate pixel-perfectly through tokens — never hardcode hex in components.

## The Logo — exact construction (CRITICAL, get this right)
The brand mark is a seed-of-life rosette. Its construction rule:

- **8 identical circles**, radius `r`, stroke only (no fill).
- Circle centers sit on a ring of radius **exactly `r`** around the mark's center, at 45° increments (starting at −90°, i.e. 12 o'clock).
- Because center-distance == radius, **every circle passes through the exact center point**. Their crossings there form the small 8-petal seed flower — this is the signature of the mark. If the middle looks like a mess of arcs instead of a clean 8-petal flower, the offset ≠ radius and it is WRONG.
- Reference implementation (from the prototype's logic): viewBox `0 0 200 200`, center (100,100), `r = offset = 46`, `stroke-width: 2.2` (≈1.1% of the box; scale proportionally).
- **Gradient:** one linear gradient across the whole mark (not per circle), from dark umber `#2B1D10` at top-right to warm gold `#C08A4E` at bottom-left (`x1=1 y1=0 → x2=0 y2=1`). This makes the top-right circles fade toward the background — intentional, matches the brand asset.
- Build it **procedurally in SVG** (a `SeedMandala` component that emits 8 `<circle>` elements) — do not trace paths by hand. Raster brand assets are in `assets/` for visual comparison and for places that need an image (favicons, dark Elaya disc).

Variants used:
- `gradient` (default): the umber→gold gradient above.
- `currentColor`: single-color strokes for tiny inline sizes (buttons), stroke-width ~7 in the 200 box so it survives at 18px.
- `dark-disc`: gradient `#E8CFA0 → #C08A4E`, stroke-width 4, used on the charcoal Elaya disc.

## The Boot Sequence (hero loading screen)
Full-screen app boot, on canvas `#ECE8E1` (`--neu-canvas`):
1. **Draw** — each of the 8 circles traces in with `pathLength="1"; stroke-dasharray: 1; stroke-dashoffset: 1 → 0`, 1.15s `cubic-bezier(0.22,1,0.36,1)`, staggered **90ms** per circle (total ≈ 1.9s). Mark size 190px.
2. **Breathe** — from 2.6s: scale 1 → 1.035 → 1, 4s ease-in-out, infinite.
3. **Turn** — the whole mark rotates continuously, **90s/revolution**, linear (barely perceptible). Breathe wraps the spin (two nested elements) so the transforms compose.
4. **Glow** — 420px radial wash behind the mark: `radial-gradient(circle, rgba(214,188,130,0.28) 0%, transparent 65%)`, opacity 0.25 → 0.6 → 0.25 over 4s, **in phase with the breath**.
5. **Wordmark** — "SERENE", Playfair Display 600, 26px, letter-spacing animates 0.1em → 0.42em with opacity 0→1, 1.4s `cubic-bezier(0.22,1,0.36,1)`, delay 1.5s. Tagline "Attending to every detail" (Geist 12px, `#ABA396`) fades up 8px at delay 2.1s.
6. **Progress shimmer** — 220×8px inset pill track (`#E4DFD6`, `--neu-shadow-inset`), a 35%-wide sweep of `linear-gradient(90deg, transparent, var(--neu-accent), transparent)` crossing left→right, 1.6s `cubic-bezier(0.4,0,0.2,1)`, infinite, starting at 2.4s.

All infinite animations honor `prefers-reduced-motion: reduce` (kill animations, show the finished mark + static text).

## Loading Elements (the quotations)
- **LogoSpinner** — replaces the arc `Spinner` component everywhere. Mark spins **3.5s/rev linear**. Sizes: `lg` 38px mark in a 56px inset cream well; `md` 27px in a 40px well; `sm` 24px bare (no well). Wells: `#F1EDE6` + `--neu-shadow-inset`.
- **Button loading state** — 18px `currentColor` mark spinning 3.5s inside the button, label swaps to progressive verb ("Placing request…", "Saving…"), cursor `wait`, primary button drops to opacity 0.85. Layout: flex, 10px gap.
- **Elaya thinking** — 30px `dark-disc` mark spinning slowly (**8s/rev**) on the 44px charcoal disc (`#2D2920`), beside the existing typing bubble (3 accent dots, 1.2s hop, 150ms stagger). The disc replaces the static glyph while she thinks.
- **PageSkeleton** — shimmer sheen replaces the opacity pulse: bars/tiles get `linear-gradient(90deg, #E9E4DB 25%, #F3EFE8 50%, #E9E4DB 75%)`, `background-size: 200% 100%`, background-position −200% → 200%, 1.8s linear infinite, 150ms stagger per element. A **watermark mark** sits top-right of the skeleton region: 150px, opacity 0.10, rotating 40s/rev.
- **Route transition veil** — a cream veil (`linear-gradient(180deg,#F1EDE6,#E9E4DB)`) rises from the bottom over the outgoing page with a 56px spinning mark centered, holds, then lifts off the top. Full cycle 2.6s, `cubic-bezier(0.65,0,0.35,1)`. Use for full-page route changes only.

## Interactions & Behavior
- Boot sequence plays once per app load; the mark then persists into the shell if the layout allows (nice-to-have, not required).
- Spin speeds are fixed: boot 90s · spinners/veil/buttons 3.5s · Elaya 8s · watermark 40s. Never faster than 3.5s/rev — the mark should feel calm, not busy.
- Draw animation is reusable: expose a `draw` prop on `SeedMandala` (used by boot and any first-reveal of the mark).

## State Management
- `LogoSpinner` is stateless. Button loading driven by existing pending/mutation state. Veil driven by route-change events (App Router navigation start/complete). Boot screen shows until the app shell's first data is ready.

## Design Tokens (all pre-existing in the neumorphic layer)
Canvas `#ECE8E1` · surface `#F1EDE6` · well `#E9E4DB` · text `#38332B`/`#8A8274`/`#ABA396` · accent = theme-derived `var(--neu-accent)` (earth gold `#D6BC82` reference) · shadows/radii per `serene-neumorphic-tokens.css`. Logo gradient colors (`#2B1D10`, `#C08A4E`, `#E8CFA0`) are **brand-fixed — they do NOT re-tint with the theme**; only the glow wash and progress sweep use the theme accent.

## Assets
- `assets/serene-seed-mandala-1254.webp` — master brand asset, gold on near-black, 1254×1254 (visual reference for the procedural mark).
- `assets/serene-seed-mandala-192.png` — small raster, for favicon/disc image uses.
- A transparent line-only (black strokes) version of the logo exists with the brand team — request it for print/light-image contexts; in-app, always prefer the procedural SVG.

## Files
- `Serene Loading.dc.html` — the full specimen (hero boot screen, sequence anatomy, all loading elements). Section labels map to components: LogoSpinner → `src/components/ui/Spinner.tsx` (replace), Button loading → `src/components/ui/Button.tsx`, Elaya thinking → `TypingIndicator` / `elaya-glyph`, PageSkeleton → `src/components/ui/PageSkeleton.tsx`, veil → route transition layer.
- `support.js` — runtime needed to open the HTML locally.
