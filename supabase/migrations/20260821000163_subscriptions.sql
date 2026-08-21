-- ════════════════════════════════════════════════════════════════════════════
-- Subscriptions & Bills Tracker — Phase 1 (parent table + invoices bucket)
--
-- A department resource (lives inside Finance + Tech). A subscription can belong
-- to more than one department (departments text[]). Three billing shapes carry a
-- due-date concept: monthly/other → a day-of-month (due_day 1–31); yearly → a full
-- date (due_date); top_up → no schedule (logged ad-hoc via subscription_topups).
--
-- Writes go through Server Actions using the admin client (Rule A-02) — no
-- INSERT/UPDATE/DELETE policies for regular users. Soft-delete via is_archived
-- (D-02) — no hard-delete path. RLS SELECT = admin/founder OR finance/tech domain
-- (the tracker's audience; NOT filtered by the row's departments array — that array
-- is metadata/filtering, not a security boundary).
-- ════════════════════════════════════════════════════════════════════════════

-- ───────────────────────────── 1. Table ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text          NOT NULL,
  departments  text[]        NOT NULL DEFAULT '{}',
  type         text          NOT NULL,
  currency     text          NOT NULL,
  amount       numeric(14,2),
  due_day      smallint,               -- day-of-month for monthly/other (1–31)
  due_date     date,                   -- full date for yearly
  login        text,
  password     text,                   -- app-managed credential (see COMMENT); RLS-protected
  notes        text,
  is_archived  boolean       NOT NULL DEFAULT false,
  created_by   uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz   NOT NULL DEFAULT now(),
  updated_at   timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT subscriptions_type_check
    CHECK (type IN ('monthly', 'yearly', 'top_up', 'other')),

  CONSTRAINT subscriptions_currency_check
    CHECK (currency IN ('USD', 'INR', 'EUR')),

  -- departments validity — SQL mirror of APP_DOMAINS (src/lib/constants/domains.ts).
  -- Extending the vocabulary = a new migration that DROPs + re-ADDs this constraint.
  CONSTRAINT subscriptions_departments_valid
    CHECK (departments <@ ARRAY[
      'concierge','onboarding','finance','marketing','tech','shop','b2b','house','legacy'
    ]::text[]),

  CONSTRAINT subscriptions_due_day_range
    CHECK (due_day IS NULL OR (due_day BETWEEN 1 AND 31)),

  -- amount is required for every billing shape except top_up (which carries no
  -- fixed amount — each top-up logs its own amount in subscription_topups).
  CONSTRAINT subscriptions_amount_shape
    CHECK (type = 'top_up' OR amount IS NOT NULL),
  CONSTRAINT subscriptions_amount_nonneg
    CHECK (amount IS NULL OR amount >= 0),

  -- due-date shape by type: monthly/other → due_day only; yearly → due_date only;
  -- top_up → neither.
  CONSTRAINT subscriptions_due_shape
    CHECK (
      (type IN ('monthly', 'other') AND due_day IS NOT NULL AND due_date IS NULL)
      OR (type = 'yearly'  AND due_date IS NOT NULL AND due_day IS NULL)
      OR (type = 'top_up'  AND due_day IS NULL AND due_date IS NULL)
    )
);

COMMENT ON TABLE public.subscriptions IS
  'Subscriptions & Bills Tracker (Phase 1). Department resource for Finance/Tech. '
  'Writes are admin-client only (no user write RLS). Soft-delete via is_archived.';
COMMENT ON COLUMN public.subscriptions.password IS
  'Reversibly-stored service credential (UI reveal toggle). Protected only by RLS + '
  'the admin-client write boundary — NOT encrypted at rest. Consider pgsodium/Vault '
  'encryption in a later phase before storing high-value secrets.';
COMMENT ON COLUMN public.subscriptions.departments IS
  'Multi-select app_domain values. text[] by design (mirrors service_interests). '
  'Metadata/filtering only — NOT a security boundary.';

-- updated_at maintained by the shared trigger fn (migration 0001 — NEVER recreate it).
CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_subscriptions_departments
  ON public.subscriptions USING GIN (departments)
  WHERE is_archived = false;
CREATE INDEX idx_subscriptions_type
  ON public.subscriptions (type)
  WHERE is_archived = false;
CREATE INDEX idx_subscriptions_active
  ON public.subscriptions (is_archived);
CREATE INDEX idx_subscriptions_created_at
  ON public.subscriptions (created_at DESC);

-- ───────────────────── 2. RLS — read admin/founder OR finance/tech (A-08) ─────────────────────
-- No INSERT/UPDATE/DELETE policies — all writes go through the admin client in
-- Server Actions (the requireProfile gate + route access are the trust boundary).
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select_staff
  ON public.subscriptions FOR SELECT TO authenticated
  USING (
    (SELECT get_user_role()) IN ('admin', 'founder')
    OR (SELECT get_user_domain()) IN ('finance', 'tech')
  );

-- ──────────── 3. Storage — PRIVATE 'subscription-invoices' bucket + RLS ────────────
-- Invoices are financial documents → private bucket (mirrors whatsapp-media / suggestions).
-- Rows store the storage PATH (never a URL); the read path mints short-lived signed
-- URLs via the admin client (bypasses RLS). Client uploads under an {uid}/ prefix.
-- File-type (PDF/PNG/JPG) + size limits are enforced at the application layer.
insert into storage.buckets (id, name, public)
values ('subscription-invoices', 'subscription-invoices', false)
on conflict (id) do nothing;

drop policy if exists "subscription_invoices_insert_own" on storage.objects;
drop policy if exists "subscription_invoices_read_staff" on storage.objects;

-- Authenticated users upload only under their own uid/ prefix.
create policy "subscription_invoices_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'subscription-invoices'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Defence-in-depth read (primary read path is admin-client signed urls, which
-- bypass RLS): the tracker's audience may read directly.
create policy "subscription_invoices_read_staff" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'subscription-invoices'
    and (
      (select get_user_role()) in ('admin', 'founder')
      or (select get_user_domain()) in ('finance', 'tech')
    )
  );

-- No UPDATE/DELETE policies — invoices are write-once.
