'use client';

import React from 'react';
import { m as motion } from 'framer-motion';
import { ROW_VARIANTS } from '@/lib/constants/motion';

/**
 * MotionRow — THE list-row choreography wrapper (polish handoff §02).
 *
 * Every row addition/removal/completion animates; nothing snaps.
 * Enter: height 0→auto + y −8→0 + fade (380ms spring-out).
 * Exit: height collapse + x +24 drift + fade.
 *
 * Usage — the CALLER owns <AnimatePresence> (usually with initial={false}
 * so the first page render doesn't cascade):
 *
 *   <AnimatePresence initial={false}>
 *     {rows.map((r) => (
 *       <MotionRow key={r.id}>…row content…</MotionRow>
 *     ))}
 *   </AnimatePresence>
 *
 * Notes:
 * - Framer's measured height:auto tween is the handoff-sanctioned exception
 *   to the height-animation ban; the wrapper owns the overflow:hidden clip.
 * - `layout` is on by default so surviving siblings glide into place.
 * - Inside lists, row motion WINS over `.neu-reveal` — never stack both on
 *   one row (double-animation).
 * - Apply to: task lists, notifications, notes, filtered table rows,
 *   checklist items.
 */

export interface MotionRowProps {
  children: React.ReactNode;
  /** Disable the sibling glide (rare — virtualised or reordered lists). */
  layout?: boolean;
  className?: string;
  /** Merged over the wrapper (never set overflow/height here). */
  style?: React.CSSProperties;
}

export function MotionRow({ children, layout = true, className, style }: MotionRowProps) {
  return (
    <motion.div
      layout={layout}
      variants={ROW_VARIANTS}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
      style={{ overflow: 'hidden', ...style }}
    >
      {children}
    </motion.div>
  );
}
