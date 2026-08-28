-- Migration 0171: wag_group_activity() — the per-group message count + last-activity
-- aggregate for the Sia group list. PostgREST can't GROUP BY, so this one grouped pass
-- replaces the getSiaGroups N+1 (was 2 queries PER group across 466 groups — 932 round
-- trips; now 1 call). Pilot scale (~10k messages) is a cheap single GROUP BY; if
-- wag_messages grows to millions, denormalise a per-group counter behind this same seam.
--
-- SECURITY DEFINER + pinned search_path (the migration hygiene rule). EXECUTE is locked
-- to service_role ONLY — the Sia service uses the admin client, and an authenticated
-- user must never be able to rpc this and read group message counts (client-conversation
-- metadata is admin/founder-only, like every wag_ read).

CREATE OR REPLACE FUNCTION wag_group_activity()
RETURNS TABLE (chat_jid text, message_count bigint, last_message_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT chat_jid, count(*) AS message_count, max(wa_timestamp) AS last_message_at
  FROM wag_messages
  GROUP BY chat_jid;
$$;

REVOKE ALL ON FUNCTION wag_group_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION wag_group_activity() TO service_role;

COMMENT ON FUNCTION wag_group_activity() IS
  'Per-group message_count + last_message_at for the Sia group list (migration 0171). '
  'service_role EXECUTE only — the admin-client Sia read path; never exposed to '
  'authenticated users (wag_ data is admin/founder-only).';
