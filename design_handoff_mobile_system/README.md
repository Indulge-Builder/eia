# Handoff: Serene Mobile System (Soft UI / Neumorphic — mobile layer)

## Overview
The complete mobile UI system for the Indulge client app in the Serene neumorphic ("soft UI") language: mobile scale + anatomy rules, navigation architecture (bottom bar + logo-drawer), core mobile components, overlays, and three full reference screens (Home, Request detail, Elaya chat).

This package **builds on** `design_handoff_neumorphic_system/` (tokens, five design rules, theme system, motion layer). That package is the base material; this one is the mobile grammar on top of it. Where a value is not restated here, the neumorphic tokens package wins.

## About the Design Files
`Serene Mobile.dc.html` is a **design reference created in HTML** (open it in a browser; `support.js` must sit beside it). Every element carries exact inline styles. It is a prototype showing intended look and behavior — **not production code**. Recreate these designs in the target codebase's existing environment (React/Tailwind/CSS-variable conventions per the base package), using `--neu-*` tokens — never hardcoded hex.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, shadows, motion and copy are final. Recreate pixel-perfectly with the codebase's established patterns.

---

## Navigation architecture (the core decision)

- **Bottom bar = the four everyday rooms + Elaya.** Exactly four stateful tabs — Home, Requests, Activity, Profile — never more. The bar is a floating raised pill (height 64, `--neu-radius-pill`), floating ~16px off the bottom edge. Active tab rides a **raised accent tile** (46×46, r16, accent gradient, ink fg); inactive tabs are quiet glyphs in `--neu-text-secondary`.
- **Elaya holds the center**: a lifted circular knob (54Ø in components, 52Ø on the 352px screen; margin-top −22/−20 so it rides above the bar), accent gradient, ✦ glyph, ink fg. Implementation flag `elayaKnob` (boolean) collapses her to a flat fifth cell — ship the knob as default.
- **Drawer = everything else, behind the mark.** The **company logo is the drawer button** — top-left knob (44Ø, raised, mark stroked in `--neu-accent-deep`). No hamburger anywhere.
  - Panel: 76% width, full height, left-anchored, `border-radius: 0 30px 30px 0`, right hairline `rgba(255,255,255,0.6)`, shadow `12px 0 30px rgba(72,64,52,0.32)`.
  - Slide-in: `translateX(-105%) → none`, 380ms `cubic-bezier(0.22,1,0.36,1)`. Scrim `rgba(56,51,43,0.30)` + `backdrop-filter: blur(2px)`; scrim tap dismisses.
  - Content order: profile row (avatar 38Ø + name + email) · divider · `ROOMS` label · Global / House / Shop / Legacy rows (icon tile + label + count, 44px min height in production) · `THE HOUSE` label · Documents / Preferences / Reach the house · footer (margin-top auto): divider + **Sign out** in clay `#B06A61` (hover wash `rgba(217,142,133,0.12)`).
  - Row hover/press: accent wash `--neu-accent-wash`; row radius 13–14.
- Profile & sign out live in the drawer, never on the bar.

## The mark (drawer button + Elaya-adjacent glyph)
9 circles, always **stroked, never filled**: viewBox `0 0 192 192`, one circle at (96,96) r34 + a ring of 8 at distance 37, angles `11.25° + k·45°` → centers (132.29,103.22) (116.56,126.76) (88.78,132.29) (65.24,116.56) (59.71,88.78) (75.44,65.24) (103.22,59.71) (126.76,75.44), all r34. Rendered 19–21px inside a 40–44Ø raised knob, `stroke: var(--neu-accent-deep)`, stroke-width 10 (viewBox units ≈ 1.1px rendered). Source of truth: `export/vanilla/indulge-confirm.js` CIRCLES.

---

## Mobile scale & anatomy

**Touch scale (hard rules)**
- Primary button **56** · secondary button / field **52** · icon knob **44 floor** (nothing touchable smaller) · list row **64** · tab bar **64** · FAB **60**.

**Screen anatomy**
- Edge padding **20**, always. Gap between cards **14**.
- Radii: card **24** · tile **18** · field **16** · chips/bars **pill (999)**. Screen corners 42 (device), sheet top radius **30**.
- Safe areas: status 54 · home indicator 34 (indicator: 120×5 pill `rgba(56,51,43,0.18)`).
- One scroll axis; depth does the layering, never overlap.

**Mobile type ramp** (Playfair Display = display + ALL numbers; Geist = UI)
- Greeting: Playfair 26/600 · screen title: Playfair 20–22/600 · card title: Geist 15/600
- Body: 13.5 / 1.55 (never below 13) · secondary: 12 · tracked label: 11/600, letter-spacing 0.12–0.16em, in `--neu-accent-deep` (section) or `--neu-text-secondary`
- Numbers/times always Playfair 600 (e.g. 09:00 at 24).

## Design tokens (restated for convenience — canonical in base package)
- Surfaces: canvas `#ECE8E1` · surface `#F1EDE6` · surface-high `#F3EFE8` · well `#E9E4DB`. Text: ink `#38332B` · secondary `#8A8274` · tertiary `#ABA396`. Hairline: `rgba(255,255,255,0.55–0.65)` on every raised surface. Shadow putty: `rgb(166 156 140)`.
- **Whisper depth (the only depth):** raised-sm `2px 2px 6px …0.24 / −2 −2 6 white 0.65` · raised `3 3 8 …0.26 / −3 −3 8 …0.70` · panel `6 6 16 …0.28 / −6 −6 16 …0.75` · input `3 3 8 …0.22 / −3 −3 8 …0.70 + inset 0 1px 0 rgba(255,255,255,0.85)` (fields FLOAT with gradient sheen `linear-gradient(180deg,#F6F3EC,#F0ECE4)`) · inset `inset 2 2 5 …0.32 / inset −2 −2 5 white 0.75` · pressed `inset 2 2 4 …0.35 / inset −2 −2 4 …0.60` · hover `5 5 12 …0.30 / −5 −5 12 …0.80`.
- Device bezel (specimens only): outer `#F1EDE6` r52, padding 12, shadow `10px 10px 26px rgba(120,110,92,0.34), −8 −8 22 rgba(255,255,255,0.9)`.
- **Accent = theme-derived**, 8 themes, earth default (honey gold `#D6BC82`, deep `#8A7448`, fg ink `#33290F`, grad `linear-gradient(145deg,#DFC996,#C8AC6E)`, wash 16%). Full 8-theme table in the base package. Accent fills always take dark ink fg.
- Pastel support (icons on `#F3EFE8` tiles use the -deep values): sage `#A9C4A0`/`#7E9B76` · powder `#A3BFD6`/`#7797B3` · butter `#E3CB96`/`#B39C63` · lilac `#B3A9D4`/`#8A7FB0`. Danger/clay `#D98E85` text-deep `#B06A61`.
- Vertical → color: Global powder (plane) · House sage (home) · Shop butter (bag) · Legacy lilac (landmark).

## Motion
- Interactive spring on every clickable: `transform 220ms cubic-bezier(0.34,1.3,0.64,1)`, `box-shadow 300ms cubic-bezier(0.22,1,0.36,1)`. Hover: hover-shadow + translateY(−1px) (gated `hover:hover, pointer:fine`). Press: pressed inset + `scale(0.98)` (knobs 0.94).
- Entrances: `neuRise` (translateY 26 → none) scroll-driven `animation-timeline: view()` range `entry 0% → 38%` (IntersectionObserver fallback).
- Drawer 380ms from left · bottom sheet 420ms from bottom (`translateY(105%)`), both `cubic-bezier(0.22,1,0.36,1)`.
- Idle: status-dot/knob breathe 2.2–2.6s · Elaya halo 3–3.4s (`box-shadow` ring 0→12px fade) · typing dots 1.3s, 0.18s stagger · progress `neuGrowX` sweep from left.
- Everything honors `prefers-reduced-motion: reduce`.

## Sections / components inventory (match each specimen card)

**01 · Scale & anatomy** — reference cards only (touch scale, type ramp, anatomy diagram).

**02 · Navigation**
- **App bars**: detail bar (back knob 44 · tracked-caps title `REQUEST · GLB-4217` 11/600 0.18em · ··· knob) · home bar (**mark knob** left · SERENE wordmark Playfair 14/600 0.3em center · bell knob with accent unread dot) · large greeting block (tracked date label in accent-deep · Playfair 24–25 greeting · secondary line). Titles never truncate.
- **Tab bar · live** and **Drawer · live** — see Navigation architecture above.
- **Segmented control**: inset well track (pill, padding 7) + raised surface thumb (44 cells); labels 13, active ink 600 / inactive tertiary 500.
- **Filter chips**: 38 pills; selected = accent wash bg + 1px accent border + slight inner inset + check glyph, accent-deep 600 text; unselected = raised-sm surface.

**03 · Controls & input**
- Fields: search pill 48 (icon in **accent-deep**, trailing **✦ in accent** — field surface stays cream, never tinted) · text field 52 r18 · textarea r18 · select row 52 with chevron. All float (input shadow + top highlight); labels tracked 11/600 above.
- Row controls: setting rows 64 r22 on `#F3EFE8` — toggle (54×32 inset track; on = accent wash track + accent-grad knob at left 26; off = well track + surface knob at left 4; knob 24Ø, left transition 220ms spring) · stepper (40Ø knobs, Playfair count) · disclosure row (icon tile 38 + title + sub + chevron).
- Buttons: primary 56 accent-grad pill (15/600 ink) · secondary 52 surface pill · quiet 44 text-only (`--neu-text-secondary`) · FAB 60Ø accent · icon knob 48/44 · pressed = inset + scale. Sticky pair: quiet flex 1 / primary flex 1.6.

**04 · Content & feedback**
- Request row: 68 min, r22 `#F3EFE8`, icon tile 42 r14 (vertical color) + title 13.5/600 (ellipsis) + sub 11.5 + **status dot** (9px): sage = settled · accent + breathe = waiting on you · clay = needs attention. Sub in clay when attention needed.
- Vertical tiles: 2×2 grid, r24 raised, icon tile 40 r14 on `#F3EFE8`, Playfair 16 label, micro count ("2 in motion" / "quiet").
- Progress: inset well track 12 (padding 3) + accent-grad fill, `neuGrowX` sweep; % in Playfair accent-deep.
- Toasts: full-width raised pills, icon disc 34 (sage check / clay ✕), title 12.5/600 + sub 11, trailing quiet action in accent-deep. Float above tab bar.
- Placing-request loader: ✦ disc 64 with halo + Playfair "Placing request" + typing dots. Copy: "A moment — the house is listening".

**05 · Overlays**
- Bottom sheet: rises over scrim `rgba(56,51,43,0.30)` + blur 2; top radius 30; grabber 44×5 `rgba(166,156,140,0.5)` inside a 44 touch zone; content = tracked label `NEW REQUEST` · Playfair title "How may we help?" · vertical chips · floating textarea · primary button. 420ms rise.
- Action sheet: context title tracked-caps 11 centered · rows 54 (icon + 14/500) with accent-wash hover · destructive row in clay `#B06A61` (**never red**) · cancel ("Not now") is its own raised pill 54 below.

**06 · Screens** (390pt frame; specimens 352 incl. bezel)
- **Home**: status bar · home app bar (mark / wordmark / bell) · date label + "Good evening, Arfam" + "Three requests are in motion." · search pill ("Ask for anything…" + ✦) · verticals 2×2 · `IN MOTION · 3` + "View all" header row · 2 request rows · tab bar (Home active) + home indicator.
- **Request detail**: detail app bar · Playfair 22 title "Gulfstream — Nice → Riyadh" · sage Confirmed chip + date line · route card (NCE 09:00 —dashed— plane —dashed— RUH 15:40; divider; "G650 · quiet cabin" / "4 guests · catering confirmed") · **THE THREAD** timeline card: done steps = 22Ø accent-grad check discs connected by 1.5px putty line, current = inset well disc + breathing accent dot, labels 12/600 + butler-voice micro-copy timestamps · concierge row (SM accent avatar 42 · "Sara Mehta — Senior concierge — attending" · message knob) · sticky primary "Message Sara" 54.
- **Elaya chat**: back knob · center stacked ✦ disc 38 with halo + `ELAYA` 9.5 tracked 0.22em · date chip inset pill `TODAY · 21:14` · bubbles: Elaya = raised surface, r `20 20 20 6`, 12.5/1.55 ink; user = accent-grad, r `20 20 6 20`, ink fg; typing bubble with 3 dots · suggestion chips 36 (accent-deep text) · composer: floating input pill 50 ("Write to Elaya…" + mic glyph) + send knob 50Ø accent-grad (send icon) · home indicator.

## Interactions & state
- Tab bar: single active index (0–3), Elaya knob is navigation (opens chat), not a tab state.
- Drawer: open/close boolean; opens from mark tap, closes on scrim tap, row selection, or swipe-left. Drawer + sheet + action sheet are mutually exclusive overlays.
- Segmented (`All / In motion / Attended to`), filter chips (multi-select), toggle, stepper (min 1, max 9) as in specimens.
- Reference implementation flags on the DC (Tweaks): `accent` enum (8 themes) · `elayaKnob` boolean · `specs` boolean (spec annotations). Recreate `accent` as the app's theme; the others are build-time decisions.

## Copy rules (butler voice — enforced in all specimen copy)
Requests (never tasks) · "Needs attention" (never Error) · short unhurried confirmations ("Confirmed", "Consider it done", "your word taken") · no exclamation marks, no emoji (✦ and the mark are glyphs, not emoji) · UPPERCASE tracked labels with `padding-left` compensating letter-spacing · precise concrete details ("Gulfstream — Nice → Riyadh", "Patek 5711 — authentication") · em-dash and middle-dot separators.

## Assets
- The mark: constructed inline SVG (geometry above) — no binary asset needed; source `export/vanilla/indulge-confirm.js`.
- Icons: Lucide (approved substitute), 1.7px stroke, in text-secondary, accent-deep, or pastel-deep on tiles. Never filled.
- Fonts: Playfair Display (500/600, + italic 500) and Geist (400/500/600) via Google Fonts.
- No photography in this package.

## Files
- `Serene Mobile.dc.html` — the full mobile system specimen (open in browser; interactive: tab bar, segmented, chips, toggle, stepper, bottom sheet, drawer).
- `support.js` — runtime for the specimen (reference only).
- Base system: `design_handoff_neumorphic_system/` (tokens css + desktop component specimens). Related pages in the design project: `Serene Neumorphic.dc.html` (foundations), `Serene Components.dc.html` (desktop library).
