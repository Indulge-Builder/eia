-- ════════════════════════════════════════════════════════════════════════════
-- Subscriptions & Bills Tracker — Phase 1 (top-up history child table)
--
-- One row per top-up of a `top_up`-type subscription (prepaid/credit accounts).
-- Top-ups have their own amount + currency per event (unlike a fixed monthly bill),
-- so amount/currency live on the row, not derived from the parent.
--
-- Same currency rule as payments: `amount` is original currency, `paid_amount_inr`
-- is the manually-entered INR. Append-only ledger (A-11): SELECT-only RLS, admin-
-- client writes, no UPDATE/DELETE policies. SELECT mirrors parent visibility.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.subscription_topups (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  uuid          NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  topped_up_at     date          NOT NULL,
  amount           numeric(14,2) NOT NULL,    -- amount in `currency`
  currency         text          NOT NULL,
  paid_amount_inr  numeric(14,2) NOT NULL,    -- what actually left the account, in INR (manual)
  invoice_path     text,                      -- storage path in subscription-invoices (private)
  notes            text,
  created_by       uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT subscription_topups_currency_check
    CHECK (currency IN ('USD', 'INR', 'EUR')),
  CONSTRAINT subscription_topups_amount_nonneg
    CHECK (amount >= 0),
  CONSTRAINT subscription_topups_inr_nonneg
    CHECK (paid_amount_inr >= 0)
);

COMMENT ON TABLE public.subscription_topups IS
  'Append-only top-up history for a top_up-type subscription (A-11). Writes admin-client '
  'only. amount = original currency; paid_amount_inr = manually-entered INR.';

CREATE INDEX idx_subscription_topups_subscription
  ON public.subscription_topups (subscription_id, topped_up_at DESC);

-- ───────────────────── RLS — SELECT mirrors parent visibility (A-08/A-11) ─────────────────────
ALTER TABLE public.subscription_topups ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_topups_select
  ON public.subscription_topups FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_topups.subscription_id
        AND (
          (SELECT get_user_role()) IN ('admin', 'founder')
          OR (SELECT get_user_domain()) IN ('finance', 'tech')
        )
    )
  );

-- No INSERT/UPDATE/DELETE policies — append-only, admin-client writes only.
