import React from 'react';

// Num — THE inline numeric-token wrapper (2026-07-06).
//
// The number-font rule: standalone stat values use --font-serif (hero) or
// --font-mono (secondary/technical), both with tabular-nums. But a numeric
// value embedded MID-SENTENCE (a tertiary caption, a drill-modal subtitle:
// "Aanya · 12 deals") must keep the surrounding words in --font-sans while the
// digits themselves render in the mono number font. This wraps just the number.
//
// Renders an inline <span>: mono font + tabular-nums, colour/weight inherited
// from the sentence around it (never re-tints — it is not a hero value). Compose
// this instead of re-inlining the span style at every sentence-with-a-number.
// Standalone hero/stat values do NOT use this — they set --font-serif directly.
//
// Display-only (A-06), server-component-safe (no hooks, no state).

export function Num({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <span
      style={{
        fontFamily:         'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
