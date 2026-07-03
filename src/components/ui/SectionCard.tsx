import React from "react";

export interface SectionCardProps {
  /** Micro-label shown in the card header. Always uppercase, widest tracking. */
  title:        string;
  /** Optional one-line description shown under the title. */
  description?: string;
  /** Optional element rendered on the right side of the header (e.g. status pills). */
  headerRight?: React.ReactNode;
  /** Set `false` to remove the inner body padding when the child owns its own padding (e.g. a `<form>`). Default: `true`. */
  bodyPadding?: boolean;
  children:     React.ReactNode;
}

/**
 * SectionCard — the canonical card shell for single-record detail pages.
 *
 * Matches the Profile page treatment exactly:
 *   - `--theme-paper` background, 1px paper-border, `--shadow-1` (flat, grounded — NOT levitating)
 *   - Header strip on the THEMED accent-surface wash (`--theme-accent-surface`,
 *     re-tints with every theme) + accent-tinted hairline + accent `label-micro`
 *     title — the shared CardHeader treatment. Never repaint it with
 *     `--theme-paper-subtle` (the sunken well tone; inset marks state only,
 *     neumorphic Rule 4)
 *   - Body padded `--space-6` by default
 *
 * Used by:
 *   - src/app/(dashboard)/profile/page.tsx
 *   - src/app/(dashboard)/admin/users/[id]/page.tsx
 *   - src/app/(dashboard)/admin/users/new/page.tsx
 */
export function SectionCard({
  title,
  description,
  headerRight,
  bodyPadding = true,
  children,
}: SectionCardProps) {
  return (
    <div
      // Card-role radius (Marshmallow 32) — cards, not fields (--neu-radius-*).
      style={{
        background:   "var(--theme-paper)",
        border:       "1px solid var(--theme-paper-border)",
        borderRadius: "var(--neu-radius-card)",
        boxShadow:    "var(--shadow-1)",
        overflow:     "hidden",
      }}
    >
      <div
        style={{
          display:      "flex",
          alignItems:   "center",
          gap:          "var(--space-4)",
          padding:      "var(--space-4) var(--space-6)",
          background:   "var(--neu-header-wash)",
          borderBottom: "1px solid var(--neu-header-edge)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 className="label-micro" style={{ margin: 0, color: "var(--theme-accent)" }}>
            {title}
          </h2>
          {description && (
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize:   "var(--text-xs)",
                color:      "var(--theme-text-tertiary)",
                margin:     "var(--space-1) 0 0",
              }}
            >
              {description}
            </p>
          )}
        </div>
        {headerRight && (
          <div style={{ flexShrink: 0 }}>{headerRight}</div>
        )}
      </div>

      <div style={bodyPadding ? { padding: "var(--space-6)" } : undefined}>
        {children}
      </div>
    </div>
  );
}
