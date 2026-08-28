-- Migration 0174: Postgres-backed WhatsApp auth state + honest media terminal state.
-- (Sia W1 hardening — the 2026-08-27 audit's P0-1 and P1-1 fixes.)
--
-- 1. sia.wag_auth_state — the watcher's Baileys session identity, one row per key.
--    Replaces the 14,640-small-files-on-EFS store. Baileys' own docs recommend a
--    database auth store "in any production grade system": atomic writes, one-query
--    inspection, one-DELETE reset. The `key` is Baileys' own naming ('creds',
--    'pre-key-<id>', 'session-<id>', 'app-state-sync-key-<id>', ...); `value` is the
--    BufferJSON-serialized payload. Deny-all RLS + service_role-only, like every
--    sia table. This is LIVE KEY MATERIAL — it must never gain a user-facing policy.
--
-- 2. wag_media.download_status gains 'expired' — the terminal state for historical
--    media whose WhatsApp link is gone for good (the backfill worker assigns it).
--    "pending forever" stops being a state.

CREATE TABLE sia.wag_auth_state (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sia.wag_auth_state ENABLE ROW LEVEL SECURITY;
GRANT ALL ON sia.wag_auth_state TO service_role;

COMMENT ON TABLE sia.wag_auth_state IS
  'Baileys session identity for the Sia watcher (migration 0174). Service-role only; '
  'live key material — never add a user policy. One runner at a time owns this session.';

ALTER TABLE sia.wag_media DROP CONSTRAINT wag_media_download_status_check;
ALTER TABLE sia.wag_media ADD CONSTRAINT wag_media_download_status_check
  CHECK (download_status = ANY (ARRAY[
    'pending'::text, 'retrying'::text, 'done'::text, 'dead_letter'::text, 'expired'::text
  ]));
