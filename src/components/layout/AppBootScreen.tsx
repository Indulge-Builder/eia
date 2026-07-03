'use client';

import React, { useEffect, useState } from 'react';
import { SeedMandala } from '@/components/ui/SeedMandala';

// AppBootScreen — the hero loading sequence (logo-motion handoff §Boot).
// Full-viewport on --neu-canvas: the mark draws itself (1.9s), then breathes
// on a barely-perceptible 90s turn inside a pulsing accent glow; the wordmark
// opens its tracking at 1.5s, the tagline fades up at 2.1s, the progress
// sweep starts at 2.4s. Plays once per app load (a hard navigation — the
// dashboard layout persists across client-side route changes, so soft navs
// never replay it). The overlay SSRs with the shell, so it is visible from
// first paint; the layout beneath only streams once the shell's data has
// resolved server-side, so dismissal is time-based: hold until the sequence
// has played, then fade.

const SEQUENCE_MS = 3400;
const REDUCED_MS = 500;

export function AppBootScreen() {
  const [leaving, setLeaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer = setTimeout(() => setLeaving(true), reduced ? REDUCED_MS : SEQUENCE_MS);
    return () => clearTimeout(timer);
  }, []);

  if (done) return null;

  return (
    <div
      role="status"
      aria-label="Serene is loading"
      onTransitionEnd={() => leaving && setDone(true)}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-boot)' as React.CSSProperties['zIndex'],
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '34px',
        background: 'var(--neu-canvas)',
        opacity: leaving ? 0 : 1,
        pointerEvents: leaving ? 'none' : 'auto',
        transition: 'opacity 500ms var(--ease-in-out)',
      }}
    >
      {/* Soft ambient glow — theme accent (the ONLY theme-tinted piece of the
          mark's stage), pulsing in phase with the breath (both from 2.6s). */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 420,
          height: 420,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, var(--neu-boot-glow) 0%, transparent 65%)',
          opacity: 0.25,
          animation: 'serene-logo-glow 4s ease-in-out 2.6s infinite both',
        }}
      />

      {/* Breathe wraps the spin — two nested elements so transforms compose. */}
      <div
        style={{
          position: 'relative',
          width: 190,
          height: 190,
          animation: 'serene-logo-breathe 4s ease-in-out 2.6s infinite',
        }}
      >
        <SeedMandala size={190} draw spin={90} />
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-3)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '26px',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--neu-text-primary)',
            // paddingLeft mirrors the final tracking so the word stays
            // optically centred while the letter-spacing opens.
            paddingLeft: '0.42em',
            animation: 'serene-word-in 1.4s cubic-bezier(0.22, 1, 0.36, 1) 1.5s both',
          }}
        >
          SERENE
        </div>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            letterSpacing: '0.08em',
            color: 'var(--neu-text-tertiary)',
            animation: 'serene-tagline-in 900ms cubic-bezier(0.22, 1, 0.36, 1) 2.1s both',
          }}
        >
          Attending to every detail
        </div>
      </div>

      {/* Progress shimmer — inset track, 35%-wide accent sweep. */}
      <div
        aria-hidden="true"
        style={{
          position: 'relative',
          width: 220,
          height: 8,
          borderRadius: 'var(--neu-radius-pill)',
          background: 'var(--neu-well)',
          boxShadow: 'var(--neu-shadow-inset)',
          overflow: 'hidden',
          animation: 'serene-tagline-in 700ms ease 2.3s both',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '-35%',
            width: '35%',
            borderRadius: 'var(--neu-radius-pill)',
            background: 'linear-gradient(90deg, transparent, var(--neu-accent), transparent)',
            animation: 'serene-progress-sweep 1.6s cubic-bezier(0.4, 0, 0.2, 1) 2.4s infinite',
          }}
        />
      </div>

      {/* Reduced motion: kill every loop; the mark rests finished, text and
          track land static (the draw/spin classes are gated in the token
          layer — these inline loops need their own gate). */}
      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [role="status"][aria-label="Serene is loading"] * {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
