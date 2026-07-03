/**
 * Shared motion constants for Framer Motion animations across Serene.
 * All values derive directly from design-tokens.css — never re-declare inline per component.
 *
 * Usage:
 *   import { ENTER_DURATION, EXIT_DURATION, EASE_OUT_EXPO, EASE_IN_EXPO } from '@/lib/constants/motion';
 *   transition={{ duration: ENTER_DURATION, ease: EASE_OUT_EXPO }}
 */

/** --duration-enter: 400ms */
export const ENTER_DURATION = 0.4;

/** --duration-exit: 250ms */
export const EXIT_DURATION = 0.25;

/** --duration-base: 200ms */
export const BASE_DURATION = 0.2;

/** --duration-fast: 150ms */
export const FAST_DURATION = 0.15;

/** --duration-slow: 350ms */
export const SLOW_DURATION = 0.35;

/** --duration-instant: 100ms */
export const INSTANT_DURATION = 0.1;

/** --duration-page: 500ms — the §10.1 #05 animation ceiling. Nothing animates longer except elayaBreathe. */
export const PAGE_DURATION = 0.5;

/** --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1) */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/** --ease-in-expo: cubic-bezier(0.7, 0, 0.84, 0) */
export const EASE_IN_EXPO = [0.7, 0, 0.84, 0] as const;

/** --ease-spring: cubic-bezier(0.22, 1, 0.36, 1) */
export const EASE_SPRING = [0.22, 1, 0.36, 1] as const;

/** --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1) */
export const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const;

/** --ease-out-soft: cubic-bezier(0.25, 0.46, 0.45, 0.94) — gentle, unhurried deceleration */
export const EASE_OUT_SOFT = [0.25, 0.46, 0.45, 0.94] as const;

/** Standard modal enter variants */
export const MODAL_VARIANTS = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: ENTER_DURATION, ease: EASE_OUT_EXPO },
  },
  exit: {
    opacity: 0,
    scale: 0.97,
    transition: { duration: EXIT_DURATION, ease: EASE_IN_EXPO },
  },
} as const;

/** Dropdown/panel enter variants — fade + y slide */
export const DROPDOWN_VARIANTS = {
  hidden: { opacity: 0, y: -4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: BASE_DURATION, ease: EASE_OUT_EXPO },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: FAST_DURATION, ease: EASE_IN_EXPO },
  },
} as const;

/** Dropdown variants mirrored for panels that open UPWARD (flipUp) —
 *  the slide emerges from the trigger edge, so y runs 4→0, not -4→0. */
export const DROPDOWN_VARIANTS_UP = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: BASE_DURATION, ease: EASE_OUT_EXPO },
  },
  exit: {
    opacity: 0,
    y: 4,
    transition: { duration: FAST_DURATION, ease: EASE_IN_EXPO },
  },
} as const;

/**
 * transformTemplate for flip-up anchored panels — keeps the static
 * translateY(-100%) bottom-anchor shift while Framer animates y.
 * A `style.transform` string on a motion element is CLOBBERED the moment
 * Framer animates any transform value; never set translateY(-100%) via
 * style — pass this as `transformTemplate` instead.
 */
export const FLIP_UP_TRANSFORM_TEMPLATE = (_: unknown, generated: string): string =>
  generated === 'none' ? 'translateY(-100%)' : `translateY(-100%) ${generated}`;

/**
 * Spring transition for shared-layout indicators (tab pills, underlines, segmented controls).
 * Use as `transition={SPRING_CONFIG}` on motion.span layoutId elements.
 * stiffness 400 / damping 30 produces a snappy, non-bouncy feel.
 */
export const SPRING_CONFIG = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 30,
} as const;

/**
 * Bouncier spring for tiny "arrival" pops (notification dot, badges).
 * Lower damping than SPRING_CONFIG → one visible overshoot. Use sparingly.
 */
export const SPRING_BOUNCE = {
  type: 'spring' as const,
  stiffness: 400,
  damping: 20,
} as const;

/* ── Polish layer (design_handoff_polish_layer README, "global rules") ──
   Fixed durations — never re-tune per call site. */

/** Command-palette rise — 320ms spring-out. */
export const PALETTE_DURATION = 0.32;

/** List-row enter/exit choreography — 380ms spring-out on height/transform. */
export const ROW_DURATION = 0.38;

/** Row choreography opacity leg — 320ms ease. */
export const ROW_FADE_DURATION = 0.32;

/** Tooltip fade + 5px directional slide — 180ms. */
export const TOOLTIP_DURATION = 0.18;

/** Tooltip hover-intent delay before first show (ms). */
export const TOOLTIP_INTENT_MS = 500;

/** Header condense on scroll — 300ms. */
export const CONDENSE_DURATION = 0.3;

/** Living-number count-up — 1.4s ease-out-cubic (rAF-driven, not Framer). */
export const COUNT_UP_MS = 1400;

/** Undo-toast window — the accent depletion bar IS the countdown. */
export const UNDO_WINDOW_MS = 5000;

/**
 * List-row choreography (polish handoff §02) — enter settles in from
 * above, exit collapses and drifts right. Pair with <AnimatePresence>
 * + `layout` on siblings via <MotionRow> (src/components/ui/RowMotion.tsx).
 * The height:auto animation here is the handoff-sanctioned exception to
 * the height-animation ban — Framer measures and tweens it; rows must
 * carry overflow:hidden (MotionRow does).
 */
export const ROW_VARIANTS = {
  initial: { height: 0, opacity: 0, y: -8 },
  animate: {
    height: 'auto',
    opacity: 1,
    y: 0,
    transition: {
      height:  { duration: ROW_DURATION, ease: EASE_SPRING },
      y:       { duration: ROW_DURATION, ease: EASE_SPRING },
      opacity: { duration: ROW_FADE_DURATION, ease: EASE_IN_OUT },
    },
  },
  exit: {
    height: 0,
    opacity: 0,
    x: 24,
    transition: {
      height:  { duration: ROW_DURATION, ease: EASE_SPRING },
      x:       { duration: ROW_DURATION, ease: EASE_SPRING },
      opacity: { duration: ROW_FADE_DURATION, ease: EASE_IN_OUT },
    },
  },
} as const;

/** Minimal fade only */
export const FADE_VARIANTS = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: BASE_DURATION, ease: EASE_IN_OUT },
  },
  exit: {
    opacity: 0,
    transition: { duration: FAST_DURATION, ease: EASE_IN_OUT },
  },
} as const;
