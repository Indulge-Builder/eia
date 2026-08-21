import type { AppDomain } from '@/lib/types/database';

/**
 * Hand-declared activity-stream row types (migration 0159 — mobile-ops §8).
 * `database.ts` does not include activity_events yet; fold onto the generated
 * Rows at the next regen (the elaya/revival/usage precedent). Types only —
 * no runtime values.
 */

export type ActivitySubjectType = 'lead' | 'task' | 'deal';

export type ActivityEventType =
  | 'call_logged'
  | 'note_added'
  | 'status_changed'
  | 'lead_assigned'
  | 'task_created'
  | 'task_completed'
  | 'deal_logged';

export type ActivityEventRow = {
  id: string;
  domain: AppDomain;
  actor_id: string | null;
  subject_type: ActivitySubjectType;
  subject_id: string | null;
  event_type: ActivityEventType;
  title: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};
