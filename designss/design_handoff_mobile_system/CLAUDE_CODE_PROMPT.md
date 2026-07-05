# Claude Code Prompt — Serene Mobile System (soft UI, mobile layer)

Paste this into Claude Code from the repo root, with this handoff folder at `design_handoff_mobile_system/` inside the repo.

---

This package adds the **MOBILE layer** of the Serene neumorphic system. It assumes the base neumorphic package (`design_handoff_neumorphic_system/` — `serene-neumorphic-tokens.css`, the five design rules, the 8-theme accent system, Whisper depth + Marshmallow radii, motion layer) is already applied to this codebase. Do not re-derive tokens here; consume `--neu-*` everywhere. If the base package is not yet applied, apply it first.

Read `design_handoff_mobile_system/README.md` fully — it contains the navigation architecture, mobile scale rules, token restatement, a section-by-section component inventory, and three reference screens. `Serene Mobile.dc.html` is the high-fidelity specimen (open in a browser; every element carries exact inline styles; the tab bar, drawer, sheet, chips, toggle and stepper are live). Do NOT copy the HTML — recreate through our React/Tailwind/CSS-variable conventions. Never hardcode hex.

## 1. Navigation architecture (implement first)
- Bottom tab bar: floating raised pill, height 64, floats 16px off the bottom safe area. EXACTLY four routes — Home, Requests, Activity, Profile. Active route = raised accent-gradient tile 46×46 r16 with ink fg; inactive = quiet glyph. Do not add a fifth route, ever.
- Elaya center knob: 52–54Ø circular accent-gradient knob riding above the bar (offset −20/−22), ✦ glyph, opens the Elaya chat surface. It is not a tab; it has no active state. Every cell/knob in the bar needs `flex-shrink: 0`.
- Drawer: the **company mark is the drawer button** — top-left 44Ø raised knob, mark stroked in `--neu-accent-deep` (9-circle geometry in README; source `export/vanilla/indulge-confirm.js`). No hamburger icons anywhere in the app.
  - Panel 76% width, `border-radius 0 30px 30px 0`, slide-in 380ms `cubic-bezier(0.22,1,0.36,1)`, scrim `rgba(56,51,43,0.30)` + blur(2px), scrim-tap + swipe-left dismiss.
  - Content: profile row → ROOMS (Global/House/Shop/Legacy, icon tiles + counts) → THE HOUSE (Documents, Preferences, Reach the house) → footer Sign out in clay. Rows ≥44px touch, accent-wash hover/press.
- Route map: bar = the four everyday rooms; drawer = verticals + quiet pages + profile/sign out. Profile may appear on both ONLY as the bar's fourth room (per specimen); sign out drawer-only.

## 2. Mobile scale (hard constraints)
- Touch: primary 56 · secondary/field 52 · icon knob 44 minimum · list row 64 · tab bar 64 · FAB 60. Reject any interactive element under 44.
- Layout: 20px edge padding, 14px card gap, radii card 24 / tile 18 / field 16 / pill; sheet top radius 30; one scroll axis per screen.
- Type: Playfair 26/600 greeting, 20–22/600 screen titles, ALL numbers Playfair; Geist body 13.5/1.55 (floor 13), secondary 12, tracked-caps labels 11/600 0.12–0.16em with padding-left compensation.

## 3. Components (match specimens, section by section)
02 app bars (detail / home / large-greeting) · segmented control (inset track, raised thumb) · filter chips (selected = accent wash + accent border + check, sinks slightly) · 03 floating fields (search pill keeps cream surface — accent only on the search icon (accent-deep) and trailing ✦ (accent)) · setting rows with toggle (54×32, accent wash track when on) / stepper / disclosure · button set incl. sticky quiet+primary pair (flex 1 / 1.6) · 04 request rows with the status-dot language (sage settled · accent-breathe waiting-on-you · clay needs-attention) · vertical tiles 2×2 (Global powder / House sage / Shop butter / Legacy lilac) · inset progress + accent sweep · toast pills · placing-request loader (✦ halo + dots) · 05 bottom sheet (grabber 44 touch, 420ms rise) · action sheet (rows 54, destructive in clay never red, cancel as separate raised pill).

## 4. Screens
Compose Home, Request detail (route card + THE THREAD timeline: accent check discs, putty connector, breathing current dot, butler-voice timestamps), and Elaya chat (raised Elaya bubbles r 20/20/20/6, accent-grad user bubbles r 20/20/6/20 with ink fg, halo'd ✦ header, floating composer + send knob) exactly per README and specimen.

## 5. Motion & feel
Interactive spring on every touchable (transform 220ms `cubic-bezier(0.34,1.3,0.64,1)`, shadow 300ms `cubic-bezier(0.22,1,0.36,1)`; press = pressed inset + scale 0.98, knobs 0.94). Entrance `neuRise` scroll/in-view. Drawer 380ms / sheet 420ms. Idle: dot breathe 2.2–2.6s, Elaya halo 3–3.4s, typing dots 1.3s stagger 0.18s. All gated by `prefers-reduced-motion`.

## 6. Theming
Accent is theme-derived (8 themes, earth default). Verify on mobile surfaces: switching theme re-tints active tab tile, Elaya knob, toggles, chips, progress, user chat bubbles, search ✦, mark stroke, drawer washes — surfaces/shadows/status colors never change. Accent fills always take dark ink fg.

## Don'ts
No hamburger. No fifth tab. No hardcoded hex. No tinted field surfaces. No red destructive (clay `#B06A61`). No lone drop shadows or gray borders. Never sink selected states (inset = pressed/track/skeleton only). No emoji; no exclamation marks in copy; requests, never tasks.

Work incrementally: navigation shell (bar + knob + drawer) → fields/controls → content components → overlays → the three screens; type-check and visually compare against `Serene Mobile.dc.html` after each group.
