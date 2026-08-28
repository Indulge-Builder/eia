-- Migration 0170: RLS on the wag_ partitions + a future-proof partition helper.
--
-- Context: 0169 enabled RLS on the partitioned PARENTS (wag_messages, wag_raw_events)
-- with zero policies (deny-by-default, service-role only). PostgREST does NOT expose
-- partition child tables through the API (verified: a direct GET on
-- wag_messages_2026_08 returns PGRST205 "not in schema cache"), so there was never an
-- API hole. But:
--   • Postgres does NOT propagate ENABLE ROW LEVEL SECURITY from a partitioned parent
--     to its children — a direct query on a child (e.g. a future code path on a raw
--     DB connection) would not be RLS-gated.
--   • The Supabase dashboard flags each partition "Unrestricted", which is alarming.
-- So we enable RLS on every existing partition (defense-in-depth + clean dashboard),
-- and add a helper the monthly-partition maintenance uses so new partitions are never
-- created without RLS (the recurring trap this closes).

-- 1. Enable RLS on all existing partitions of both partitioned tables.
DO $$
DECLARE
  part regclass;
BEGIN
  FOR part IN
    SELECT inhrelid::regclass
    FROM pg_inherits
    WHERE inhparent IN ('public.wag_messages'::regclass, 'public.wag_raw_events'::regclass)
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', part);
  END LOOP;
END $$;

-- 2. THE partition-creation helper — creates one month's partition on a wag_ parent
--    AND enables RLS on it. The maintenance task (later pg_cron / the connector deploy
--    checklist) calls this instead of a bare CREATE TABLE, so a new month can never
--    land without RLS. Idempotent: skips a partition that already exists.
--
--    SECURITY DEFINER so the maintenance role need not own the parent; search_path
--    pinned (the SECURITY DEFINER hygiene rule).
CREATE OR REPLACE FUNCTION wag_add_month_partition(p_parent text, p_month date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date := date_trunc('month', p_month)::date;
  v_end   date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_child text := format('%s_%s', p_parent, to_char(v_start, 'YYYY_MM'));
BEGIN
  IF to_regclass('public.' || v_child) IS NOT NULL THEN
    RETURN; -- already exists
  END IF;
  EXECUTE format(
    'CREATE TABLE public.%I PARTITION OF public.%I FOR VALUES FROM (%L) TO (%L)',
    v_child, p_parent, v_start, v_end
  );
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_child);
END;
$$;

COMMENT ON FUNCTION wag_add_month_partition(text, date) IS
  'Creates one monthly partition on a wag_ partitioned parent (wag_messages / '
  'wag_raw_events) AND enables RLS on it. Use this for every future partition so a new '
  'month is never created without RLS (migration 0170). Idempotent.';
