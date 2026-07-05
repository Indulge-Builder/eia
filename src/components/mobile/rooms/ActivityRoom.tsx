'use client';

import { useCallback, useEffect, useId, useState } from 'react';
import {
  Phone,
  FileText,
  ArrowRightLeft,
  UserPlus,
  Plus,
  Check,
  BadgeCheck,
  type LucideIcon,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  ListCard,
  ListRow,
  PaneLoader,
  PaneError,
  RoomEmpty,
  RoomTitle,
  ComingSoonCard,
} from './room-bits';
import { DomainSwiper } from '../DomainSwiper';
import { getActivityFeedAction } from '@/lib/actions/mobile';
import { formatRelativeTime } from '@/lib/utils/dates';
import { formatCurrencyCompact } from '@/lib/utils/numbers';
import { LEAD_STATUS_LABELS } from '@/lib/constants/lead-statuses';
import { DEFAULT_GIA_DOMAIN, type GiaDomain } from '@/lib/constants/domains';
import type { LeadStatus } from '@/lib/types/database';
import type { ActivityEventRow, ActivityEventType } from '@/lib/types/activity';
import type { ActivityFeedResult, ActivityFeedCursor } from '@/lib/services/activity-service';

/**
 * Activity room (/m/activity — mobile-ops §3 room 5): "Everything
 * happening in a domain, live." One indexed read (getActivityFeedAction,
 * keyset load-more) + ONE Realtime channel per active domain filtered
 * domain=eq.<x> (the OversightRail subscription pattern; RLS gates rows).
 * Domain swipe = swap the channel filter.
 */

const EVENT_PRESENTATION: Record<
  ActivityEventType,
  { label: string; icon: LucideIcon; token: string }
> = {
  call_logged: { label: 'Call logged', icon: Phone, token: 'var(--neu-powder-deep)' },
  note_added: { label: 'Note added', icon: FileText, token: 'var(--neu-text-secondary)' },
  status_changed: { label: 'Status moved', icon: ArrowRightLeft, token: 'var(--neu-butter-deep)' },
  lead_assigned: { label: 'Lead assigned', icon: UserPlus, token: 'var(--neu-powder-deep)' },
  task_created: { label: 'Task created', icon: Plus, token: 'var(--neu-text-secondary)' },
  task_completed: { label: 'Task completed', icon: Check, token: 'var(--neu-sage-deep)' },
  deal_logged: { label: 'Deal closed', icon: BadgeCheck, token: 'var(--neu-sage-deep)' },
};

function statusWord(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) return '?';
  return LEAD_STATUS_LABELS[value as LeadStatus] ?? value;
}

function eventDetail(event: ActivityEventRow): string {
  const meta = event.meta ?? {};
  switch (event.event_type) {
    case 'call_logged':
      return typeof meta.outcome === 'string'
        ? meta.outcome.replace(/_/g, ' ')
        : EVENT_PRESENTATION.call_logged.label;
    case 'status_changed':
      return `${statusWord(meta.from)} → ${statusWord(meta.to)}`;
    case 'lead_assigned':
      return typeof meta.agent_name === 'string'
        ? `to ${meta.agent_name}`
        : EVENT_PRESENTATION.lead_assigned.label;
    case 'deal_logged':
      return typeof meta.amount === 'number'
        ? formatCurrencyCompact(meta.amount)
        : EVENT_PRESENTATION.deal_logged.label;
    default:
      return EVENT_PRESENTATION[event.event_type].label;
  }
}

type FeedState = {
  items: ActivityEventRow[];
  nextCursor: ActivityFeedCursor | null;
};

function ActivityPane({
  feed,
  error,
  loadingMore,
  onRetry,
  onLoadMore,
}: {
  feed: FeedState | undefined;
  error: string | undefined;
  loadingMore: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
}) {
  if (error) return <PaneError message={error} onRetry={onRetry} />;
  if (!feed) return <PaneLoader />;

  if (feed.items.length === 0) {
    return <RoomEmpty>All quiet — the stream begins with the next move.</RoomEmpty>;
  }

  return (
    <>
      <ListCard>
        {feed.items.map((event, i) => {
          const p = EVENT_PRESENTATION[event.event_type];
          return (
            <ListRow
              key={event.id}
              icon={p.icon}
              iconToken={p.token}
              title={event.title ?? p.label}
              sub={`${eventDetail(event)} · ${formatRelativeTime(event.created_at)}`}
              divider={i < feed.items.length - 1}
            />
          );
        })}
      </ListCard>
      {feed.nextCursor && (
        <button
          onClick={onLoadMore}
          disabled={loadingMore}
          className="neu-m-touch-quiet self-center h-11 px-5 rounded-full text-[12px] font-medium text-(--neu-accent-deep) disabled:opacity-50"
        >
          {loadingMore ? 'Fetching…' : 'Earlier'}
        </button>
      )}
    </>
  );
}

export function ActivityRoom({
  domains,
  seed,
}: {
  domains: GiaDomain[];
  seed: ActivityFeedResult | null;
}) {
  const initialDomain = domains[0] ?? DEFAULT_GIA_DOMAIN;
  const [activeDomain, setActiveDomain] = useState<GiaDomain>(initialDomain);
  const [feeds, setFeeds] = useState<Partial<Record<GiaDomain, FeedState>>>(() =>
    seed ? { [initialDomain]: seed } : {},
  );
  const [errors, setErrors] = useState<Partial<Record<GiaDomain, string>>>({});
  const [loadingMore, setLoadingMore] = useState(false);
  const mountId = useId();

  const load = useCallback(async (domain: GiaDomain) => {
    setErrors((prev) => {
      const next = { ...prev };
      delete next[domain];
      return next;
    });
    const res = await getActivityFeedAction({ domain });
    if (res.data) {
      const data = res.data;
      setFeeds((prev) => ({ ...prev, [domain]: data }));
    } else {
      setErrors((prev) => ({
        ...prev,
        [domain]: res.error ?? 'The house could not fetch this just now.',
      }));
    }
  }, []);

  // Fetch a domain's feed the first time it becomes active.
  useEffect(() => {
    if (domains.length === 0) return;
    if (feeds[activeDomain] === undefined && !errors[activeDomain]) {
      void load(activeDomain);
    }
  }, [activeDomain, domains.length, feeds, errors, load]);

  // ONE Realtime channel per active domain — swap on swipe (P-06 teardown,
  // useId mount nonce for Strict Mode). RLS gates what each role receives.
  useEffect(() => {
    if (domains.length === 0) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`activity-${activeDomain}-${mountId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_events',
          filter: `domain=eq.${activeDomain}`,
        },
        (payload) => {
          const row = payload.new as ActivityEventRow;
          setFeeds((prev) => {
            const feed = prev[activeDomain];
            if (!feed || feed.items.some((e) => e.id === row.id)) return prev;
            return {
              ...prev,
              [activeDomain]: { ...feed, items: [row, ...feed.items] },
            };
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeDomain, domains.length, mountId]);

  const loadMore = useCallback(async () => {
    const feed = feeds[activeDomain];
    if (!feed?.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getActivityFeedAction({
        domain: activeDomain,
        cursor: feed.nextCursor,
      });
      if (res.data) {
        const page = res.data;
        setFeeds((prev) => {
          const current = prev[activeDomain];
          if (!current) return prev;
          const seen = new Set(current.items.map((e) => e.id));
          return {
            ...prev,
            [activeDomain]: {
              items: [...current.items, ...page.items.filter((e) => !seen.has(e.id))],
              nextCursor: page.nextCursor,
            },
          };
        });
      }
    } finally {
      setLoadingMore(false);
    }
  }, [activeDomain, feeds, loadingMore]);

  return (
    <>
      <div className="flex items-center justify-between pr-1">
        <RoomTitle>Activity</RoomTitle>
        <span className="flex items-center gap-1.5" aria-hidden>
          <span className="neu-m-breathe w-2 h-2 rounded-full bg-(--neu-accent)" />
          <span
            className="text-[10px] font-semibold text-(--neu-text-tertiary)"
            style={{ letterSpacing: '0.14em' }}
          >
            LIVE
          </span>
        </span>
      </div>
      {domains.length === 0 ? (
        <ComingSoonCard
          title="Your rooms are being prepared."
          line="The mobile view for your role arrives in a later phase."
        />
      ) : (
        <DomainSwiper
          domains={domains}
          activeDomain={activeDomain}
          onDomainChange={setActiveDomain}
          renderDomain={(d) => (
            <ActivityPane
              feed={feeds[d]}
              error={errors[d]}
              loadingMore={loadingMore && d === activeDomain}
              onRetry={() => load(d)}
              onLoadMore={loadMore}
            />
          )}
        />
      )}
    </>
  );
}
