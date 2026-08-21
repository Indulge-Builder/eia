/**
 * The Indulge mark — 9 circles, always stroked, never filled.
 * Geometry per design_handoff_mobile_system/README.md §The mark:
 * one circle at (96,96) r34 + a ring of 8 at distance 37, angles
 * 11.25° + k·45°, all r34, viewBox 0 0 192 192, stroke-width 10
 * (viewBox units ≈ 1.1px rendered at 21px).
 *
 * Colour rides `currentColor` — the drawer knob sets
 * `--neu-accent-deep`, so the mark re-tints with the theme.
 */
export function IndulgeMark({ size = 21 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 192 192"
      fill="none"
      stroke="currentColor"
      strokeWidth={10}
      aria-hidden
    >
      <circle cx="96" cy="96" r="34" />
      <circle cx="132.29" cy="103.22" r="34" />
      <circle cx="116.56" cy="126.76" r="34" />
      <circle cx="88.78" cy="132.29" r="34" />
      <circle cx="65.24" cy="116.56" r="34" />
      <circle cx="59.71" cy="88.78" r="34" />
      <circle cx="75.44" cy="65.24" r="34" />
      <circle cx="103.22" cy="59.71" r="34" />
      <circle cx="126.76" cy="75.44" r="34" />
    </svg>
  );
}
