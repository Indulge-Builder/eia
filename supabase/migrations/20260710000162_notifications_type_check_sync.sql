-- Migration 0162: notifications.type CHECK — sync with the full NotificationType union
--
-- The base CHECK (migration 0016) allowed only the original five values; migrations
-- 0017/0113/0136 widened it, but the union in src/lib/types/database.ts (NotificationType)
-- is the source of truth and had drifted AHEAD of every applied CHECK: an insert of a
-- type present in the TS union but absent from the constraint fails silently
-- (createNotification returns an error, no bell row is ever created).
--
-- This DROP + re-ADD re-states EVERY member of the TS union verbatim. Omitting any one
-- would silently narrow the constraint and break that type's inserts, so the list here
-- must stay byte-for-byte in step with NotificationType. Widening it later = a new
-- migration extending this list, never an edit to an applied migration.

ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
    CHECK (type IN (
      'lead_assigned',
      'lead_won',
      'task_due',
      'task_assigned',
      'mention',
      'system',
      'sla_breach_agent',
      'sla_breach_manager',
      'sla_breach_founder',
      'task_overdue_manager',
      'suggestion_resolved'
    ));
