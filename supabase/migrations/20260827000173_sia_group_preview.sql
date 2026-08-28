-- Migration 0173: extend sia.wag_group_activity() with a last-message preview.
--
-- Why: the /sia group rail now renders WhatsApp-Web-style rows (subject, time,
-- and a one-line preview of the latest message). The preview must come from the
-- same single aggregate pass the rail already makes — never a per-group N+1.
--
-- The return type changes, so the function is dropped and recreated (CREATE OR
-- REPLACE cannot alter OUT columns). Posture unchanged: SECURITY DEFINER with a
-- sia-pinned search_path, EXECUTE revoked from everything except service_role.

DROP FUNCTION IF EXISTS sia.wag_group_activity();

CREATE FUNCTION sia.wag_group_activity()
RETURNS TABLE (
  chat_jid          text,
  message_count     bigint,
  last_message_at   timestamptz,
  last_text         text,
  last_type         text,
  last_sender_name  text,
  last_from_me      boolean,
  last_is_revoked   boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = sia
AS $$
  WITH agg AS (
    SELECT m.chat_jid, count(*) AS message_count, max(m.wa_timestamp) AS last_message_at
    FROM wag_messages m
    GROUP BY m.chat_jid
  ),
  last_msg AS (
    SELECT DISTINCT ON (m.chat_jid)
      m.chat_jid, m.text, m.type, m.sender_jid, m.from_me, m.is_revoked
    FROM wag_messages m
    ORDER BY m.chat_jid, m.wa_timestamp DESC
  )
  SELECT
    a.chat_jid,
    a.message_count,
    a.last_message_at,
    l.text,
    l.type,
    c.push_name,
    l.from_me,
    l.is_revoked
  FROM agg a
  LEFT JOIN last_msg l ON l.chat_jid = a.chat_jid
  LEFT JOIN wag_contacts c ON c.jid = l.sender_jid;
$$;

REVOKE ALL ON FUNCTION sia.wag_group_activity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION sia.wag_group_activity() TO service_role;
