-- ════════════════════════════════════════════════════════════════════════════
-- Subscriptions — the tool entity (one tool, many accounts).
--
-- The vision case: Claude has 3 accounts (2 tech, 1 concierge). Each account is
-- one `subscriptions` row (its own credentials, billing shape, departments);
-- `tool_id` groups those rows under one named tool so per-tool identity and
-- rollups never depend on free-text name matching. Added now, while the tables
-- are empty, so no backfill is ever needed.
--
-- `name_key` (generated, lower+trim) is the dedup identity — the same
-- normalisation posture as campaign keys. Tools are created implicitly from the
-- subscription form (insert-if-missing keyed on name_key); renaming a tool later
-- is a single-row UPDATE that every account inherits.
--
-- RLS: SELECT mirrors the subscriptions audience; writes admin-client only
-- (the actions gate is the trust boundary — the parent-table posture).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.subscription_tools (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text         NOT NULL,
  name_key    text         GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  created_by  uuid         REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT subscription_tools_name_nonempty CHECK (btrim(name) <> ''),
  CONSTRAINT subscription_tools_name_key_unique UNIQUE (name_key)
);

COMMENT ON TABLE public.subscription_tools IS
  'Tool/vendor catalog for the subscriptions tracker. One tool has many subscription '
  'rows (accounts). name_key = lower(trim(name)) is the dedup identity. Writes are '
  'admin-client only (implicit insert-if-missing from the subscription form).';

ALTER TABLE public.subscription_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_tools_select_staff
  ON public.subscription_tools FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) IN ('admin', 'founder')
    OR (SELECT get_user_domain()) IN ('finance', 'tech')
  );

-- No INSERT/UPDATE/DELETE policies — admin-client writes only.

-- ── The account → tool link ────────────────────────────────────────────────────
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS tool_id uuid REFERENCES public.subscription_tools(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.subscriptions.tool_id IS
  'The tool this account belongs to (nullable — standalone bills need no tool). '
  'Set from the optional Tool field on the subscription form.';

CREATE INDEX idx_subscriptions_tool
  ON public.subscriptions (tool_id)
  WHERE is_archived = false;
