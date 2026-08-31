-- Migration 0180 — lead_product_enquiries: the shop-app product enquiry ledger.
--
-- WHY THIS TABLE EXISTS
-- The Indulge Shop app (React Native + NestJS on EC2) sends one webhook per
-- product enquiry. Its own dedup is scoped to (memberId, productId, enquiryType);
-- ours is scoped to PHONE. Those two disagree in exactly the case the marketplace
-- encourages: one member enquiring about several different pieces. Their side
-- correctly emits three enquiries, our phone dedup correctly refuses to create
-- three leads for one human -- and before this table the 2nd and 3rd products were
-- dropped into a duplicate_submission activity that recorded only
-- {source, utm_campaign, domain, raw_payload_id}. The agent called about a handbag
-- while the member waited to hear about a watch.
--
-- The model: ONE lead per person (phone stays the identity key, unchanged), MANY
-- enquiries hanging off it. Every enquiry lands here, whether it created the lead
-- or arrived against an existing one.
--
-- APPEND-ONLY (Rule 08). No UPDATE and no DELETE policy exists, deliberately.
-- This is an event stream like lead_activities, not an editable record like
-- ad_account_recharges. Rows are written by the service-role webhook path only,
-- which bypasses RLS, so there is no INSERT policy either -- SELECT is the whole
-- user-facing surface. Read scoping mirrors lead_activities exactly (EXISTS on the
-- parent lead), so an enquiry is visible to precisely whoever can see its lead.
--
-- external_lead_id IS THE IDEMPOTENCY KEY.
-- The shop backend retries delivery 3 times with [1s, 4s, 9s] backoff, plus
-- unlimited manual retries from its admin panel, and every attempt carries the SAME
-- Mongo ObjectId. The UNIQUE constraint is what makes a redelivery a no-op instead
-- of a second enquiry row and a second duplicate_submission activity. Ingestion
-- catches 23505 here the same way it already catches it on the active-phone index.
--
-- PRODUCT DATA IS A SNAPSHOT, NEVER A REFERENCE.
-- The shop hard-deletes products (products.service.ts deleteOne) and enriches at
-- delivery time, so a lead redelivered after a deletion arrives with a null image
-- and a URL that 404s. product_name is frozen at creation on their side and always
-- survives. The dossier card renders from THESE columns and never re-fetches the
-- shop URL -- that is the whole reason the columns are here rather than a foreign
-- key to something of theirs.

CREATE TABLE IF NOT EXISTS public.lead_product_enquiries (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id            uuid          NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,

  -- The sending system's own lead id. UNIQUE = at-most-once ingestion across every
  -- automatic and manual redelivery. Not null: an enquiry with no external id could
  -- not be de-duplicated and must never be written.
  external_lead_id   text          NOT NULL,

  -- Which channel produced this enquiry. SQL mirror of LEAD_SOURCES
  -- (lib/constants/lead-sources.ts); kept as a column rather than assumed so a
  -- second app channel later does not need a schema change.
  source             text          NOT NULL DEFAULT 'shop_app',

  -- ── Product snapshot (frozen at ingestion, never refreshed) ──
  product_id         text,
  product_name       text          NOT NULL,
  product_url        text,
  product_image_url  text,
  brand              text,
  price              numeric(14,2),
  currency           text,
  price_region       text,
  sold_out           boolean,
  price_on_request   boolean,

  -- ── The enquiry itself ──
  -- CHECK is the SQL mirror of the shop's ENQUIRY_TYPES enum. Extending it later
  -- is a CHECK-extending migration, the same posture as ad_account_recharges.
  enquiry_type       text          NOT NULL DEFAULT 'enquire'
                       CHECK (enquiry_type IN ('enquire', 'price_request', 'source_request')),
  note               text,

  -- ── Member context (what a salesperson wants before dialling) ──
  member_role        text,
  admin_member_url   text,

  -- When the member actually enquired, per the sending system. Distinct from
  -- created_at, which is when WE recorded it -- a redelivered lead can arrive
  -- minutes or hours after the member acted, and the agent needs the former.
  enquired_at        timestamptz   NOT NULL,
  created_at         timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT lead_product_enquiries_external_id_key UNIQUE (external_lead_id)
);

-- The dossier card reads every enquiry for one lead, newest first. One index
-- serves that exactly.
CREATE INDEX idx_lead_product_enquiries_lead
  ON public.lead_product_enquiries (lead_id, enquired_at DESC);

ALTER TABLE public.lead_product_enquiries ENABLE ROW LEVEL SECURITY;

-- Read: whoever can see the parent lead. Mirrors the lead_activities policy
-- (migration 0003) rather than restating role logic -- an enquiry is never more or
-- less visible than the lead it belongs to.
CREATE POLICY lead_product_enquiries_select
  ON public.lead_product_enquiries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leads l
      WHERE l.id = lead_product_enquiries.lead_id
        AND (
          (get_user_role() = 'agent'   AND l.assigned_to = auth.uid())
          OR (get_user_role() = 'manager' AND l.domain = get_user_domain()::text)
          OR get_user_role() IN ('admin', 'founder')
        )
    )
  );

-- No INSERT / UPDATE / DELETE policies. Writes are service-role only (the webhook
-- ingestion path), and the table is append-only per Rule 08.

COMMENT ON TABLE public.lead_product_enquiries IS
  'Append-only ledger of product enquiries from app channels (shop_app). One lead holds many rows -- phone stays the lead identity, products accumulate here. external_lead_id UNIQUE makes redelivery idempotent. Product columns are a frozen snapshot; never re-fetch the source URL.';

-- ─────────────────────────────────────────────────────────────
-- deals.source CHECK — extend for the new channel.
-- The constraint from migration 0075 is an inline unnamed CHECK, so Postgres
-- auto-named it deals_source_check. It must list every LEAD_SOURCES value or a
-- deal recorded against a shop_app lead is rejected at write time. Adding a lead
-- source and extending this CHECK are one change, never two.
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.deals DROP CONSTRAINT IF EXISTS deals_source_check;

ALTER TABLE public.deals
  ADD CONSTRAINT deals_source_check
  CHECK (source IS NULL OR source IN
    ('meta','google','website','whatsapp','referral','ypo','events','shop_app'));
