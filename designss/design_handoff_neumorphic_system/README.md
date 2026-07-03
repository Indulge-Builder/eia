# Handoff: Serene — Neumorphic (Soft UI) Design System

## Overview
A full soft-3D / neumorphic restyle of the Serene app (Indulge Global's internal concierge CRM). Warm cream material, English-rose accent with a pastel support family, every surface carved from one material with a single top-left light source. This package contains the token layer, the design rules, and two HTML specimen files covering the entire component inventory of the Serene codebase (`src/components/ui/*` plus the domain patterns).

## About the Design Files
The `.dc.html` files in this bundle are **design references created in HTML** — living specimens showing intended look, spacing, and interaction states. They are **not production code to copy directly**. The task is to **recreate these designs inside the existing Serene Next.js codebase** (React 19 / Next App Router, Tailwind v4, CSS custom properties in `src/styles/design-tokens.css`, framer-motion) using its established component files and patterns.

Open the HTML files in a browser to inspect (keep `support.js` in the same folder). Every style is inline on the element — inspect any element to read its exact recipe.

## Fidelity
**High-fidelity.** Colors, shadows, radii, typography and states are final. Recreate pixel-perfectly, but express them through the codebase's token/CSS-variable conventions — never hardcode hex values in components.

## The Five Rules (the whole philosophy)
1. **One material, one light.** The page ground is a warm midtone (`#ECE8E1`) — never pure white or black. Light always arrives from the top-left (315°).
2. **Shadows come in pairs.** Every surface gets a dark shadow at bottom-right AND a light highlight at top-left. Never a lone drop shadow.
3. **Raised = touchable. Inputs float too.** Cards, buttons, tiles, and text fields are all raised. Text fields are distinguished from buttons by a *gradient sheen* (`linear-gradient(180deg,#F7F4EE,#F1EDE6)`) plus a 1px inner top highlight — not by sinking them.
4. **Inset marks only state.** Sunken surfaces are reserved for pressed buttons, toggle/tab tracks, and skeletons. **Selected** items never sink — they *float on an accent wash* (`--neu-accent` at ~10–14% + gentle lift).
5. **Interaction grammar.** Hover: raise further + `translateY(-1px)`. Press: pressed-inset shadow + `scale(0.98)`. Focus: 1px accent ring. Durations/easings reuse the existing motion tokens (`--ease-spring`, `--duration-base`).

## Design Tokens
Shipped as `serene-neumorphic-tokens.css` — an additive layer beside `design-tokens.css`. Key values (cream theme):

**Surfaces:** canvas `#ECE8E1` · surface `#F1EDE6` · surface-high `#F3EFE8` · well `#E9E4DB` (state-only)
**Shadow pair primitives:** dark `rgba(166,156,140,…)` (warm putty) · light `rgba(255,255,255,…)` · 1px hairline edge `rgba(255,255,255,0.55)` on raised surfaces
**Shadow recipes — FINAL and only feel: "Whisper" (the gentlest tier):**
- raised: `3px 3px 8px rgba(166,156,140,.26), -3px -3px 8px rgba(255,255,255,.70)`
- raised-sm: `2px 2px 6px .24 / -2px -2px 6px .65`
- raised-lg / floating panels: `6px 6px 16px .28 / -6px -6px 16px .75`
- input: `3px 3px 8px .22 / -3px -3px 8px .70` + `inset 0 1px 0 rgba(255,255,255,.85)`
- hover: `5px 5px 12px .30 / -5px -5px 12px .80` + translateY(-1px)
- pressed: `inset 2px 2px 4px .35, inset -2px -2px 4px .60`
- Modal/dialog sits on a scrim `rgba(56,51,43,0.35)` + blur(3px), shadow `12–16px … rgba(120,110,92,.35)`

**Accent — THEME-DERIVED:** all `--neu-accent*` tokens derive from the active theme's `--theme-accent*` family (earth / air / water / fire / martini / candy), so switching `data-theme` re-tints every accent element while the neumorphic structure (surfaces, shadow pairs, highlights) never changes. Gradient + wash are built with `color-mix` from the single theme accent. In dark mode the accent auto-lifts lighter (`color-mix` with white) to hold on charcoal. Reference/fallback values (rose): `#D9A0A5` · deep (text-safe) `#B57F84` · ink-on-rose `#45272A` · gradient fill `linear-gradient(145deg,#E3AFB3,#CD8F94)` · wash `rgba(217,160,165,0.10)`
**Pastel family (equal lightness):** sage `#A9C4A0`/`#7E9B76` (success) · powder `#A3BFD6`/`#7797B3` (info) · butter `#E3CB96`/`#B39C63` (warning) · lilac `#B3A9D4`/`#8A7FB0` · peach `#E5B896`/`#BC8E67` · danger `#D98E85`/`#B06A61`
**Chips:** pastel fill + deep-tone label, e.g. Won `#DCE8D6`/`#5F7D57`, In discussion `#D9E4EE`/`#5E7F9B`, New `#F0E4C8`/`#96814C`, Needs attention `#F0D9D4`/`#A85B50`, Nurturing `#E2DDEE`/`#7A6FA0` — always with hairline edge + raised-sm shadow.
**Text:** primary `#38332B` · secondary `#8A8274` · tertiary `#ABA396`
**Type:** Playfair Display 500/600 for display + all numbers; Geist 400/500/600 for UI. Section labels: 11–12px, 600, letter-spacing 0.16–0.22em, uppercase, accent-deep.
**Radii — FINAL and only scale, "Marshmallow":** cards 32 · panels 28 · fields 22 · icon tiles 17–18 · chips 14 · pills/knobs 999.
**Dark variant:** warm charcoal (canvas `#28241C`, surface `#2D2920`), candle-warm highlight `rgba(255,240,214,0.05)`, accent lifts to `#DFA9AE`. Never neumorphism on the app's near-black `#0d0c0a`.
**Alternate depths:** Whisper (offsets 3px/8px, alphas .26/.70) and Sculpted (12px/28px, .50/.95, warmer dark `158 146 126`) are documented in the tokens file — depth 4 "Reference" is the shipped default.

## Component Inventory (all shown in `Serene Components.dc.html`, top to bottom)
1. **Actions & controls** — Button (primary rose-gradient / secondary / ghost / soft-danger, sizes 36/48/56, disabled), MotionButton (breathing halo, 2.6s), DictationButton (idle / listening w/ pulse), Toggle (rose knob when on), TabSelector (satin inset track, active tab floats as gradient pill), Checklist (accent check tiles, progress bar), Badge/Pill set.
2. **Identity** — Avatar (sizes, presence dot), AvatarStack (−12px overlap, +N), EmptyState (serif-italic heading).
3. **Inputs & filters** — SearchBar, Select, PasswordStrengthBar (sage segments), FilterBar (applied filter = accent wash + float), FilterDropdown + FloatingPanel, MessageBar (only rose-filled circle on a screen is the send button).
4. **Date & time** — Calendar (selected day = rose knob), DatePicker/TimePicker, DateRangeFields, presets list.
5. **Containers & data** — SectionCard + InfoRow, StatTile, CollapseReveal, Table (raised status pills, wash hover rows), Carousel.
6. **Feedback** — Dialog, ConfirmDialog, Toasts (w/ depletion bar), Spinner, PageSkeletons (flat pulse, no deep inset).
7. **Chat & Elaya** — ChatMarkdown bubbles, TypingIndicator (3 dots, 150ms stagger + "✦ Elaya is writing…" pill), elaya-glyph (breathing ✦ on charcoal disc, 3s).
8. **Charts** — AreaChart, LineChart, BarChart (gradient pill bars in soft tracks, leader called out), PieChart (raised puck, cream slice gaps, dome sheen, pivot dot), RingChart (concentric progress rings, rounded caps), DonutChart (floating hub), TargetMeter (half gauge).
9. **Patterns & screens** — ActivityMarquee (30s loop, pause on hover), DaySelector (shift week), live Modal, Form elements, PersonalDetails (lead field grid), ProfileCard, AvatarCard (settings), Sidebar (gradient icon tile for active item, badge counts), MobileHome (phone-scale recipe).
10. **Domain patterns** — NotificationBell + Panel, PageHeader/BackButton/PageControls, Banners, SelectionToolbar + Pagination + ColumnPicker, JourneyTimeline, StatusActionPanel, TaskCompletionCircle + StatusIcons, Pipeline/CallOutcome/Distribution bars, CoreFourGrid/StatAtom, UploadDropzone, DealCard, CampaignCard, CaseCard, DrillModalShell, Notes, WhatsApp thread (sage outbound bubbles + double ticks), ElayaWidget, HelpdeskSearch, CategoryPills.
11. **Screens & shell** — DomainSelector, ThemeSelector, SettingsLinkCard, NotificationPreferences, AuthLogin, DashboardCanvas + AddWidgetMenu, TasksCalendarView.

Each specimen card in the HTML is labeled with the codebase component name it maps to (`src/components/ui/Button.tsx`, `src/components/leads/PersonalDetailsCard.tsx`, etc.).

## Theme Scope — what re-tints and what never changes
The app ships EIGHT themes (earth · air · water · fire · candy · rose · moss · lilac) + a dark mode. **martini is retired — remove it from design-tokens.css and the ThemeSelector.** The neumorphic layer splits cleanly:

**Theme-AFFECTED (derives from `--theme-accent*`, re-tints on `data-theme` switch):** primary/gradient buttons and their halo, active tab + sidebar item, selected states and accent washes (dropdown options, applied filters, presets, calendar selected day, today column), toggle knobs (on), focus rings, checkbox/radio fills, notification unread dots + washes, single-series progress (TaskCompletionCircle, TargetMeter, deal probability, ring/donut primary), sparkline/area/line PRIMARY series, Elaya glyph tint, send button, DaySelector pill, selection toolbar, pagination current page, timeline "latest" node, StatusActionPanel current stage.

**Theme-INVARIANT (never re-tints):** the neumorphic structure itself — cream surfaces `#F1EDE6`/`#ECE8E1`, warm-putty shadow pairs, white hairlines, text colors; status/semantic chips (Won/Pending/Attention/Discussion pastels — semantic, not theme); multi-series data-visualisation colors (use the existing `--domain-*` palette per the design-tokens.css rule "never use --theme-accent" for domain lines); overlay scrims; the pastel support family used as chart series 2+.

**Softened theme accents (earth · air · fire):** the stock accents read too heavy/saturated on the cream material, so the system ships pastel replacements at the support family's lightness — earth: honey gold `#D6BC82` / deep `#8A7448` / fg `#33290F` · air: powder sky `#97B5D2` / `#587A96` / `#223240` · fire: terracotta peach `#DC9877` / `#A05C3E` / `#3A1F12` · water: soft seafoam `#8FC3B9` / `#4E7E74` / `#1C2E2A` · candy: softened pink `#F0B5D2` / `#A85C87` / `#2E1522`. All use dark ink fg — pastel fills cannot hold white text. Adopt into design-tokens.css or keep the local `--neu-*` overrides in the tokens file.

**New themes (3):** rose (English rose `#D9A0A5` — the system's reference accent), moss (matcha sage `#A9C4A0`), and lilac (light lilac `#C9C0E4` / deep `#8E83B8` — the single purple in the lineup). Same lightness band, dark-ink fg. Caveat: moss neighbors the success sage; status chips stay semantic-fixed so this is acceptable, but review screens where both appear.

Rule of thumb: **if it signals selection, primary action, or "you/now" → theme accent. If it signals data category or semantic status → fixed palette.** The specimen's Tweaks panel accent switcher cycles all eight theme accents to demonstrate this — structure stays identical.

## Interactions & Behavior
- Hover only under `@media (hover:hover) and (pointer:fine)`; press feedback beats hover by cascade (existing `.serene-pressable` pattern).
- Selection grammar everywhere (dropdown options, presets, filters, calendar today, nav): accent wash + hairline + small raised shadow — never inset.
- Infinite animations: elaya breathe 3s, typing dots 1.2s/150ms stagger, marquee 30s linear (pause on hover), halo 2.6s. All must respect `prefers-reduced-motion: reduce` (existing pattern in design-tokens.css §15).
- Charts stay Recharts — restyle via props: warm putty gridlines `rgba(166,156,140,0.22)` dashed, accent/pastel series, rounded bar radius, `strokeLinecap="round"` on radial charts; wrap charts in the raised "chart panel" (gradient sheen), not a well.

## Migration Notes (mapping to the existing token system)
- `--neu-surface` takes the role of `--theme-paper`; page ground becomes `--neu-canvas` (replaces `--theme-paper-subtle` as ground).
- Replace `--shadow-1/2/3` usages with `--neu-shadow-raised-sm/raised/raised-lg`; `--shadow-inset` → `--neu-shadow-inset` (state-only).
- Hairline borders (`--theme-paper-border`) retire on raised surfaces in favor of the 1px white edge `--neu-edge`.
- The dark sidebar becomes a cream raised rail (see Sidebar specimen). The five color themes can keep their accents later, but this package ships cream ("earth") + the warm-charcoal dark variant (`data-neu="dark"`).
- Motion tokens (§13) and z-scale (§14) are unchanged.

## Motion Layer (see MOTION appendix in the tokens file)
The specimens are fully animated; recreate with the shipped `.neu-*` motion recipes:
- **Card entrance** — `neu-rise` (26px rise + 0.985 scale settle), scroll-driven via `animation-timeline: view()` so it plays both directions and self-staggers. Fallback for non-supporting browsers: an IntersectionObserver adding a class, or framer-motion `whileInView` with the same values. Always end at `transform: none`.
- **Charts draw themselves** — strokes with `pathLength="1" stroke-dasharray="1"` + `neu-draw`; bars `neu-grow` from the baseline; progress fills `neu-sweep` from the left. In Recharts use `isAnimationActive` + its easing props to approximate.
- **Interactive spring** — every clickable gets the `.neu-interactive` transition set (springy 220ms transform `cubic-bezier(0.34,1.3,0.64,1)`, 300ms shadow bloom). Hover lifts, press squashes per the grammar above.
- **Living idle loops** — elaya breathe 3s · typing dots 1.2s/150ms stagger · marquee 30s pause-on-hover · MotionButton halo 2.6s · masthead ✦ twinkle 5s.
- Everything gates on `prefers-reduced-motion: reduce`.

## Assets
Icons are Lucide (already the approved set) at stroke 1.7. **The Elaya glyph is the company logo** — `assets/elaya-glyph-192.png` (gold lotus mandala on near-black) — shown as a circular image filling the charcoal disc, with the 3s breathe (opacity) loop. Use it for: elaya-glyph component, chat assistant avatar, TypingIndicator avatar, ElayaWidget bubble + header. Tiny inline mentions (badge pills, MessageBar sparkle, "Elaya is writing…" pill) keep the ✦ character — the logo doesn't read below ~24px. Ad-creative thumbnails use striped placeholders until real imagery exists.

## Files
- `serene-neumorphic-tokens.css` — the token layer + `.neu-*` recipes (drop into `src/styles/`)
- `Serene Components.dc.html` — full component library specimen (primary reference)
- `Serene Neumorphic.dc.html` — foundations: palette, type, depth recipes A/B/C, dark variant
- `support.js` — runtime so the HTML files open in a browser; ignore for implementation
- `CLAUDE_CODE_PROMPT.md` — paste-ready prompt for Claude Code
