-- ═══════════════════════════════════════════════════════════════════════════
-- Mobile Ops — the unified activity stream (docs/modules/mobile-ops.md §8).
--
-- ONE append-only table, modeled exactly on task_events (0144): domain-stamped
-- rows (no join on read), Realtime-enabled, admin-client emit only. The mobile
-- Activity room reads it as one indexed reverse-chronological scan + one
-- Realtime channel — flat performance regardless of how large the source
-- tables (lead_activities / task_events / deals) grow.
--
-- Emit seam: src/lib/services/activity-events.ts, called beside the writes in
-- the mutation cores (lead-mutations.ts, deals actions) and derived from the
-- task-event seam (task-events.ts) so task rows are never double-sourced.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── §1. Table ───────────────────────────────────────────────────────────
CREATE TABLE public.activity_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        public.app_domain NOT NULL,          -- stamped on the row (task_events precedent)
  actor_id      uuid REFERENCES public.profiles(id), -- null = system/webhook
  subject_type  text NOT NULL CHECK (subject_type IN ('lead', 'task', 'deal')),
  subject_id    uuid,
  event_type    text NOT NULL CHECK (event_type IN (
    'call_logged', 'note_added', 'status_changed', 'lead_assigned',
    'task_created', 'task_completed', 'deal_logged'
  )),
  title         text,                                -- denormalized snapshot — the feed needs no join
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,  -- outcome, from→to status, amount, …
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_events_domain_created
  ON public.activity_events (domain, created_at DESC);
CREATE INDEX idx_activity_events_subject
  ON public.activity_events (subject_id, created_at DESC);

COMMENT ON TABLE public.activity_events IS
  'Unified domain activity stream (mobile-ops §8). Append-only (A-11): no user '
  'INSERT/UPDATE/DELETE policy, ever — rows are emitted service-role from the '
  'mutation cores via emitActivityEvent. One row shape for lead/task/deal events; '
  'title is a denormalized snapshot so the feed reads without joins.';

-- ─── §2. RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- admin/founder see all; manager sees their domain; agent sees own actions
-- (mirrors the lead_activities posture). InitPlan-hoisted per 0088.
CREATE POLICY activity_events_select ON public.activity_events
  FOR SELECT USING (
    (SELECT public.get_user_role()) IN ('admin', 'founder')
    OR (
      (SELECT public.get_user_role()) = 'manager'
      AND domain = (SELECT public.get_user_domain())
    )
    OR actor_id = (SELECT auth.uid())
  );

-- No INSERT / UPDATE / DELETE policy — ever (A-11). Writes are admin-client
-- only from the emit seam (service-role bypasses RLS).

-- ─── §3. Realtime ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'activity_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_events;
  END IF;
END$$;

-- ─── §4. Light 30-day backfill ───────────────────────────────────────────
-- The feed shouldn't launch empty (mobile-ops §8 recommendation). Best-effort
-- snapshots; live rows flow from the emit seam from this migration onward.

-- Lead activities → call_logged / note_added / status_changed / lead_assigned
INSERT INTO public.activity_events
  (domain, actor_id, subject_type, subject_id, event_type, title, meta, created_at)
SELECT
  l.domain,
  la.actor_id,
  'lead',
  la.lead_id,
  CASE la.action_type
    WHEN 'agent_assigned' THEN 'lead_assigned'
    ELSE la.action_type
  END,
  NULLIF(TRIM(COALESCE(l.first_name, '') || ' ' || COALESCE(l.last_name, '')), ''),
  COALESCE(la.details, '{}'::jsonb),
  la.created_at
FROM public.lead_activities la
JOIN public.leads l ON l.id = la.lead_id
WHERE la.created_at >= now() - interval '30 days'
  AND la.action_type IN ('call_logged', 'note_added', 'status_changed', 'agent_assigned');

-- Task events → task_created / task_completed
INSERT INTO public.activity_events
  (domain, actor_id, subject_type, subject_id, event_type, title, meta, created_at)
SELECT
  te.domain,
  te.actor_id,
  'task',
  te.task_id,
  CASE WHEN te.event_type = 'created' THEN 'task_created' ELSE 'task_completed' END,
  te.task_title,
  te.meta,
  te.created_at
FROM public.task_events te
WHERE te.created_at >= now() - interval '30 days'
  AND (
    te.event_type = 'created'
    OR (te.event_type = 'status_changed' AND te.meta->>'to' = 'completed')
  );

-- Deals → deal_logged (by won_at, the deals cohort field)
INSERT INTO public.activity_events
  (domain, actor_id, subject_type, subject_id, event_type, title, meta, created_at)
SELECT
  d.domain,
  d.assigned_to,
  'deal',
  d.id,
  'deal_logged',
  d.contact_name,
  jsonb_build_object('amount', d.deal_amount, 'deal_type', d.deal_type),
  d.won_at
FROM public.deals d
WHERE d.won_at >= now() - interval '30 days'
  AND d.archived_at IS NULL;
