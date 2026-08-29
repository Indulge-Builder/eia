-- Migration 0177: Sia remote pairing + WhatsApp alert log type
--
-- 1. The watcher publishes its pairing QR into its own status row so the /sia
--    console can render it in the browser — anyone with admin/founder access
--    (Ethan, without codebase or AWS access) re-pairs a lost session by scanning
--    the screen. The QR is only ever present while state = 'pairing' and is
--    cleared the moment the socket opens.
-- 2. restart_requested_at is the app -> watcher control channel: the console's
--    "Restart" / "Re-pair" actions stamp it; the watcher checks it on every
--    60-second beat and exits cleanly (crash-only) when it is newer than its
--    own boot time. Re-pair = wipe sia.wag_auth_state + stamp this column.
-- 3. whatsapp_notification_logs.type gains 'sia_alert' — the watcher-alarm
--    WhatsApp template (sendSiaAlertNotification) follows the one-log-row-per-
--    attempt contract like every other template send (0153 pattern).

ALTER TABLE sia.wag_watcher_status
  ADD COLUMN IF NOT EXISTS qr text,
  ADD COLUMN IF NOT EXISTS qr_at timestamptz,
  ADD COLUMN IF NOT EXISTS restart_requested_at timestamptz;

COMMENT ON COLUMN sia.wag_watcher_status.qr IS
  'Current pairing QR payload (state = pairing only; cleared on connect). Rendered by the /sia console for browser-based re-pairing.';
COMMENT ON COLUMN sia.wag_watcher_status.restart_requested_at IS
  'App -> watcher control channel: the watcher exits cleanly on its next beat when this is newer than its boot time.';

ALTER TABLE whatsapp_notification_logs
  DROP CONSTRAINT IF EXISTS whatsapp_notification_logs_type_check;

ALTER TABLE whatsapp_notification_logs
  ADD CONSTRAINT whatsapp_notification_logs_type_check
  CHECK (type IN (
    'agent_assignment',
    'founder_alert',
    'sla_breach',
    'lead_initiation',
    'task_due_reminder',
    'task_overdue_manager',
    'task_due_soon',
    'task_overdue_agent',
    'task_overdue_manager_generic',
    'elaya_reply',
    'customer_welcome',
    'customer_reply',
    'task_assigned',
    'sia_alert'
  ));
