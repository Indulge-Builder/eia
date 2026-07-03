'use client';

import { ProgressCard, ToastPill } from '../content';

/**
 * Activity — what the house has been doing, quietly. Feedback
 * pills + the inset progress card (§04), butler voice throughout.
 */
export function ActivityScreen() {
  return (
    <>
      <h1
        className="text-[22px] font-semibold text-(--neu-text-primary) px-1 m-0"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        Activity
      </h1>

      <span
        className="text-[11px] font-semibold text-(--neu-accent-deep) px-1"
        style={{ letterSpacing: '0.14em' }}
      >
        TODAY
      </span>

      <ToastPill tone="confirm" title="Confirmed" sub="Sara is attending to it" />
      <ToastPill
        tone="attention"
        title="Needs attention"
        sub="The Thursday slot fell through"
        actionLabel="Resolve"
      />

      <span
        className="text-[11px] font-semibold text-(--neu-accent-deep) px-1 pt-1"
        style={{ letterSpacing: '0.14em' }}
      >
        IN PREPARATION
      </span>

      <ProgressCard
        title="Gulfstream — preparation"
        percent={68}
        micro="catering confirmed · cars pending"
      />
    </>
  );
}
