-- ─────────────────────────────────────────────
-- get_leads_status_counts v4 — agent honours p_domain as ADDITIVE narrowing
--
-- The /leads domain filter is now visible to agents (cross-domain agents can
-- narrow their own list to one domain). The paginated query composes
-- `assigned_to = userId AND domain = X`; the count RPC's agent branch
-- previously ignored p_domain entirely, so the status pills / totalCount
-- would drift from the table (param-sync rule, perf C-1).
--
-- Security unchanged: the agent scope is still self-derived
-- (l.assigned_to = auth.uid()) — p_domain can only NARROW an agent's own
-- rows, never widen them. Manager scoping still ignores p_domain.
-- Body otherwise byte-identical to 0099. Signature unchanged (no DROP);
-- GRANT re-stated (CREATE OR REPLACE preserves it, stated for clarity).
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_leads_status_counts(
  p_agent_id   uuid        DEFAULT NULL,
  p_date_from  timestamptz DEFAULT NULL,
  p_date_to    timestamptz DEFAULT NULL,
  p_campaign   text        DEFAULT NULL,
  p_search     text        DEFAULT NULL,
  p_source     text        DEFAULT NULL,
  p_outcomes   text[]      DEFAULT NULL,
  p_statuses   text[]      DEFAULT NULL,
  p_domain     app_domain  DEFAULT NULL,
  p_going_cold timestamptz DEFAULT NULL
)
RETURNS TABLE(status text, cnt bigint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role   text := get_user_role();
  v_domain app_domain := get_user_domain();
BEGIN
  RETURN QUERY
  SELECT
    l.status::text,
    COUNT(*)::bigint
  FROM leads l
  WHERE
    l.archived_at IS NULL

    -- Role/domain constraints — mirrors RLS SELECT policies exactly.
    -- agent: self-derived assigned_to, p_domain composes as an extra AND
    -- (additive narrowing for cross-domain agents — can never widen scope);
    -- manager scoping is always self-derived, p_domain ignored;
    -- admin/founder: the optional Gia domain slice.
    AND CASE
      WHEN v_role = 'agent'   THEN l.assigned_to = auth.uid()
                                   AND (p_domain IS NULL OR l.domain = p_domain)
      WHEN v_role = 'manager' THEN l.domain = v_domain
      ELSE (p_domain IS NULL OR l.domain = p_domain)
    END

    -- Optional: agent_id filter (manager/admin/founder only — agent role constraint already wins)
    AND (p_agent_id IS NULL OR l.assigned_to = p_agent_id)

    -- Optional: date range — inclusive both ends, matching .gte()/.lte() in getLeadsByRole
    AND (p_date_from IS NULL OR l.created_at >= p_date_from)
    AND (p_date_to   IS NULL OR l.created_at <= p_date_to)

    -- Optional: campaign
    AND (p_campaign IS NULL OR l.utm_campaign = p_campaign)

    -- Optional: search — same generated column as every other search path
    -- (migration 0098); parameterised LIKE via concatenation of the pattern only
    AND (p_search IS NULL OR l.search_text ILIKE '%' || p_search || '%')

    -- Optional: source
    AND (p_source IS NULL OR l.source = p_source)

    -- Optional: going-cold preset — last activity older than the threshold,
    -- non-terminal statuses only. NULL last_activity_at rows are excluded by
    -- the < comparison, matching the .lt() behaviour (those are SLA-01A's
    -- never-contacted leads, not going-cold ones).
    AND (
      p_going_cold IS NULL
      OR (
        l.last_activity_at < p_going_cold
        AND l.status NOT IN ('won', 'lost', 'junk')
      )
    )

    -- Optional: last_call_outcome — treat empty array as "no filter"
    AND (
      p_outcomes IS NULL
      OR array_length(p_outcomes, 1) IS NULL
      OR array_length(p_outcomes, 1) = 0
      OR l.last_call_outcome::text = ANY(p_outcomes)
    )

    -- Optional: status filter — treat empty array as "no filter"
    AND (
      p_statuses IS NULL
      OR array_length(p_statuses, 1) IS NULL
      OR array_length(p_statuses, 1) = 0
      OR l.status::text = ANY(p_statuses)
    )

  GROUP BY l.status;
END;
$$;

-- GRANT must follow the function body — never before (stripped on CREATE OR REPLACE)
GRANT EXECUTE ON FUNCTION get_leads_status_counts(
  uuid, timestamptz, timestamptz, text, text, text, text[], text[], app_domain, timestamptz
) TO authenticated;
