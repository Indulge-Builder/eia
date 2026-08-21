-- Response time is now business-minutes (09:00–19:00 IST, Mon–Sat) everywhere.
--
-- Response time = minutes between lead creation and the status_changed→touched
-- activity. It was computed as WALL-CLOCK minutes/hours in four SQL sites, so
-- nights, Sundays, and off-hours inflated every number (a lead created Fri 18:00
-- IST and touched Mon 09:05 IST read as ~3,900 minutes). The decided fix: compute
-- all four in BUSINESS minutes via one new helper, matching the SLA engine's
-- documented business hours. Display units are unchanged (A/B/C in minutes, E in
-- hours = business minutes / 60), so no RPC return shape changes and no TypeScript
-- edits are needed.
--
-- The four sites (all CREATE OR REPLACE below, bodies copied verbatim from their
-- latest source migration, only the response-time expression changed):
--   A. _agent_core_metrics                    (20260611000101)
--   B. get_agent_performance benchmarks CTE   (20260611000101)
--   B. get_agent_roster_performance response  (20260611000101)
--   C. get_agent_roster_performance_for_elaya (20260625000149) — twin of B
--   E. get_campaign_detail_metrics            (20260608000087) — also gains the
--      missing negative-interval guard the other three already have.
--
-- The First-Touch Speed scorecard (get_agent_first_touch_pairs +
-- classifyFirstTouchPairs) is a DIFFERENT metric (first CALL) and is already
-- business-hours aware — deliberately not touched here.

-- ─────────────────────────────────────────────────────────────────────────────
-- 0. The helper: business-minutes clock for response-time metrics.
--    Window: 09:00–19:00 IST (Asia/Kolkata), Monday–Saturday. Sundays excluded.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.business_minutes_between(p_from timestamptz, p_to timestamptz)
returns numeric
language plpgsql
stable
as $$
declare
  s timestamp := p_from at time zone 'Asia/Kolkata';
  e timestamp := p_to   at time zone 'Asia/Kolkata';
  d date;
  total numeric := 0;
  seg_start timestamp;
  seg_end   timestamp;
begin
  if p_from is null or p_to is null or e <= s then
    return 0;
  end if;
  d := s::date;
  while d <= e::date loop
    if extract(isodow from d) <> 7 then  -- 7 = Sunday
      seg_start := greatest(s, d + time '09:00');
      seg_end   := least(e, d + time '19:00');
      if seg_end > seg_start then
        total := total + extract(epoch from (seg_end - seg_start)) / 60.0;
      end if;
    end if;
    d := d + 1;
  end loop;
  return total;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- A. _agent_core_metrics — body verbatim from 20260611000101; the only change is
--    the avg first-touch response expression (wall-clock minutes → business
--    minutes). WHERE clause (actor filter, new_status='touched', date window,
--    la.created_at >= l.created_at guard) unchanged.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION _agent_core_metrics(
  p_agent uuid,
  p_from  timestamptz,
  p_to    timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_leads_won bigint;
  v_total     bigint;
  v_touched   bigint;
  v_won       bigint;
  v_lost      bigint;
  v_avg_resp  numeric;
BEGIN
  -- leadsWon — when the lead became won (status_changed_at), not when created
  SELECT count(*) INTO v_leads_won
  FROM leads l
  WHERE l.assigned_to = p_agent
    AND l.status = 'won'
    AND l.archived_at IS NULL
    AND l.status_changed_at >= p_from AND l.status_changed_at <= p_to;

  -- touch rate cohort — leads created in the period; touched = moved past 'new'
  SELECT count(*), count(*) FILTER (WHERE l.status <> 'new')
    INTO v_total, v_touched
  FROM leads l
  WHERE l.assigned_to = p_agent
    AND l.archived_at IS NULL
    AND l.created_at >= p_from AND l.created_at <= p_to;

  -- conversion cohort — won+lost closed in the period (status_changed_at)
  SELECT count(*) FILTER (WHERE l.status = 'won'),
         count(*) FILTER (WHERE l.status = 'lost')
    INTO v_won, v_lost
  FROM leads l
  WHERE l.assigned_to = p_agent
    AND l.archived_at IS NULL
    AND l.status IN ('won', 'lost')
    AND l.status_changed_at >= p_from AND l.status_changed_at <= p_to;

  -- avg first-touch response — BUSINESS minutes (09:00–19:00 IST, Mon–Sat)
  -- between lead creation and the status_changed→touched activity; negative diffs
  -- excluded (la >= l guard), NULL when the agent touched nothing in the period
  SELECT AVG(public.business_minutes_between(l.created_at, la.created_at))
    INTO v_avg_resp
  FROM lead_activities la
  JOIN leads l ON l.id = la.lead_id
  WHERE la.actor_id = p_agent
    AND la.action_type = 'status_changed'
    AND la.details->>'new_status' = 'touched'
    AND la.created_at >= p_from AND la.created_at <= p_to
    AND la.created_at >= l.created_at;

  RETURN jsonb_build_object(
    'leads_won',            v_leads_won,
    'touch_total',          v_total,
    'touch_touched',        v_touched,
    'won_count',            v_won,
    'lost_count',           v_lost,
    'avg_response_minutes', v_avg_resp
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION _agent_core_metrics(uuid, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- B. get_agent_performance — body verbatim from 20260611000101; the only change
--    is the benchmarks `response` CTE avg_min expression (wall-clock → business
--    minutes). Every WHERE clause and every other CTE unchanged.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_agent_performance(
  p_date_from timestamptz,
  p_date_to   timestamptz,
  p_prev_from timestamptz DEFAULT NULL,
  p_prev_to   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_agent       uuid := auth.uid();
  v_domain      app_domain := get_user_domain();
  v_effort      jsonb;
  v_outcomes    jsonb;
  v_bench       jsonb;
  v_prev        jsonb := NULL;
  v_agent_count int;
BEGIN
  IF v_agent IS NULL THEN
    RAISE EXCEPTION 'get_agent_performance: no authenticated user';
  END IF;

  -- Effort — calls/notes are period-scoped; in_discussion/nurturing are LIVE
  -- pipeline counts (deliberately no period filter, matching the page contract)
  SELECT jsonb_build_object(
    'calls_logged', (
      SELECT count(*) FROM lead_notes n
      WHERE n.author_id = v_agent AND n.call_outcome IS NOT NULL
        AND n.created_at >= p_date_from AND n.created_at <= p_date_to
    ),
    'notes_written', (
      SELECT count(*) FROM lead_notes n
      WHERE n.author_id = v_agent
        AND n.created_at >= p_date_from AND n.created_at <= p_date_to
    ),
    'in_discussion', (
      SELECT count(*) FROM leads l
      WHERE l.assigned_to = v_agent AND l.status = 'in_discussion' AND l.archived_at IS NULL
    ),
    'nurturing', (
      SELECT count(*) FROM leads l
      WHERE l.assigned_to = v_agent AND l.status = 'nurturing' AND l.archived_at IS NULL
    )
  ) INTO v_effort;

  -- Call outcome breakdown — notes with an outcome, grouped (display order is
  -- the UI's concern; CallOutcomeBar sorts into canonical order)
  SELECT COALESCE(
    jsonb_agg(jsonb_build_object('outcome', o.call_outcome, 'count', o.cnt) ORDER BY o.cnt DESC),
    '[]'::jsonb
  )
  INTO v_outcomes
  FROM (
    SELECT n.call_outcome, count(*) AS cnt
    FROM lead_notes n
    WHERE n.author_id = v_agent AND n.call_outcome IS NOT NULL
      AND n.created_at >= p_date_from AND n.created_at <= p_date_to
    GROUP BY n.call_outcome
  ) o;

  -- Team benchmarks — unweighted mean of per-agent means over the caller's
  -- domain roster (each agent counts once regardless of lead volume; this is
  -- a documented design choice, not pool-wide averaging). agent_count is the
  -- roster count; the service applies the agent_count < 2 null guard.
  SELECT count(*) INTO v_agent_count
  FROM profiles pr
  WHERE pr.domain = v_domain AND pr.role = 'agent' AND pr.is_active = true;

  WITH peers AS (
    SELECT pr.id FROM profiles pr
    WHERE pr.domain = v_domain AND pr.role = 'agent' AND pr.is_active = true
  ),
  touch AS (
    SELECT l.assigned_to, count(*) AS total,
           count(*) FILTER (WHERE l.status <> 'new') AS touched
    FROM leads l JOIN peers p ON p.id = l.assigned_to
    WHERE l.archived_at IS NULL
      AND l.created_at >= p_date_from AND l.created_at <= p_date_to
    GROUP BY l.assigned_to
  ),
  closed AS (
    SELECT l.assigned_to,
           count(*) FILTER (WHERE l.status = 'won')  AS won,
           count(*) FILTER (WHERE l.status = 'lost') AS lost
    FROM leads l JOIN peers p ON p.id = l.assigned_to
    WHERE l.archived_at IS NULL
      AND l.status IN ('won', 'lost')
      AND l.status_changed_at >= p_date_from AND l.status_changed_at <= p_date_to
    GROUP BY l.assigned_to
  ),
  response AS (
    SELECT la.actor_id,
           AVG(public.business_minutes_between(l.created_at, la.created_at)) AS avg_min
    FROM lead_activities la
    JOIN peers p ON p.id = la.actor_id
    JOIN leads l ON l.id = la.lead_id
    WHERE la.action_type = 'status_changed'
      AND la.details->>'new_status' = 'touched'
      AND la.created_at >= p_date_from AND la.created_at <= p_date_to
      AND la.created_at >= l.created_at
    GROUP BY la.actor_id
  )
  SELECT jsonb_build_object(
    'agent_count',          v_agent_count,
    'avg_touch_rate',       (SELECT AVG(t.touched::numeric / t.total * 100) FROM touch t WHERE t.total > 0),
    'avg_conversion_rate',  (SELECT AVG(c.won::numeric / (c.won + c.lost) * 100) FROM closed c WHERE (c.won + c.lost) > 0),
    'avg_response_minutes', (SELECT AVG(r.avg_min) FROM response r)
  ) INTO v_bench;

  IF p_prev_from IS NOT NULL AND p_prev_to IS NOT NULL THEN
    v_prev := _agent_core_metrics(v_agent, p_prev_from, p_prev_to);
  END IF;

  RETURN jsonb_build_object(
    'core',       _agent_core_metrics(v_agent, p_date_from, p_date_to),
    'previous',   v_prev,
    'effort',     v_effort,
    'outcomes',   v_outcomes,
    'benchmarks', v_bench
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_agent_performance(timestamptz, timestamptz, timestamptz, timestamptz)
  TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- B. get_agent_roster_performance — body verbatim from 20260611000101; the only
--    change is the `response` CTE avg_min expression (wall-clock → business
--    minutes). Role gate, domain clamp, every WHERE clause and CTE unchanged.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_agent_roster_performance(
  p_date_from timestamptz,
  p_date_to   timestamptz,
  p_domain    app_domain DEFAULT NULL
)
RETURNS TABLE(
  agent_id             uuid,
  agent_name           text,
  agent_avatar_url     text,
  agent_domain         app_domain,
  total_leads          bigint,
  won_count            bigint,
  lost_count           bigint,
  total_deal_amount    numeric,
  avg_response_minutes numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_role   text := get_user_role();
  v_domain app_domain;
BEGIN
  IF v_role NOT IN ('manager', 'admin', 'founder') THEN
    RETURN; -- agents/guests get no roster rows
  END IF;

  IF v_role = 'manager' THEN
    v_domain := get_user_domain(); -- never caller-supplied for managers
  ELSE
    v_domain := p_domain; -- admin/founder: NULL = all domains
  END IF;

  RETURN QUERY
  WITH roster AS (
    SELECT pr.id, pr.full_name, pr.avatar_url, pr.domain
    FROM profiles pr
    WHERE pr.role = 'agent'
      AND pr.is_active = true
      AND (v_domain IS NULL OR pr.domain = v_domain)
  ),
  cohort AS (
    -- touch-rate denominator: leads created in the period
    SELECT l.assigned_to, count(*) AS total
    FROM leads l JOIN roster r ON r.id = l.assigned_to
    WHERE l.archived_at IS NULL
      AND l.created_at >= p_date_from AND l.created_at <= p_date_to
    GROUP BY l.assigned_to
  ),
  closed AS (
    -- conversion: won/lost closed in the period (status_changed_at)
    SELECT l.assigned_to,
           count(*) FILTER (WHERE l.status = 'won')  AS won,
           count(*) FILTER (WHERE l.status = 'lost') AS lost
    FROM leads l JOIN roster r ON r.id = l.assigned_to
    WHERE l.archived_at IS NULL
      AND l.status IN ('won', 'lost')
      AND l.status_changed_at >= p_date_from AND l.status_changed_at <= p_date_to
    GROUP BY l.assigned_to
  ),
  revenue AS (
    -- deal revenue lives on public.deals, filtered by won_at (not leads)
    SELECT d.assigned_to, SUM(d.deal_amount) AS amount
    FROM deals d JOIN roster r ON r.id = d.assigned_to
    WHERE d.archived_at IS NULL
      AND d.won_at >= p_date_from AND d.won_at <= p_date_to
    GROUP BY d.assigned_to
  ),
  response AS (
    SELECT la.actor_id,
           AVG(public.business_minutes_between(l.created_at, la.created_at)) AS avg_min
    FROM lead_activities la
    JOIN roster r ON r.id = la.actor_id
    JOIN leads  l ON l.id = la.lead_id
    WHERE la.action_type = 'status_changed'
      AND la.details->>'new_status' = 'touched'
      AND la.created_at >= p_date_from AND la.created_at <= p_date_to
      AND la.created_at >= l.created_at
    GROUP BY la.actor_id
  )
  SELECT
    r.id,
    r.full_name,
    r.avatar_url,
    r.domain,
    COALESCE(c.total, 0)::bigint,
    COALESCE(cl.won, 0)::bigint,
    COALESCE(cl.lost, 0)::bigint,
    COALESCE(rv.amount, 0)::numeric,
    rs.avg_min
  FROM roster r
  LEFT JOIN cohort   c  ON c.assigned_to  = r.id
  LEFT JOIN closed   cl ON cl.assigned_to = r.id
  LEFT JOIN revenue  rv ON rv.assigned_to = r.id
  LEFT JOIN response rs ON rs.actor_id    = r.id
  ORDER BY r.full_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_agent_roster_performance(timestamptz, timestamptz, app_domain)
  TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- C. get_agent_roster_performance_for_elaya — the byte-identical twin of B; body
--    verbatim from 20260625000149, the only change is the `response` CTE avg_min
--    expression (wall-clock → business minutes) — applied identically so the twin
--    stays metric-identical to the roster RPC. Q-13 revoke posture preserved.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_agent_roster_performance_for_elaya(
  p_date_from timestamptz,
  p_date_to   timestamptz,
  p_domain    app_domain DEFAULT NULL
)
RETURNS TABLE(
  agent_id             uuid,
  agent_name           text,
  agent_avatar_url     text,
  agent_domain         app_domain,
  total_leads          bigint,
  won_count            bigint,
  lost_count           bigint,
  total_deal_amount    numeric,
  avg_response_minutes numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_domain app_domain := p_domain; -- trusted: Elaya passed the clamped scope
BEGIN
  RETURN QUERY
  WITH roster AS (
    SELECT pr.id, pr.full_name, pr.avatar_url, pr.domain
    FROM profiles pr
    WHERE pr.role = 'agent'
      AND pr.is_active = true
      AND (v_domain IS NULL OR pr.domain = v_domain)
  ),
  cohort AS (
    SELECT l.assigned_to, count(*) AS total
    FROM leads l JOIN roster r ON r.id = l.assigned_to
    WHERE l.archived_at IS NULL
      AND l.created_at >= p_date_from AND l.created_at <= p_date_to
    GROUP BY l.assigned_to
  ),
  closed AS (
    SELECT l.assigned_to,
           count(*) FILTER (WHERE l.status = 'won')  AS won,
           count(*) FILTER (WHERE l.status = 'lost') AS lost
    FROM leads l JOIN roster r ON r.id = l.assigned_to
    WHERE l.archived_at IS NULL
      AND l.status IN ('won', 'lost')
      AND l.status_changed_at >= p_date_from AND l.status_changed_at <= p_date_to
    GROUP BY l.assigned_to
  ),
  revenue AS (
    SELECT d.assigned_to, SUM(d.deal_amount) AS amount
    FROM deals d JOIN roster r ON r.id = d.assigned_to
    WHERE d.archived_at IS NULL
      AND d.won_at >= p_date_from AND d.won_at <= p_date_to
    GROUP BY d.assigned_to
  ),
  response AS (
    SELECT la.actor_id,
           AVG(public.business_minutes_between(l.created_at, la.created_at)) AS avg_min
    FROM lead_activities la
    JOIN roster r ON r.id = la.actor_id
    JOIN leads  l ON l.id = la.lead_id
    WHERE la.action_type = 'status_changed'
      AND la.details->>'new_status' = 'touched'
      AND la.created_at >= p_date_from AND la.created_at <= p_date_to
      AND la.created_at >= l.created_at
    GROUP BY la.actor_id
  )
  SELECT
    r.id,
    r.full_name,
    r.avatar_url,
    r.domain,
    COALESCE(c.total, 0)::bigint,
    COALESCE(cl.won, 0)::bigint,
    COALESCE(cl.lost, 0)::bigint,
    COALESCE(rv.amount, 0)::numeric,
    rs.avg_min
  FROM roster r
  LEFT JOIN cohort   c  ON c.assigned_to  = r.id
  LEFT JOIN closed   cl ON cl.assigned_to = r.id
  LEFT JOIN revenue  rv ON rv.assigned_to = r.id
  LEFT JOIN response rs ON rs.actor_id    = r.id
  ORDER BY r.full_name ASC;
END;
$$;

REVOKE EXECUTE ON FUNCTION get_agent_roster_performance_for_elaya(timestamptz, timestamptz, app_domain) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION get_agent_roster_performance_for_elaya(timestamptz, timestamptz, app_domain) TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- E. get_campaign_detail_metrics — body verbatim from 20260608000087; two changes:
--    (1) avg_hours_to_first_touch now BUSINESS hours (business minutes / 60);
--    (2) the missing negative-interval guard added to the lateral's WHERE
--        (AND la.created_at >= l.created_at) — matching the guard the other three
--        sites already carry. No actor filter added: this is a campaign-level
--        pipeline metric. WHERE clause, date window, return shape unchanged.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_campaign_detail_metrics(
  p_campaign  text,
  p_date_from timestamptz DEFAULT NULL,
  p_date_to   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  campaign_name          text,
  total_leads            bigint,
  status_new             bigint,
  status_touched         bigint,
  status_in_discussion   bigint,
  status_won             bigint,
  status_nurturing       bigint,
  status_lost            bigint,
  status_junk            bigint,
  outcome_rnr            bigint,
  outcome_switched_off   bigint,
  outcome_converted      bigint,
  avg_hours_to_first_touch double precision
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT
    l.utm_campaign                                                       AS campaign_name,
    COUNT(*)                                                             AS total_leads,
    COUNT(*) FILTER (WHERE l.status = 'new')                            AS status_new,
    COUNT(*) FILTER (WHERE l.status = 'touched')                        AS status_touched,
    COUNT(*) FILTER (WHERE l.status = 'in_discussion')                  AS status_in_discussion,
    COUNT(*) FILTER (WHERE l.status = 'won')                            AS status_won,
    COUNT(*) FILTER (WHERE l.status = 'nurturing')                      AS status_nurturing,
    COUNT(*) FILTER (WHERE l.status = 'lost')                           AS status_lost,
    COUNT(*) FILTER (WHERE l.status = 'junk')                           AS status_junk,
    COUNT(*) FILTER (WHERE l.last_call_outcome = 'rnr')                 AS outcome_rnr,
    COUNT(*) FILTER (WHERE l.last_call_outcome = 'switched_off')        AS outcome_switched_off,
    COUNT(*) FILTER (WHERE l.last_call_outcome = 'converted')           AS outcome_converted,
    AVG(
      public.business_minutes_between(l.created_at, ft.first_touched_at) / 60.0
    )                                                                    AS avg_hours_to_first_touch
  FROM leads l
  LEFT JOIN LATERAL (
    SELECT MIN(la.created_at) AS first_touched_at
    FROM lead_activities la
    WHERE la.lead_id = l.id
      AND la.action_type = 'status_changed'
      AND la.details->>'new_status' = 'touched'
      AND la.created_at >= l.created_at
  ) ft ON true
  WHERE l.archived_at IS NULL
    AND l.utm_campaign = p_campaign
    AND (p_date_from IS NULL OR l.created_at >= p_date_from)
    AND (p_date_to   IS NULL OR l.created_at <= p_date_to)
  GROUP BY l.utm_campaign;
$$;

REVOKE EXECUTE ON FUNCTION get_campaign_detail_metrics(text, timestamptz, timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION get_campaign_detail_metrics(text, timestamptz, timestamptz) TO service_role;
