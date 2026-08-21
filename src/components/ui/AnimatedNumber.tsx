'use client';

import React, { useEffect, useRef, useState } from 'react';
import { COUNT_UP_MS } from '@/lib/constants/motion';

/**
 * AnimatedNumber — living numbers (polish handoff §04).
 *
 * rAF count-up: 1.4s, ease-out-cubic (1-(1-p)^3), tabular-nums so digits
 * never jitter. Takes the ALREADY-FORMATTED display string (the output of
 * formatCount/formatCurrency/formatPercent — lib/utils/numbers.ts stays
 * the only formatter) and animates the numeric run inside it, preserving
 * any prefix/suffix ("₹", "%", "h", "↑ "). Intermediate frames group with
 * en-IN (the app's locale) and keep the target's decimal places; the
 * final frame always renders the original string verbatim, so the settled
 * value is byte-identical to the non-animated render.
 *
 * Re-runs when `value` changes — animating from the PREVIOUS value, not
 * from 0. Honors prefers-reduced-motion (jumps to final). Non-numeric
 * values ("—") render as-is.
 *
 * Server components render it directly (client leaf): StatTile, KPI
 * widgets, TargetMeter labels.
 */

export interface AnimatedNumberProps {
  /** Formatted display string, e.g. "₹2,84,500", "42.6%", "1.8h", "137". */
  value: string;
  className?: string;
  style?: React.CSSProperties;
}

type ParsedValue = {
  prefix: string;
  num: number;
  decimals: number;
  suffix: string;
} | null;

const NUMERIC_RUN = /-?[\d,]+(?:\.\d+)?/;

function parseValue(value: string): ParsedValue {
  const match = NUMERIC_RUN.exec(value);
  if (!match) return null;
  const raw = match[0];
  const num = parseFloat(raw.replace(/,/g, ''));
  if (Number.isNaN(num)) return null;
  const dot = raw.indexOf('.');
  return {
    prefix:   value.slice(0, match.index),
    num,
    decimals: dot === -1 ? 0 : raw.length - dot - 1,
    suffix:   value.slice(match.index + raw.length),
  };
}

function formatIntermediate(n: number, decimals: number): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function AnimatedNumber({ value, className, style }: AnimatedNumberProps) {
  // SSR/first paint renders the final string — the effect then counts up.
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number | null>(null);
  // The numeric value currently on screen — the start point for the next run.
  const shownRef = useRef(0);

  useEffect(() => {
    const target = parseValue(value);
    if (!target) {
      setDisplay(value);
      return;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      shownRef.current = target.num;
      setDisplay(value);
      return;
    }

    const from = shownRef.current;
    if (from === target.num) {
      setDisplay(value);
      return;
    }

    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / COUNT_UP_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      const current = from + (target.num - from) * eased;
      shownRef.current = current;
      if (p < 1) {
        setDisplay(target.prefix + formatIntermediate(current, target.decimals) + target.suffix);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        shownRef.current = target.num;
        setDisplay(value); // settle on the original string verbatim
      }
    };
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  return (
    <span
      className={className}
      style={{ fontVariantNumeric: 'tabular-nums', ...style }}
    >
      {display}
    </span>
  );
}
