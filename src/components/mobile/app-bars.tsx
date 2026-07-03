'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, Bell } from 'lucide-react';
import { IndulgeMark } from './IndulgeMark';
import { IconKnob } from './buttons';

/**
 * Mobile app bars (§02 Navigation — App bars).
 * Home bar: the mark knob (THE drawer button) · SERENE wordmark ·
 * bell knob with an accent unread dot. Detail bar: back knob ·
 * tracked-caps title · ··· knob. Titles never truncate.
 */

export function HomeAppBar({
  onOpenDrawer,
  unread = true,
}: {
  onOpenDrawer: () => void;
  unread?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <IconKnob accent size={44} aria-label="Open the house" onClick={onOpenDrawer}>
        <IndulgeMark size={21} />
      </IconKnob>
      <span className="flex items-center gap-1.5">
        <span className="text-xs text-(--neu-accent)">✦</span>
        <span
          className="text-sm font-semibold text-(--neu-text-primary)"
          style={{
            fontFamily: 'var(--font-serif)',
            letterSpacing: '0.3em',
            paddingLeft: '0.3em',
          }}
        >
          SERENE
        </span>
      </span>
      <span className="relative">
        <IconKnob size={44} aria-label="Notifications">
          <Bell size={16} strokeWidth={1.7} />
        </IconKnob>
        {unread && (
          <span
            className="absolute top-2 right-[9px] w-2 h-2 rounded-full bg-(--neu-accent) pointer-events-none"
            style={{ border: '1.5px solid var(--neu-surface)' }}
          />
        )}
      </span>
    </div>
  );
}

export function DetailAppBar({
  title,
  onMore,
  backHref,
}: {
  /** tracked-caps context title, e.g. "REQUEST · GLB-4217" */
  title: string;
  onMore?: () => void;
  backHref?: string;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between">
      <IconKnob
        size={44}
        aria-label="Back"
        onClick={() => (backHref ? router.push(backHref) : router.back())}
      >
        <ArrowLeft size={16} strokeWidth={1.7} />
      </IconKnob>
      <span
        className="text-[11px] font-semibold text-(--neu-text-secondary)"
        style={{ letterSpacing: '0.18em', paddingLeft: '0.18em' }}
      >
        {title}
      </span>
      {onMore ? (
        <IconKnob size={44} aria-label="More" onClick={onMore}>
          <span className="text-[15px] tracking-[1px]">···</span>
        </IconKnob>
      ) : (
        <span className="w-11 h-11 shrink-0" aria-hidden />
      )}
    </div>
  );
}

/** Large greeting block — tracked date · Playfair greeting · secondary line. */
export function GreetingBlock({
  dateLabel,
  greeting,
  line,
}: {
  dateLabel: string;
  greeting: string;
  line: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 px-1">
      <span
        className="text-[11px] font-semibold text-(--neu-accent-deep)"
        style={{ letterSpacing: '0.14em' }}
      >
        {dateLabel}
      </span>
      <span
        className="text-[26px] font-semibold text-(--neu-text-primary)"
        style={{ fontFamily: 'var(--font-serif)' }}
      >
        {greeting}
      </span>
      <span className="text-[12.5px] text-(--neu-text-secondary)">{line}</span>
    </div>
  );
}
