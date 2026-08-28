-- Migration 0172: move the whole wag_ family into a dedicated `sia` schema.
--
-- Why: the wag_ message tables are monthly-PARTITIONED (correct for high-volume message
-- data), which means one new physical table per month. In `public` those partitions
-- clutter the table list alongside the real business tables (leads, deals, tasks…) and
-- only grow. A dedicated schema is the clean, Postgres-native separation the founder
-- asked for — the "cluster inside the project" idea, done right: SAME database (joins,
-- one backup, one connection, zero extra cost), but every wag_ table + partition tucked
-- into `sia`, out of the public list. We do this now, at pilot scale, before it grows.
--
-- Access model is UNCHANGED and stays tight: the `sia` schema is exposed to PostgREST but
-- USAGE + table grants go to service_role ONLY. The app's admin client (service_role)
-- reads it; anon/authenticated have no grants and no schema USAGE, so wag_ data stays
-- admin/founder-only exactly as before. RLS-enabled state moves with each table.
--
-- SET SCHEMA preserves all data, indexes, sequences, triggers, and the partition
-- attachments — nothing is recreated, nothing is lost.

CREATE SCHEMA IF NOT EXISTS sia;
GRANT USAGE ON SCHEMA sia TO service_role;

-- 1. Move every wag_ relation (parents 'p' + partitions/regular tables 'r') from public → sia.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname LIKE 'wag_%'
      AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE public.%I SET SCHEMA sia', r.relname);
  END LOOP;
END $$;

-- 2. Grants: service_role only, on existing + future sia tables/sequences.
GRANT ALL ON ALL TABLES IN SCHEMA sia TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA sia TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sia GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA sia GRANT ALL ON SEQUENCES TO service_role;

-- 3. Recreate the two helper functions IN sia with a sia-first search_path (they were
--    public-scoped and referenced public.wag_messages, which no longer exists there).
DROP FUNCTION IF EXISTS public.wag_group_activity();
CREATE OR REPLACE FUNCTION sia.wag_group_activity()
RETURNS TABLE (chat_jid text, message_count bigint, last_message_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = sia
AS $$
  SELECT chat_jid, count(*) AS message_count, max(wa_timestamp) AS last_message_at
  FROM wag_messages
  GROUP BY chat_jid;
$$;
REVOKE ALL ON FUNCTION sia.wag_group_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sia.wag_group_activity() TO service_role;

DROP FUNCTION IF EXISTS public.wag_add_month_partition(text, date);
CREATE OR REPLACE FUNCTION sia.wag_add_month_partition(p_parent text, p_month date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = sia
AS $$
DECLARE
  v_start date := date_trunc('month', p_month)::date;
  v_end   date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_child text := format('%s_%s', p_parent, to_char(v_start, 'YYYY_MM'));
BEGIN
  IF to_regclass('sia.' || v_child) IS NOT NULL THEN
    RETURN;
  END IF;
  EXECUTE format(
    'CREATE TABLE sia.%I PARTITION OF sia.%I FOR VALUES FROM (%L) TO (%L)',
    v_child, p_parent, v_start, v_end
  );
  EXECUTE format('ALTER TABLE sia.%I ENABLE ROW LEVEL SECURITY', v_child);
END;
$$;

-- 4. Drop the exposure probe table.
DROP TABLE IF EXISTS sia._probe;

-- 5. Make sure PostgREST exposes sia (set idempotently) + reload its cache so
--    sia.wag_* are visible on the REST path immediately.
ALTER ROLE authenticator SET pgrst.db_schemas = 'public, graphql_public, sia';
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';

COMMENT ON SCHEMA sia IS
  'The Sia module data (WhatsApp-group watcher, wag_ tables + partitions). Separate from '
  'public to keep the business-table list clean; service_role-only access; migration 0172.';
