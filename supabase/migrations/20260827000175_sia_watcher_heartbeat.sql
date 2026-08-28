-- Migration 0175: the watcher's own pulse — liveness decoupled from group traffic.
--
-- Why: "no messages for 10 minutes" is the wrong liveness signal. Groups sleep at
-- night; a traffic-based alarm either cries wolf at 3am or reacts slowly by day,
-- and alert fatigue is how real outages get ignored. The watcher instead reports
-- its OWN state every minute: the alarm (sia-silence.ts) and the /sia live dot
-- read this one row, so "process down" and "session lost — re-pair needed" are
-- detected within minutes at any hour, with zero dependence on customers talking.
--
-- Single-row table (id CHECK = 1): current pulse + connection state + when that
-- state began. History is not kept here — state transitions worth keeping already
-- land in the logs; this row answers only "now".

CREATE TABLE sia.wag_watcher_status (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  beat_at     timestamptz NOT NULL DEFAULT now(),
  state       text NOT NULL DEFAULT 'connecting'
              CHECK (state IN ('pairing', 'connecting', 'connected', 'logged_out')),
  connected   boolean NOT NULL DEFAULT false,
  state_since timestamptz NOT NULL DEFAULT now(),
  account_jid text
);

ALTER TABLE sia.wag_watcher_status ENABLE ROW LEVEL SECURITY;
GRANT ALL ON sia.wag_watcher_status TO service_role;

COMMENT ON TABLE sia.wag_watcher_status IS
  'The Sia watcher''s heartbeat (migration 0175): one row, upserted every 60s by the '
  'connector. Liveness = beat_at freshness; state drives the distinct alarms. '
  'Service-role only.';
