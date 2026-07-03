'use client';

import React, { useEffect, useState } from 'react';

/**
 * PetalFall — the deal-won celebration (polish handoff §03).
 *
 * ~14 gold petals (7–15px, teardrop radius) fall through the parent card:
 * translateY(-12px → 230px) + rotate(220deg), fading in at 12% and out at
 * the end; 1.6–2.7s randomised duration, 0–500ms delay, `forwards`. The
 * layer is absolute-inset, overflow:hidden, pointer-events:none — mount it
 * inside a position:relative card. DOM is removed after 3.2s via onDone.
 *
 * The gradient is BRAND-FIXED gold (--neu-petal-gradient — the SeedMandala
 * darkDisc stops), never the theme accent. RESERVED EXCLUSIVELY FOR a deal
 * transitioning into Won — never reuse for lesser events. Reduced motion:
 * petals stay invisible (the .serene-petal media rule) and the layer just
 * expires.
 */

export interface PetalFallProps {
  count?: number;
  /** Fired once the celebration is over (~3.2s) — unmount the layer here. */
  onDone?: () => void;
}

type Petal = {
  left: string;
  size: number;
  duration: string;
  delay: string;
};

const LIFETIME_MS = 3200;

function spawnPetals(count: number): Petal[] {
  return Array.from({ length: count }, () => ({
    left:     `${4 + Math.random() * 90}%`,
    size:     7 + Math.random() * 8,
    duration: `${(1.6 + Math.random() * 1.1).toFixed(2)}s`,
    delay:    `${Math.round(Math.random() * 500)}ms`,
  }));
}

export function PetalFall({ count = 14, onDone }: PetalFallProps) {
  // Lazy init — randomised once per mount, never on re-render.
  const [petals] = useState(() => spawnPetals(count));

  useEffect(() => {
    if (!onDone) return;
    const t = setTimeout(onDone, LIFETIME_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      aria-hidden="true"
      style={{
        position:      'absolute',
        inset:         0,
        overflow:      'hidden',
        pointerEvents: 'none',
      }}
    >
      {petals.map((p, i) => (
        <span
          key={i}
          className="serene-petal"
          style={{
            position:          'absolute',
            top:               '-16px',
            left:              p.left,
            width:             p.size,
            height:            p.size,
            borderRadius:      '50% 50% 50% 0',
            background:        'var(--neu-petal-gradient)',
            opacity:           0,
            animationDuration: p.duration,
            animationDelay:    p.delay,
          }}
        />
      ))}
    </div>
  );
}
