-- Migration 0169: SIA WhatsApp-groups data layer — the `wag_` foundation (plan-whatsapp.md W2)
--
-- The base of Sia: every message from Indulge's client/vendor WhatsApp groups, captured by
-- the Baileys watcher(s), stored raw-first and normalized into this family. Everything the
-- profiling/ticket/review pipelines eat is rooted here. Contract: plan-whatsapp.md §3 + §10,
-- decisions locked 2026-08-27.
--
-- SIA ≠ GIA: this family NEVER mixes with the Gupshup `whatsapp_*` tables (the Gia lead
-- pipeline). They meet only in the future client profile.
--
-- The three error-proofing laws this schema encodes:
--   1. RAW FIRST  — wag_raw_events stores every Baileys event untouched BEFORE parsing;
--                   a normalizer bug is fixed by replay, never by data loss.
--   2. FACTS NEVER MUTATE — edits are NEW rows chained to the original; deletes flip a tag;
--                   reactions/receipts are state tables whose full history lives in raw.
--   3. INSERTS NEVER FAIL — message `type` is plain text with NO CHECK (WhatsApp invents
--                   types; unknown stores as 'unknown' + raw, backfilled by replay);
--                   reply links are SOFT references (a quote of a message we never saw
--                   must still store); every partitioned table has a DEFAULT partition.
--
-- Replay-safe identity: the canonical key of a message is WhatsApp's own triple
-- (chat_jid, wa_message_id, sender_jid). Child tables (media/reactions/receipts) reference
-- that triple, never our uuid — a re-normalization upserts onto the same triple, so
-- references survive replay. No FKs onto partitioned tables (PG requires the partition key
-- in them; soft references are the design anyway).
--
-- Partitioning: wag_messages by wa_timestamp (the query dimension — history_sync backfill
-- lands in its true month), wag_raw_events by received_at (pure ingest log). Monthly,
-- pre-created through 2027-03, DEFAULT partitions as the never-fail net. A maintenance
-- task extends partitions; rows landing in DEFAULT are still fully queryable.
--
-- RLS: enabled on every table with ZERO user policies — service-role only (the connector
-- writes, the Python pipeline reads). UI read policies arrive with the Sia section (W4),
-- gated by role, and will be their own migration.

-- ─────────────────────────────────────────────────────────────────────────────
-- wag_raw_events — the black-box recorder (append-only; partitioned monthly)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE wag_raw_events (
  id           bigint      GENERATED ALWAYS AS IDENTITY,
  event_type   text        NOT NULL,
  account_jid  text,                 -- which watcher heard it (dual-watcher setup)
  payload      jsonb       NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, received_at)
) PARTITION BY RANGE (received_at);

CREATE INDEX idx_wag_raw_events_type ON wag_raw_events (event_type, received_at DESC);

COMMENT ON TABLE wag_raw_events IS
  'Sia black-box recorder: every Baileys event, untouched, BEFORE normalization. '
  'Append-only. Normalizer bugs are fixed by replaying from here. Admin/service access only.';

-- ─────────────────────────────────────────────────────────────────────────────
-- wag_contacts — every person ever seen in a watched group
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE wag_contacts (
  jid              text        PRIMARY KEY,
  lid              text,               -- WhatsApp privacy id; same human, second identity
  phone            text,
  push_name        text,
  business_name    text,
  participant_role text        NOT NULL DEFAULT 'unknown'
    CHECK (participant_role IN
      ('client','genie','bishop','queen','founder','vendor','watcher','unknown')),
  staff_profile_id uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  client_id        uuid,               -- future client-profile table (soft until it exists)
  vendor_id        uuid,               -- future vendor-profile table (soft until it exists)
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wag_contacts_lid   ON wag_contacts (lid) WHERE lid IS NOT NULL;
CREATE INDEX idx_wag_contacts_role  ON wag_contacts (participant_role);
CREATE INDEX idx_wag_contacts_phone ON wag_contacts (phone) WHERE phone IS NOT NULL;

CREATE TRIGGER wag_contacts_updated_at
  BEFORE UPDATE ON wag_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON COLUMN wag_contacts.participant_role IS
  'OUR vocabulary (checked): who this JID is for Indulge. unknown = unmapped; a group with '
  'unknown members stays BLOCKED from profiling (plan-whatsapp §8, the meaning layer).';

-- ─────────────────────────────────────────────────────────────────────────────
-- wag_groups — every group a watcher sits in
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE wag_groups (
  group_jid          text        PRIMARY KEY,
  subject            text,
  description        text,
  owner_jid          text,
  group_kind         text        NOT NULL DEFAULT 'unmapped'
    CHECK (group_kind IN ('client','vendor','internal','unmapped')),
  client_id          uuid,             -- future client-profile table
  vendor_id          uuid,             -- future vendor-profile table
  member_count       integer,
  watcher_joined_at  timestamptz,
  is_active          boolean     NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wag_groups_kind ON wag_groups (group_kind);

CREATE TRIGGER wag_groups_updated_at
  BEFORE UPDATE ON wag_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMENT ON COLUMN wag_groups.group_kind IS
  'unmapped = a human has not yet confirmed the mapping in the Sia UI; profiling is BLOCKED '
  'for unmapped groups. client/vendor link to their profile tables when those land.';

-- ─────────────────────────────────────────────────────────────────────────────
-- wag_group_members — who is in which group, WITH history (never deleted)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE wag_group_members (
  group_jid   text        NOT NULL,
  member_jid  text        NOT NULL,
  role        text        NOT NULL DEFAULT 'member',  -- WhatsApp vocabulary; no CHECK on purpose
  joined_at   timestamptz NOT NULL DEFAULT now(),
  left_at     timestamptz,                            -- null = still in; a leave WRITES, never deletes
  PRIMARY KEY (group_jid, member_jid, joined_at)
);

CREATE INDEX idx_wag_group_members_member  ON wag_group_members (member_jid);
CREATE INDEX idx_wag_group_members_current ON wag_group_members (group_jid) WHERE left_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- wag_messages — the heart (partitioned monthly by wa_timestamp)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE wag_messages (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid(),
  chat_jid              text        NOT NULL,
  wa_message_id         text        NOT NULL,
  sender_jid            text        NOT NULL,
  from_me               boolean     NOT NULL DEFAULT false,
  -- Plain text, NO CHECK (locked decision 1): WhatsApp invents types; an insert must never
  -- fail. Code-side vocabulary: text|image|video|audio|voice|document|sticker|location|
  -- contact|poll|system|unknown (+ whatever the future brings, stored verbatim or 'unknown').
  type                  text        NOT NULL DEFAULT 'unknown',
  text                  text,                    -- body or caption
  -- SOFT reply reference (locked decision 2): the quoted message may predate the watcher
  -- or never arrive; the reply must still store. UI shows "quoted message unavailable".
  quoted_wa_message_id  text,
  quoted_sender_jid     text,
  wa_timestamp          timestamptz NOT NULL,    -- WhatsApp's clock: display order + partition key
  received_at           timestamptz NOT NULL DEFAULT now(),  -- our clock: pipeline order
  is_revoked            boolean     NOT NULL DEFAULT false,  -- delete-for-everyone flips this; content stays
  edit_of_wa_message_id text,                    -- set when THIS row IS an edit (chain to original)
  is_forwarded          boolean     NOT NULL DEFAULT false,
  source                text        NOT NULL DEFAULT 'live'
    CHECK (source IN ('live','history_sync','backfill')),   -- ours, stable, checked
  normalizer_version    integer     NOT NULL DEFAULT 1,     -- replay re-processes only old versions
  raw                   jsonb,                   -- the normalized-from payload, kept for re-parse
  PRIMARY KEY (id, wa_timestamp)
) PARTITION BY RANGE (wa_timestamp);

-- THE dedup + replay-upsert key: WhatsApp's own identity triple (+ the partition column,
-- which PG requires; redeliveries and history_sync re-sends carry the identical
-- wa_timestamp, so dedup holds). Dual watchers both insert; the second lands here and bounces.
CREATE UNIQUE INDEX uq_wag_messages_wa_key
  ON wag_messages (chat_jid, wa_message_id, sender_jid, wa_timestamp);

CREATE INDEX idx_wag_messages_chat_time   ON wag_messages (chat_jid, wa_timestamp DESC);
CREATE INDEX idx_wag_messages_sender_time ON wag_messages (sender_jid, wa_timestamp DESC);
CREATE INDEX idx_wag_messages_received    ON wag_messages (received_at);
CREATE INDEX idx_wag_messages_edit_chain  ON wag_messages (chat_jid, edit_of_wa_message_id)
  WHERE edit_of_wa_message_id IS NOT NULL;
-- Full-text search: 'simple' config on purpose (Hinglish/Marathi roman text — english
-- stemming would mangle it).
CREATE INDEX idx_wag_messages_fts
  ON wag_messages USING gin (to_tsvector('simple', coalesce(text, '')));

COMMENT ON TABLE wag_messages IS
  'Sia group messages, normalized from wag_raw_events. Facts never mutate: an edit is a NEW '
  'row (edit_of_wa_message_id -> original), a delete-for-everyone flips is_revoked, content '
  'always stays. Canonical identity = (chat_jid, wa_message_id, sender_jid); normalization '
  'UPSERTs on that triple so replay refreshes rows in place (normalizer_version tracks it).';

-- ─────────────────────────────────────────────────────────────────────────────
-- wag_media — files, stored by US (WhatsApp links expire; Baileys media is encrypted)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE wag_media (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_jid         text        NOT NULL,
  wa_message_id    text        NOT NULL,
  sender_jid       text        NOT NULL,
  media_type       text        NOT NULL,          -- WhatsApp vocabulary; no CHECK on purpose
  mime             text,
  size_bytes       bigint,
  duration_seconds integer,
  storage_path     text,                          -- our S3 object; null until downloaded
  thumbnail_path   text,
  download_status  text        NOT NULL DEFAULT 'pending'
    CHECK (download_status IN ('pending','retrying','done','dead_letter')),  -- ours, checked
  attempts         integer     NOT NULL DEFAULT 0,
  last_attempt_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_jid, wa_message_id, sender_jid)    -- one media per message (albums = many messages)
);

-- The fetch queue and the orphaned-media list the health panel shows.
CREATE INDEX idx_wag_media_queue ON wag_media (created_at)
  WHERE download_status IN ('pending','retrying');
CREATE INDEX idx_wag_media_dead  ON wag_media (created_at)
  WHERE download_status = 'dead_letter';

COMMENT ON COLUMN wag_media.download_status IS
  'pending/retrying inside the expiry window; dead_letter = the window closed and the file is '
  'lost (the message row remains — we always KNOW what we lost). Never silently forgotten.';

-- ─────────────────────────────────────────────────────────────────────────────
-- wag_reactions — CURRENT state, one row per (message, reactor); history lives in raw
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE wag_reactions (
  chat_jid          text        NOT NULL,
  wa_message_id     text        NOT NULL,   -- the TARGET message
  target_sender_jid text        NOT NULL,
  reactor_jid       text        NOT NULL,
  emoji             text        NOT NULL,
  reacted_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_jid, wa_message_id, reactor_jid)
);

COMMENT ON TABLE wag_reactions IS
  'Current reaction state (locked decision 3): upsert on change, DELETE on removal. The full '
  'add/change/remove history is replayable from wag_raw_events.';

-- ─────────────────────────────────────────────────────────────────────────────
-- wag_receipts — who saw what, when (locked decision 5: capture is CODE-GATED to
-- client-sent messages only in v1 — the staff-accountability signal at ~20% volume)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE wag_receipts (
  chat_jid        text        NOT NULL,
  wa_message_id   text        NOT NULL,
  participant_jid text        NOT NULL,   -- who the receipt is about
  delivered_at    timestamptz,
  read_at         timestamptz,
  played_at       timestamptz,            -- voice notes
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chat_jid, wa_message_id, participant_jid)
);

CREATE INDEX idx_wag_receipts_participant ON wag_receipts (participant_jid, read_at DESC);

COMMENT ON TABLE wag_receipts IS
  '"Client asked at 2pm, the genie READ at 2:03, replied at 6" — the staff-monitoring signal. '
  'v1 capture is gated in connector code to client-sent messages only (decision 5); widening '
  'it is a code change, not a schema change.';

-- ─────────────────────────────────────────────────────────────────────────────
-- wag_pipeline_cursors — each downstream consumer keeps its own place in the stream
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE wag_pipeline_cursors (
  consumer_name     text        PRIMARY KEY,
  last_event_id     bigint,
  last_processed_at timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE wag_pipeline_cursors IS
  'Per-consumer read positions (profiler, ticket builder, embeddings, ...). A new consumer '
  'adds a row and reads from wherever it likes; consumers never disturb each other.';

-- NOTE: wag_embeddings (pgvector) is DELIBERATELY absent — its vector dimension is pinned
-- to the embedding model chosen at Step 6e (plan-whatsapp §10.5). Creating it with a guessed
-- dimension would force churn; it ships with the embedding job.

-- ─────────────────────────────────────────────────────────────────────────────
-- Partitions — monthly, pre-created through 2027-03, DEFAULT as the never-fail net.
-- History_sync can deliver arbitrarily old messages: those land in DEFAULT and remain
-- fully queryable; a maintenance task may re-home them later. Extending future months
-- is the connector deploy checklist's job (or pg_cron later).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE wag_messages_default PARTITION OF wag_messages DEFAULT;
CREATE TABLE wag_messages_2026_08 PARTITION OF wag_messages FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE wag_messages_2026_09 PARTITION OF wag_messages FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE wag_messages_2026_10 PARTITION OF wag_messages FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE wag_messages_2026_11 PARTITION OF wag_messages FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE wag_messages_2026_12 PARTITION OF wag_messages FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE wag_messages_2027_01 PARTITION OF wag_messages FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE wag_messages_2027_02 PARTITION OF wag_messages FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE wag_messages_2027_03 PARTITION OF wag_messages FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

CREATE TABLE wag_raw_events_default PARTITION OF wag_raw_events DEFAULT;
CREATE TABLE wag_raw_events_2026_08 PARTITION OF wag_raw_events FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE wag_raw_events_2026_09 PARTITION OF wag_raw_events FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE wag_raw_events_2026_10 PARTITION OF wag_raw_events FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE wag_raw_events_2026_11 PARTITION OF wag_raw_events FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE wag_raw_events_2026_12 PARTITION OF wag_raw_events FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE wag_raw_events_2027_01 PARTITION OF wag_raw_events FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');
CREATE TABLE wag_raw_events_2027_02 PARTITION OF wag_raw_events FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');
CREATE TABLE wag_raw_events_2027_03 PARTITION OF wag_raw_events FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS — enabled everywhere, ZERO user policies: service-role only until the Sia UI
-- (W4) ships its role-gated read policies in its own migration. Client conversations
-- are the most sensitive data Indulge holds; deny-by-default is the correct start.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE wag_raw_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE wag_contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wag_groups           ENABLE ROW LEVEL SECURITY;
ALTER TABLE wag_group_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE wag_messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wag_media            ENABLE ROW LEVEL SECURITY;
ALTER TABLE wag_reactions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE wag_receipts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE wag_pipeline_cursors ENABLE ROW LEVEL SECURITY;
