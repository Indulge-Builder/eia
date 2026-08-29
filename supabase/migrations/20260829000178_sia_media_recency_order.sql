-- Migration 0178: wag_media learns its message's timestamp — recency-first backfill
--
-- The 2026-08-29 breaker investigation: the drip ordered by row insert time
-- (created_at ~= the sync moment, so effectively random message age) and served
-- a month-old slab first, where WhatsApp media-retry answers with keys that no
-- longer match ("bad decrypt") and every item fails. Recovery priority must be
-- the MESSAGE's age: newest media recover almost always and are what the team
-- actually opens; the deep tail drains to honest 'expired' afterwards.

ALTER TABLE sia.wag_media ADD COLUMN IF NOT EXISTS wa_timestamp timestamptz;

UPDATE sia.wag_media m
SET wa_timestamp = s.wa_timestamp
FROM (
  SELECT chat_jid, wa_message_id, max(wa_timestamp) AS wa_timestamp
  FROM sia.wag_messages
  GROUP BY chat_jid, wa_message_id
) s
WHERE m.chat_jid = s.chat_jid
  AND m.wa_message_id = s.wa_message_id
  AND m.wa_timestamp IS NULL;

CREATE INDEX IF NOT EXISTS idx_wag_media_pending_recent
  ON sia.wag_media (wa_timestamp DESC)
  WHERE download_status IN ('pending', 'retrying');
