'use client';

import React, { useEffect, useState } from 'react';
import NumberFlow, { useCanAnimate } from '@number-flow/react';
import { COUNT_UP_MS, EASE_OUT_EXPO, SLOW_DURATION } from '@/lib/constants/motion';

/**
 * AnimatedNumber — living numbers (polish handoff §04; NumberFlow engine 2026-08-25).
 *
 * Takes the ALREADY-FORMATTED display string (the output of formatCount/
 * formatCurrency/formatPercent — lib/utils/numbers.ts stays the only
 * formatter), extracts the numeric run, and renders it through
 * @number-flow/react: digits ROLL between values (odometer transition)
 * instead of re-counting, driven by Intl.NumberFormat with the same locale
 * the formatter used (en-IN default; en-US/$, en-IE/€ mirror numbers.ts),
 * so the settled render matches the input string. Prefix/suffix ("₹", "%",
 * "h", "↑ ") pass through NumberFlow's own affix slots.
 *
 * Mount keeps the count-up entrance: the first client frame starts at 0 and
 * spins to the target over COUNT_UP_MS. Later `value` changes roll from the
 * PREVIOUS value automatically. SSR/first paint render the final string
 * verbatim (plain span). Reduced motion (via useCanAnimate) renders the
 * plain string — no roll, no count-up. Non-numeric values ("—") render
 * as-is. tabular-nums so digits never jitter.
 *
 * Server components render it directly (client leaf): StatTile, KPI
 * widgets, TargetMeter labels, mobile MetricTile/RowCount.
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

/** numbers.ts formats USD with en-US and EUR with en-IE — mirror that so the
    settled grouping is identical to the input string (en-IN groups lakhs). */
function localeFor(prefix: string, suffix: string): string {
  const affix = prefix + suffix;
  if (affix.includes('$')) return 'en-US';
  if (affix.includes('€')) return 'en-IE';
  return 'en-IN';
}

const ROLL_EASE = `cubic-bezier(${EASE_OUT_EXPO.join(', ')})`;
// COUNT_UP_MS is the sanctioned count-up tempo (motion.ts) — the roll keeps it.
const ROLL_TIMING = { duration: COUNT_UP_MS, easing: ROLL_EASE };
const FADE_TIMING = { duration: SLOW_DURATION * 1000, easing: 'ease-out' };

export function AnimatedNumber({ value, className, style }: AnimatedNumberProps) {
  const canAnimate = useCanAnimate();
  // false on SSR/first paint — the plain final string renders until hydration.
  const [ready, setReady] = useState(false);
  // One post-mount frame at 0 gives the count-up entrance; then the target
  // lands and NumberFlow rolls 0 → num. Later prop changes roll prev → next.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    setReady(true);
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const target = parseValue(value);
  const numStyle: React.CSSProperties = { fontVariantNumeric: 'tabular-nums', ...style };

  if (!ready || !canAnimate || !target) {
    return (
      <span className={className} style={numStyle}>
        {value}
      </span>
    );
  }

  return (
    <NumberFlow
      className={className}
      style={numStyle}
      value={entered ? target.num : 0}
      locales={localeFor(target.prefix, target.suffix)}
      format={{
        minimumFractionDigits: target.decimals,
        maximumFractionDigits: target.decimals,
      }}
      prefix={target.prefix}
      suffix={target.suffix}
      transformTiming={ROLL_TIMING}
      spinTiming={ROLL_TIMING}
      opacityTiming={FADE_TIMING}
    />
  );
}
