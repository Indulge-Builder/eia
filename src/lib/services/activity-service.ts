import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { mapRows } from '@/lib/utils/rows';
import type { GiaDomain } from '@/lib/constants/domains';
import type { ActivityEventRow } from '@/lib/types/activity';

/**
 * THE activity_events read (migration 0159 — mobile-ops §8). One bounded,
 * keyset-paginated reverse-chronological read per domain. Admin client with
 * session-derived scope args (Q-13) — the gated action (actions/mobile.ts,
 * manager pinned to own domain) is the trust boundary. The live layer is the
 * mobile Activity room's Realtime subscription, not this read.
 */

export const ACTIVITY_FEED_PAGE_SIZE = 30;

export type ActivityFeedCursor = { createdAt: string; id: string };

export type ActivityFeedResult = {
  items: ActivityEventRow[];
  nextCursor: ActivityFeedCursor | null;
};

export async function getActivityFeed(
  domain: GiaDomain,
  cursor?: ActivityFeedCursor | null,
): Promise<ActivityFeedResult> {
  const admin = createAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- activity_events not yet in generated database.ts (regen pending, migration 0159)
  let query = (admin as any)
    .from('activity_events')
    .select('id, domain, actor_id, subject_type, subject_id, event_type, title, meta, created_at')
    .eq('domain', domain)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(ACTIVITY_FEED_PAGE_SIZE + 1);

  // Composite keyset over (created_at DESC, id DESC) — created_at is NOT NULL
  // here, but id stays in the cursor as the same-timestamp tiebreaker.
  if (cursor) {
    query = query.or(
      `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error('[activity-service] getActivityFeed failed:', error.message);
    return { items: [], nextCursor: null };
  }

  const rows = mapRows<ActivityEventRow, ActivityEventRow>(data, (row) => row);
  const hasMore = rows.length > ACTIVITY_FEED_PAGE_SIZE;
  const items = hasMore ? rows.slice(0, ACTIVITY_FEED_PAGE_SIZE) : rows;
  const last = items[items.length - 1];

  return {
    items,
    nextCursor: hasMore && last ? { createdAt: last.created_at, id: last.id } : null,
  };
}
