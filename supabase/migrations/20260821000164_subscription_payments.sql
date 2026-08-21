-- ════════════════════════════════════════════════════════════════════════════
-- Subscriptions & Bills Tracker — Phase 1 (payment history child table)
--
-- One row per recorded payment of a monthly/yearly/other subscription. A cycle is
-- "Paid" when a payment row exists whose due_date matches that cycle; an unpaid past
-- cycle is the ABSENCE of a row (computed in the app, shown red) — never a row.
--
-- Currency is never auto-converted: `rate` is the original-currency amount and
-- `paid_amount_inr` is the manually-entered INR that actually left the account.
--
-- Append-only ledger (A-11): SELECT-only RLS, writes via the admin client. No
-- UPDATE/DELETE policies. SELECT mirrors the parent subscription's visibility.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id  uuid          NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  due_date         date          NOT NULL,   -- the cycle this payment settles
  paid_at          date          NOT NULL,   -- when it was actually paid
  rate             numeric(14,2) NOT NULL,    -- amount in the subscription's original currency
  paid_amount_inr  numeric(14,2) NOT NULL,    -- what actually left the account, in INR (manual)
  invoice_path     text,                      -- storage path in subscription-invoices (private)
  notes            text,
  created_by       uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT subscription_payments_rate_nonneg
    CHECK (rate >= 0),
  CONSTRAINT subscription_payments_inr_nonneg
    CHECK (paid_amount_inr >= 0)
);

COMMENT ON TABLE public.subscription_payments IS
  'Append-only payment history for a subscription (A-11). Writes admin-client only. '
  'rate = original currency; paid_amount_inr = manually-entered INR (never auto-converted).';

CREATE INDEX idx_subscription_payments_subscription
  ON public.subscription_payments (subscription_id, due_date DESC);
CREATE INDEX idx_subscription_payments_paid_at
  ON public.subscription_payments (paid_at DESC);

-- ───────────────────── RLS — SELECT mirrors parent visibility (A-08/A-11) ─────────────────────
ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscription_payments_select
  ON public.subscription_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subscriptions s
      WHERE s.id = subscription_payments.subscription_id
        AND (
          (SELECT get_user_role()) IN ('admin', 'founder')
          OR (SELECT get_user_domain()) IN ('finance', 'tech')
        )
    )
  );

-- No INSERT/UPDATE/DELETE policies — append-only, admin-client writes only.
