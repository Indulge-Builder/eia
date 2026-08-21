'use client';

import React from 'react';
import { SeedMandala } from './SeedMandala';

// LogoSpinner — THE loading indicator (logo-motion handoff). Replaces the
// deleted arc Spinner everywhere: the seed mandala turning at a fixed calm
// 3.5s/rev (never faster). lg/md sit in an inset cream well; sm is the bare
// mark. Tiny in-control indicators (button pending, save chips) compose
// <SeedMandala variant="currentColor" spin={3.5}> directly instead — the
// 18px button quotation from the same sequence.

export interface LogoSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
  /** Accessible label (default "Loading"). */
  label?: string;
}

/** well = outer inset disc px (0 = bare), mark = mandala px. */
const SIZES: Record<NonNullable<LogoSpinnerProps['size']>, { well: number; mark: number }> = {
  lg: { well: 56, mark: 38 },
  md: { well: 40, mark: 27 },
  sm: { well: 0, mark: 24 },
};

const SPIN_S = 3.5;

export function LogoSpinner({ size = 'md', className, style, label = 'Loading' }: LogoSpinnerProps) {
  const { well, mark } = SIZES[size];
  const mandala = <SeedMandala size={mark} spin={SPIN_S} />;

  if (well === 0) {
    return (
      <span
        role="status"
        aria-label={label}
        className={className}
        style={{ display: 'inline-flex', flexShrink: 0, ...style }}
      >
        {mandala}
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-label={label}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: well,
        height: well,
        borderRadius: 'var(--radius-full)',
        background: 'var(--neu-surface)',
        boxShadow: 'var(--neu-shadow-inset)',
        flexShrink: 0,
        ...style,
      }}
    >
      {mandala}
    </span>
  );
}

/**
 * LoadingVeil — full-viewport scrim + centered LogoSpinner for the gap
 * between a tap and a heavy surface appearing (e.g. the remarks pre-fetch
 * that gates SubTaskModal). Wears the Dialog scrim recipe so the veil →
 * modal handoff reads as one continuous surface. Render it ONLY while a
 * fetch is genuinely in flight — never as a route/skeleton substitute.
 */
export function LoadingVeil({ label = 'Loading' }: { label?: string }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 'var(--z-overlay)' as React.CSSProperties['zIndex'],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--neu-scrim)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
      }}
    >
      <LogoSpinner size="md" label={label} />
    </div>
  );
}
