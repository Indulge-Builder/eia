import type { CSSProperties, SVGProps } from "react";
import { SeedMandala } from "./SeedMandala";

interface ElayaGlyphProps extends SVGProps<SVGSVGElement> {
  size?: number;
  breathing?: boolean;
}

/**
 * Elaya's mark. Always breathing when she is present.
 * Pass breathing={false} only when she is absent.
 * Color is always inherited from `color` (set via --theme-accent on the parent).
 */
/**
 * Neumorphic disc mount — Elaya's glyph is the COMPANY LOGO
 * (public/elaya-glyph-192.png, gold lotus mandala on near-black) shown as
 * a circular image filling the charcoal disc, breathing on the 3s loop.
 * The disc is the ONE dark-first surface that survives the cream restyle
 * (design_handoff_neumorphic_system: elaya-glyph specimen + §Assets).
 * Consumers: elaya-glyph mounts, chat assistant avatar, TypingIndicator
 * avatar, ElayaWidget bubble + header. Tiny inline mentions (< 24px:
 * badge pills, MessageBar sparkle) keep the ✦/compass mark via
 * <ElayaGlyph> — the logo doesn't read below ~24px.
 */
export function ElayaGlyphDisc({
  size = 44,
  glyphSize: _glyphSize,
  breathing = true,
  thinking = false,
  style,
}: {
  size?: number;
  /** Legacy — the logo fills the disc; kept so call sites need no change. */
  glyphSize?: number;
  breathing?: boolean;
  /** While she thinks, the disc's mark TURNS (logo-motion handoff): the
   *  static logo image swaps for the procedural darkDisc seed mandala at
   *  8s/rev (her fixed, slowest working speed — never faster). */
  thinking?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: "var(--radius-full)",
        background: "var(--neu-glyph-disc)",
        boxShadow: "var(--neu-shadow-raised-sm)",
        overflow: "hidden",
        flexShrink: 0,
        ...style,
      }}
    >
      {thinking ? (
        // 30-in-44 ratio from the handoff specimen, scaled to the disc.
        <SeedMandala size={Math.round(size * (30 / 44))} variant="darkDisc" spin={8} />
      ) : (
        /* The logo art is composited on near-black, so it blends into the
           charcoal disc; the breathe loop is opacity-only (compositor-safe). */
        <img
          src="/elaya-glyph-192.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          className={breathing ? "elaya-breathe" : undefined}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "var(--radius-full)",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
    </span>
  );
}

export function ElayaGlyph({ size = 32, breathing = true, className = "", ...props }: ElayaGlyphProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${breathing ? "elaya-breathe" : ""} ${className}`.trim()}
      aria-hidden="true"
      {...props}
    >
      {/* Outer ring */}
      <circle cx="16" cy="16" r="13.5" stroke="currentColor" strokeWidth="0.75" />
      {/* Inner ring */}
      <circle cx="16" cy="16" r="7" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
      {/* Center point */}
      <circle cx="16" cy="16" r="1.75" fill="currentColor" />
      {/* Cardinal ticks */}
      <line x1="16" y1="1" x2="16" y2="5.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="16" y1="26.5" x2="16" y2="31" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="1" y1="16" x2="5.5" y2="16" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <line x1="26.5" y1="16" x2="31" y2="16" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}
