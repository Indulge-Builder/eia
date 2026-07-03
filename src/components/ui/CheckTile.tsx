'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * CheckTile — THE completion tile (polish handoff §03).
 *
 * Unchecked: inset well (state = inset, neumorphic Rule 4).
 * Checked: flips to the accent gradient + raised shadow while the check
 * draws in (400ms spring-out) and ONE 700ms accent ring pulses outward
 * (`.serene-ring-pulse` — fires only on a user toggle, never on mount,
 * and is skipped entirely under reduced motion).
 *
 * Compose this for checklist items, task-complete tiles, and any binary
 * done-state — never re-inline a check-draw/ring cluster. It is a plain
 * <button> (zero Framer cost) with aria-pressed.
 */

export interface CheckTileProps {
  checked: boolean;
  onToggle: () => void;
  /** Edge length in px — 30 for list rows, 52 for hero tiles. */
  size?: number;
  disabled?: boolean;
  'aria-label': string;
  style?: React.CSSProperties;
}

export function CheckTile({
  checked,
  onToggle,
  size = 30,
  disabled = false,
  'aria-label': ariaLabel,
  style,
}: CheckTileProps) {
  // Ring pulses only when the user flips it ON after mount.
  const mountedRef = useRef(false);
  const prevChecked = useRef(checked);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      prevChecked.current = checked;
      return;
    }
    if (checked && !prevChecked.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 900); // 700ms + 150ms delay
      prevChecked.current = checked;
      return () => clearTimeout(t);
    }
    prevChecked.current = checked;
  }, [checked]);

  // Specimen ratios: 30px tile → radius 11, 15px glyph; 52px → 18 / 24.
  const radius = Math.round(size * 0.36);
  const glyph = Math.round(size * 0.48);

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={checked}
      aria-label={ariaLabel}
      className={['serene-pressable', pulse ? 'serene-ring-pulse' : '']
        .filter(Boolean)
        .join(' ')}
      style={{
        width:          size,
        height:         size,
        borderRadius:   radius,
        border:         'none',
        padding:        0,
        flexShrink:     0,
        display:        'inline-flex',
        alignItems:     'center',
        justifyContent: 'center',
        cursor:         disabled ? 'not-allowed' : 'pointer',
        background:     checked ? 'var(--neu-accent-gradient)' : 'var(--neu-canvas)',
        boxShadow:      checked ? 'var(--neu-shadow-raised-sm)' : 'var(--neu-shadow-inset)',
        transition:     'background 260ms var(--ease-in-out), box-shadow 260ms var(--ease-in-out)',
        opacity:        disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        style={{ width: glyph, height: glyph, overflow: 'visible' }}
      >
        <path
          className={checked ? 'serene-check-draw' : undefined}
          d="M5 12.5 L10 17.5 L19 6.5"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={checked ? 0 : 1}
          fill="none"
          stroke="var(--neu-accent-fg)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
