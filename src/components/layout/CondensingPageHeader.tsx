'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * CondensingPageHeader — sticky page header that condenses on scroll
 * (polish handoff §07). Past ~24px of scroll: title 17px, subtitle folds
 * away, canvas-tinted blur backdrop + bottom hairline (all in the
 * `.serene-condense-header` block in globals.css — 300ms, reduced-motion
 * killed there).
 *
 * A 1px sentinel above the header drives an IntersectionObserver rooted
 * on the `.serene-shell-paper` scroll container. Hysteresis: the observer
 * re-arms with a smaller rootMargin once condensed (24px in, 4px out) so
 * the bar never flickers when the shrink itself changes scroll range.
 *
 * Usage (list pages — replaces the hand-rolled title row):
 *
 *   <CondensingPageHeader title="Leads" subtitle="137 active">
 *     <AddLeadButton … />
 *     {TOP_BAR_ENABLED && <PageControls … />}
 *   </CondensingPageHeader>
 *
 * `children` is the right-side actions cluster (page CTA + PageControls)
 * — it stays visible in the condensed row. `dot` renders the canonical
 * page-title-dot (primary nav pages only).
 */

export interface CondensingPageHeaderProps {
  title: string;
  /** Optional one-line secondary — folds away when condensed. */
  subtitle?: React.ReactNode;
  /** Primary-nav accent dot after the title (default true). */
  dot?: boolean;
  /** Right-side actions cluster (CTA + PageControls). */
  children?: React.ReactNode;
}

export function CondensingPageHeader({
  title,
  subtitle,
  dot = true,
  children,
}: CondensingPageHeaderProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const rootEl = el.closest('.serene-shell-paper');
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setCondensed(!entry.isIntersecting);
      },
      {
        root: rootEl instanceof Element ? rootEl : null,
        // Hysteresis: harder to enter (24px) than to leave (4px).
        rootMargin: condensed ? '-4px 0px 0px 0px' : '-24px 0px 0px 0px',
        threshold: 0,
      },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [condensed]);

  return (
    <>
      {/* Scroll sentinel — static, sits above the sticky bar so the bar's
          own height change can never move it (no feedback loop). */}
      <div ref={sentinelRef} aria-hidden="true" style={{ height: 1, marginBottom: -1 }} />

      <header className="serene-condense-header" data-condensed={condensed}>
        <div className="flex items-center justify-between gap-4">
          <div style={{ minWidth: 0 }}>
            <h1 className="type-page-title m-0">
              {title}
              {dot && <span className="page-title-dot">.</span>}
            </h1>
            {subtitle && (
              <div
                className="serene-condense-subtitle"
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--theme-text-secondary)',
                  marginTop: '2px',
                }}
              >
                {subtitle}
              </div>
            )}
          </div>
          {children && (
            <div className="flex items-center gap-3" style={{ flexShrink: 0 }}>
              {children}
            </div>
          )}
        </div>
      </header>
    </>
  );
}
