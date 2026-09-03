-- Migration 0181: public.clients — the client identity SPINE (profiling step 0).
--
-- The one row per client HUMAN that every other system finally points at:
-- sia.wag_groups.client_id / sia.wag_contacts.client_id (the 0169 soft hooks),
-- the reserved deals.client_id (wired in a later migration), and the future
-- dynamic-profile layer (facts/preferences/addresses) which will hang OFF this
-- table — never live in it.
--
-- Deliberately minimal by design (the founder's data-corruption concern,
-- 2026-09-04): the spine holds ONLY identity + join keys + a flat membership
-- summary, parsed STRICTLY from the source exports. Anything that does not
-- parse cleanly stays NULL here and survives untouched inside import_raw
-- (jsonb, the raw source rows keyed by source) — mess can never corrupt a
-- typed column it never enters. Multiple addresses, dietary preferences,
-- likings, notes: NOT columns here; they are the profiling layer's facts,
-- designed separately.
--
-- identity_status: 'verified' only when a human-approved signal chain confirms
-- the identity (e.g. the 2026-09-04 WhatsApp-group mapping: phone unique in
-- exports + unique in one group + name corroboration + founder approval).
-- Imports are born 'unverified'.
--
-- Writes are service-role only (import/mapping scripts, future actions own
-- their gates). Reads: admin/founder — client identity is sensitive (plan-
-- whatsapp §9); broader role access arrives with the Sia UI, as its own
-- migration.

CREATE TABLE clients (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name             text        NOT NULL,
  primary_phone         text        UNIQUE,  -- E.164 (+cc…); NULL when no parseable phone
  alt_phones            text[]      NOT NULL DEFAULT '{}',
  freshdesk_contact_id  text,
  zoho_customer_id      text,
  wa_invite_link        text,                -- app export's group invite; manual-mapping aid
  membership_type       text,
  membership_status     text,
  membership_amount_inr numeric,
  membership_start      date,
  membership_end        date,
  identity_status       text        NOT NULL DEFAULT 'unverified'
    CHECK (identity_status IN ('unverified', 'verified')),
  sources               text[]      NOT NULL DEFAULT '{}',
  import_raw            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_freshdesk ON clients (freshdesk_contact_id)
  WHERE freshdesk_contact_id IS NOT NULL;
CREATE INDEX idx_clients_zoho ON clients (zoho_customer_id)
  WHERE zoho_customer_id IS NOT NULL;
CREATE INDEX idx_clients_membership_status ON clients (membership_status);

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_select_admin ON clients
  FOR SELECT TO authenticated
  USING (get_user_role() IN ('admin', 'founder'));
-- No INSERT/UPDATE/DELETE policies: service-role writes only.

COMMENT ON TABLE clients IS
  'The client identity spine (one row per human). Join keys + strict membership summary '
  'only — dynamic profile data lives in the profiling layer, raw source rows in import_raw. '
  'Writes are service-role only.';

-- The 0169 soft hooks become real now that the target exists. ON DELETE SET NULL
-- keeps wag data safe if a client row is ever removed (mapping reverts to unmapped
-- semantics rather than blocking the delete).
ALTER TABLE sia.wag_groups
  ADD CONSTRAINT wag_groups_client_fk
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE sia.wag_contacts
  ADD CONSTRAINT wag_contacts_client_fk
  FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
