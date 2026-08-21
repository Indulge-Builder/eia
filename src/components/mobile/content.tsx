import Link from 'next/link';
import { Check, ChevronRight, X } from 'lucide-react';
import type { DemoRequest, DemoVertical, RequestStatus } from './demo-data';
import { DEMO_VERTICALS } from './demo-data';

/**
 * Mobile content & feedback (§04). The status dot speaks:
 * sage = settled · accent + breathe = waiting on you ·
 * clay = needs attention (sub line goes clay too — never red).
 */

const STATUS_DOT: Record<RequestStatus, { token: string; breathe: boolean }> = {
  settled:   { token: 'var(--neu-sage)',   breathe: false },
  waiting:   { token: 'var(--neu-accent)', breathe: true },
  attention: { token: 'var(--neu-danger)', breathe: false },
};

export function StatusDot({ status, size = 9 }: { status: RequestStatus; size?: number }) {
  const dot = STATUS_DOT[status];
  return (
    <span
      className={`shrink-0 rounded-full ${dot.breathe ? 'neu-m-breathe' : ''}`}
      style={{ width: size, height: size, background: dot.token }}
    />
  );
}

export function RequestRow({ request }: { request: DemoRequest }) {
  const vertical = DEMO_VERTICALS.find((v) => v.key === request.vertical) as DemoVertical;
  const Icon = vertical.icon;
  const attention = request.status === 'attention';
  return (
    <Link
      href={`/m/requests/${request.ref}`}
      className="neu-m-touch flex items-center gap-3 min-h-[68px] px-3.5 py-3 rounded-[22px] bg-(--neu-surface-high) border border-(--neu-edge)"
      style={{ boxShadow: 'var(--neu-shadow-raised-sm)' }}
    >
      <span
        className="w-[42px] h-[42px] shrink-0 rounded-[14px] bg-(--neu-surface) flex items-center justify-center"
        style={{
          color: attention ? 'var(--neu-danger-deep)' : vertical.iconToken,
          boxShadow: 'var(--neu-shadow-raised-sm)',
        }}
      >
        <Icon size={16} strokeWidth={1.7} />
      </span>
      <span className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className="text-[13.5px] font-semibold text-(--neu-text-primary) truncate">
          {request.title}
        </span>
        <span
          className={`text-[11.5px] ${
            attention
              ? 'font-medium text-(--neu-danger-deep)'
              : 'text-(--neu-text-secondary)'
          }`}
        >
          {request.sub}
        </span>
      </span>
      <StatusDot status={request.status} />
      <ChevronRight size={13} strokeWidth={2} className="shrink-0 text-(--neu-text-tertiary)" />
    </Link>
  );
}

export function VerticalTile({ vertical, compact = false }: { vertical: DemoVertical; compact?: boolean }) {
  const Icon = vertical.icon;
  return (
    <Link
      href="/m/requests"
      className={`neu-m-touch flex flex-col rounded-[22px] bg-(--neu-surface) border border-(--neu-edge) ${
        compact ? 'gap-2 p-3.5' : 'gap-2.5 p-4'
      }`}
      style={{ boxShadow: 'var(--neu-shadow-raised)' }}
    >
      <span
        className={`shrink-0 rounded-[13px] bg-(--neu-surface-high) flex items-center justify-center ${
          compact ? 'w-9 h-9' : 'w-10 h-10'
        }`}
        style={{ color: vertical.iconToken, boxShadow: 'var(--neu-shadow-raised-sm)' }}
      >
        <Icon size={compact ? 14 : 16} strokeWidth={1.7} />
      </span>
      <span className="flex flex-col gap-px">
        <span
          className={`font-semibold text-(--neu-text-primary) ${compact ? 'text-[15px]' : 'text-base'}`}
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {vertical.label}
        </span>
        <span className="text-[11px] text-(--neu-text-secondary)">{vertical.micro}</span>
      </span>
    </Link>
  );
}

/** Inset progress — well track 12 (padding 3) + accent-grad sweep; % in Playfair. */
export function ProgressCard({
  title,
  percent,
  micro,
}: {
  title: string;
  percent: number;
  micro: string;
}) {
  return (
    <div
      className="flex flex-col gap-2.5 p-4 rounded-3xl bg-(--neu-surface-high) border border-(--neu-edge)"
      style={{ boxShadow: 'var(--neu-shadow-raised-sm)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-(--neu-text-primary)">{title}</span>
        <span
          className="text-[15px] font-semibold text-(--neu-accent-deep)"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {percent}%
        </span>
      </div>
      <div
        className="h-3 rounded-full p-[3px] bg-(--neu-well)"
        style={{ boxShadow: 'var(--neu-shadow-inset)' }}
      >
        <div
          className="neu-sweep h-full rounded-full"
          style={{
            width: `${percent}%`,
            background: 'var(--neu-accent-gradient)',
            boxShadow: '1px 1px 3px rgb(var(--neu-dark) / 0.4)',
          }}
        />
      </div>
      <span className="text-[11px] text-(--neu-text-tertiary)">{micro}</span>
    </div>
  );
}

/** Toast pill — full-width raised pill floating above the tab bar. */
export function ToastPill({
  tone,
  title,
  sub,
  actionLabel,
  onAction,
}: {
  tone: 'confirm' | 'attention';
  title: string;
  sub: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const confirm = tone === 'confirm';
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-full bg-(--neu-surface) border border-(--neu-edge-strong)"
      style={{ boxShadow: 'var(--neu-shadow-raised-lg)' }}
      role="status"
    >
      <span
        className="w-[34px] h-[34px] shrink-0 rounded-full bg-(--neu-surface-high) flex items-center justify-center"
        style={{
          color: confirm ? 'var(--neu-sage-deep)' : 'var(--neu-danger-deep)',
          boxShadow: 'var(--neu-shadow-raised-sm)',
        }}
      >
        {confirm ? <Check size={14} strokeWidth={2} /> : <X size={14} strokeWidth={2} />}
      </span>
      <span className="flex flex-col min-w-0">
        <span className="text-[12.5px] font-semibold text-(--neu-text-primary)">{title}</span>
        <span className="text-[11px] text-(--neu-text-secondary) truncate">{sub}</span>
      </span>
      {actionLabel && (
        <button
          onClick={onAction}
          className="neu-m-touch-quiet ml-auto shrink-0 text-[11px] font-medium text-(--neu-accent-deep)"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/** Placing-request loader — ✦ halo disc + Playfair line + typing dots. */
export function PlacingLoader({
  title = 'Placing request',
  line = 'A moment — the house is listening',
}: {
  title?: string;
  line?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-4">
      <span className="neu-m-halo w-16 h-16 rounded-full bg-(--neu-surface) border border-(--neu-edge-strong) flex items-center justify-center text-[22px] text-(--neu-accent)">
        ✦
      </span>
      <span className="flex flex-col items-center gap-0.5">
        <span
          className="text-[17px] font-semibold text-(--neu-text-primary)"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          {title}
        </span>
        <span className="text-[11.5px] text-(--neu-text-secondary)">{line}</span>
      </span>
      <span className="flex gap-[5px] mt-0.5">
        {[0, 0.18, 0.36].map((delay) => (
          <span
            key={delay}
            className="neu-m-dot w-1.5 h-1.5 rounded-full bg-(--neu-accent)"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </span>
    </div>
  );
}
