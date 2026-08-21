-- ═══════════════════════════════════════════════════════════════════════════
-- Mobile Ops — Tasks room aggregation (docs/modules/mobile-ops.md §7).
--
-- get_domain_task_summary(p_domain, p_from, p_to) — one pre-aggregated row per
-- assignee for the domain's tasks. NO schema change: tasks.assigned_to /
-- status / due_at / created_at / completed_at + task_groups.domain already
-- exist. Task→domain derivation mirrors resolveTaskDomain (task-events.ts):
-- COALESCE(group domain, assignee profile domain).
--
-- Scope-param RPC (takes p_domain) → Q-13 revoked tier (0102 pattern):
-- EXECUTE revoked from PUBLIC/anon/authenticated, GRANTed service_role only.
-- Called via callAdminRpc from tasks-service with session-derived args — the
-- gated action (actions/mobile.ts) is the trust boundary.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_domain_task_summary(
  p_domain public.app_domain,
  p_from   timestamptz,
  p_to     timestamptz
)
RETURNS TABLE (
  agent_id        uuid,
  agent_name      text,
  created_count   int,
  completed_count int,
  open_count      int,
  overdue_count   int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH domain_tasks AS (
    SELECT t.id, t.assigned_to, t.status, t.due_at, t.created_at, t.completed_at
    FROM tasks t
    LEFT JOIN task_groups tg ON tg.id = t.group_id
    LEFT JOIN profiles ap ON ap.id = t.assigned_to
    WHERE COALESCE(tg.domain, ap.domain) = p_domain
  )
  SELECT
    dt.assigned_to AS agent_id,
    COALESCE(p.full_name, 'Unassigned') AS agent_name,
    (COUNT(*) FILTER (
      WHERE dt.created_at >= p_from AND dt.created_at < p_to
    ))::int AS created_count,
    (COUNT(*) FILTER (
      WHERE dt.completed_at IS NOT NULL
        AND dt.completed_at >= p_from AND dt.completed_at < p_to
    ))::int AS completed_count,
    (COUNT(*) FILTER (
      WHERE dt.status IN ('to_do', 'in_progress', 'in_review')
    ))::int AS open_count,
    (COUNT(*) FILTER (
      WHERE dt.status IN ('to_do', 'in_progress', 'in_review')
        AND dt.due_at IS NOT NULL AND dt.due_at < now()
    ))::int AS overdue_count
  FROM domain_tasks dt
  LEFT JOIN profiles p ON p.id = dt.assigned_to
  GROUP BY dt.assigned_to, p.full_name
  HAVING
       COUNT(*) FILTER (WHERE dt.created_at >= p_from AND dt.created_at < p_to) > 0
    OR COUNT(*) FILTER (WHERE dt.completed_at IS NOT NULL
                          AND dt.completed_at >= p_from AND dt.completed_at < p_to) > 0
    OR COUNT(*) FILTER (WHERE dt.status IN ('to_do', 'in_progress', 'in_review')) > 0
  ORDER BY open_count DESC, agent_name ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_domain_task_summary(public.app_domain, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_domain_task_summary(public.app_domain, timestamptz, timestamptz)
  TO service_role;
