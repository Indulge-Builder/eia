-- ════════════════════════════════════════════════════════════════════════════
-- Subscriptions — encrypt `subscriptions.password` at rest.
--
-- Phase 1 stored the service credential in plaintext (RLS-protected only). This
-- hardens it: pgcrypto pgp_sym_encrypt with a symmetric key held in Supabase Vault
-- (the supported replacement for the deprecated pgsodium transparent column
-- encryption). The key is generated at migration-run time — it NEVER appears in
-- this file — and lives encrypted in Vault, readable only inside SECURITY DEFINER
-- functions. The column stores base64 ciphertext; plaintext is produced only by
-- decrypt_subscription_password (service_role only), surfaced via an explicit
-- reveal action — never in list/detail row payloads.
--
-- No backfill: this runs on the greenfield subscriptions table (0163, no prod
-- rows yet). A BEFORE INSERT/UPDATE trigger encrypts on write transparently.
-- ════════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault;

-- One-time random 256-bit key, stored encrypted in Vault (idempotent).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'subscription_password_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'base64'),
      'subscription_password_key',
      'Symmetric key for encrypting subscriptions.password at rest'
    );
  end if;
end $$;

-- ── Encrypt / decrypt — SECURITY DEFINER, service_role only (A-10 explicit path) ──
create or replace function public.encrypt_subscription_password(p_plaintext text)
returns text
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_key text;
begin
  if p_plaintext is null then
    return null;
  end if;
  select decrypted_secret into v_key
    from vault.decrypted_secrets
    where name = 'subscription_password_key';
  return encode(pgp_sym_encrypt(p_plaintext, v_key), 'base64');
end;
$$;

create or replace function public.decrypt_subscription_password(p_ciphertext text)
returns text
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_key text;
begin
  if p_ciphertext is null then
    return null;
  end if;
  select decrypted_secret into v_key
    from vault.decrypted_secrets
    where name = 'subscription_password_key';
  return pgp_sym_decrypt(decode(p_ciphertext, 'base64'), v_key);
exception
  when others then
    -- Unreadable / legacy-plaintext value → null rather than raising.
    return null;
end;
$$;

-- ── Transparent write-encryption trigger ────────────────────────────────────────
-- INSERT: encrypt any non-null password. UPDATE: encrypt only when the value
-- actually changed (a new plaintext) — an unchanged column keeps its ciphertext,
-- never double-encrypted. The app writes PLAINTEXT on create/change and omits the
-- column entirely when unchanged, so `IS DISTINCT FROM OLD` is the exact signal.
create or replace function public.encrypt_subscription_password_trigger()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
begin
  if NEW.password is null then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and NEW.password is not distinct from OLD.password then
    return NEW; -- unchanged ciphertext — do not re-encrypt
  end if;
  NEW.password := public.encrypt_subscription_password(NEW.password);
  return NEW;
end;
$$;

create trigger encrypt_subscriptions_password
  before insert or update on public.subscriptions
  for each row execute function public.encrypt_subscription_password_trigger();

-- ── Grants — admin-client (service_role) only; the action is the trust boundary ──
revoke execute on function public.encrypt_subscription_password(text) from public, anon, authenticated;
revoke execute on function public.decrypt_subscription_password(text) from public, anon, authenticated;
grant execute on function public.encrypt_subscription_password(text) to service_role;
grant execute on function public.decrypt_subscription_password(text) to service_role;

comment on column public.subscriptions.password is
  'Service credential, ENCRYPTED AT REST (pgcrypto pgp_sym_encrypt → base64) with a Vault-stored '
  'key (migration 0166). Encrypted transparently on write by the encrypt_subscriptions_password '
  'trigger; decrypted only by decrypt_subscription_password() (SECURITY DEFINER, service_role only) '
  'via revealSubscriptionPasswordAction on an explicit reveal. NEVER selected into list/detail '
  'row payloads.';
