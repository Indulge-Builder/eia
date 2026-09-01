-- 0179 — Elaya brain-per-channel switch (Step 3, WhatsApp channel tranche, 2026-08-31)
--
-- Two config rows in the existing elaya_settings key/value table decide which
-- brain answers a channel: "node" (the in-process TypeScript brain) or
-- "python" (the FastAPI brain on Fargate, reached by the Node transport in
-- src/lib/elaya/python-brain.ts). They are read per request by
-- getElayaBrainForChannel (llm-providers-service.ts), so flipping a value moves
-- the very next message — no deploy, the same posture as a model switch.
--
-- Both seed to "node" on purpose: deploying the code changes nothing until an
-- operator flips the row. Rollback is the same one-row edit in reverse.
--
--   UPDATE elaya_settings SET value = '"python"' WHERE key = 'brain_whatsapp';
--
-- No schema change, no RLS change (the table's policies from 0116 stand:
-- admin/founder read, service-role write).

INSERT INTO elaya_settings (key, value) VALUES
  ('brain_whatsapp', '"node"'::jsonb),
  ('brain_in_app',   '"node"'::jsonb)
ON CONFLICT (key) DO NOTHING;
