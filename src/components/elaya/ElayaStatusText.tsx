'use client';

import { TextMorph } from 'torph/react';
import { SPRING_CONFIG } from '@/lib/constants/motion';

/**
 * ElayaStatusText — THE morphing Elaya status line (torph, 2026-08-25).
 *
 * Elaya's tool-status phrases ("Looking through your leads…" →
 * "Pulling your numbers…") and the "Thinking…" wait morph between each
 * other instead of hard-swapping — Elaya is the one presence in Serene
 * allowed to animate text; nothing else composes TextMorph. Inherits
 * font/colour/size from the parent span (serif-italic status rows on
 * the desktop shell + header subtitle, and the mobile TypingBubble).
 *
 * Spring is the shared SPRING_CONFIG (V-13 — never re-declare one
 * inline). torph gates itself on prefers-reduced-motion
 * (respectReducedMotion, passed explicitly to keep the gate visible).
 *
 * Both Elaya surfaces compose this — never mount TextMorph anywhere
 * else without a Decision Log entry.
 */
export function ElayaStatusText({ text }: { text: string }) {
  return (
    <TextMorph as="span" ease={SPRING_CONFIG} respectReducedMotion>
      {text}
    </TextMorph>
  );
}
