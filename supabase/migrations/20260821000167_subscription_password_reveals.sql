-- ════════════════════════════════════════════════════════════════════════════
-- Subscriptions — append-only audit ledger for password reveals.
--
-- revealSubscriptionPasswordAction is the ONLY path that produces a plaintext
-- credential (migration 0166). Before this table, a reveal left no trace. Now
-- every reveal writes one row (who, which subscription, when) BEFORE the
-- plaintext is returned; the action fails closed if the audit insert fails
-- (no trace, no plaintext).
--
-- Append-only (A-11): SELECT-only RLS, writes via the admin client inside the
-- action. No UPDATE/DELETE policies. SELECT is admin/founder only — reveal
-- audit is an oversight surface, narrower than the tracker's own audience.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.subscription_password_reveals (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  uuid         NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  revealed_by      uuid         REFERENCES public.profiles(id) ON DELETE SET NULL,
  revealed_at      timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subscription_password_reveals IS
  'Append-only audit of subscription password reveals (A-11). One row per reveal, '
  'written by the admin client before the plaintext is returned. No UPDATE/DELETE.';

CREATE INDEX idx_subscription_password_reveals_sub
  ON public.subscription_password_reveals (subscription_id, revealed_at DESC);
CREATE INDEX idx_subscription_password_reveals_at
  ON public.subscription_password_reveals (revealed_at DESC);

ALTER TABLE public.subscription_password_reveals ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_password_reveals_select
  ON public.subscription_password_reveals FOR SELECT TO authenticated
  USING ((SELECT get_user_role()) IN ('admin', 'founder'));

-- No INSERT/UPDATE/DELETE policies — append-only, admin-client writes only.
