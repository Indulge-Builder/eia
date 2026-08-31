import { sanitizeText } from '@/lib/utils/sanitize';
import { normalizeToE164 } from '@/lib/utils/phone';
import { SHOP_ENQUIRY_TYPES, type ShopEnquiryType } from '@/lib/constants/lead-sources';

export type NormalizedLeadPayload = {
  first_name:   string;
  last_name:    string | null;
  email:        string | null;
  phone:        string;
  /** `utm_medium` column — fb|ig|msg|an for Meta; null for other platforms */
  medium:       string | null;
  utm_campaign: string | null;
  domain:       string | null;
  /** Platform-specific ad metadata — stored in leads.attribution JSONB */
  attribution:  Record<string, unknown> | null;
  form_data:    Record<string, unknown>;
  /**
   * App-channel product enquiry (source=shop_app). Written to the
   * lead_product_enquiries ledger, NOT to form_data — one lead accumulates many
   * of these and form_data is a write-once snapshot. Null for every other source.
   */
  product_enquiry: ProductEnquiryPayload | null;
};

/**
 * One product enquiry as it arrives from an app channel. Every field except
 * external_id / product_name / enquired_at is best-effort: the shop enriches at
 * delivery time and a redelivery after the product was deleted legitimately
 * carries nulls. external_id is the sender's own lead id and is what makes
 * redelivery idempotent (UNIQUE in migration 0180).
 */
export type ProductEnquiryPayload = {
  external_id:       string;
  product_id:        string | null;
  product_name:      string;
  product_url:       string | null;
  product_image_url: string | null;
  brand:             string | null;
  price:             number | null;
  currency:          string | null;
  price_region:      string | null;
  sold_out:          boolean | null;
  price_on_request:  boolean | null;
  enquiry_type:      ShopEnquiryType;
  note:              string | null;
  member_role:       string | null;
  admin_member_url:  string | null;
  enquired_at:       string;
};



function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function normalizePhone(raw: string): string {
  if (!raw) return '';
  try {
    return normalizeToE164(raw, 'IN');
  } catch {
    console.warn(`[adapters] Phone not E.164-normalizable, storing raw: "${raw}"`);
    return raw;
  }
}

/**
 * Accept a URL only if it is http(s). Zod's .url() and `new URL()` both happily
 * accept `javascript:` and `data:`, and these values are rendered as href and src
 * on the dossier card — so the scheme check is a security guard, not tidiness.
 * Anything else becomes null rather than throwing: a bad product link must never
 * cost us the lead.
 */
function safeHttpUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Finite numbers only — '', 'N/A' and NaN all become null. */
function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Tri-state boolean — absent stays null (unknown), never coerced to false. */
function bool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return null;
}

function splitName(full: string): [string, string | null] {
  const t = full.trim();
  const i = t.indexOf(' ');
  return i < 0 ? [t, null] : [t.slice(0, i), t.slice(i + 1)];
}

// ─────────────────────────────────────────────
// Meta adapter — source=meta
//
// Pabbly sends the full Meta Lead Ads payload wrapped in raw_data:
//   raw_data.res3.field_data  — JSON string containing all form answers
//   raw_data.res3             — campaign envelope: campaign_id, ad_name, campaign_name
//   raw_data.res2             — page access token: STRIPPED, never stored
//   raw_data.res1, res4, __multistep_http_codes — ignored
//
// Standard fields (full_name, phone_number, email) are extracted into typed columns.
// Every other question in field_data goes into form_data automatically.
// No config needed per campaign — new forms just work.
// ─────────────────────────────────────────────

// These field_data names map to typed columns — not repeated in form_data
const META_COLUMN_KEYS = new Set([
  'first_name', 'last_name', 'full_name',
  'email', 'email_address',
  'phone', 'phone_number', 'mobile_number',
]);

function parseFieldDataString(raw: unknown): Array<{ name: string; values: string[] }> {
  if (Array.isArray(raw)) return raw as Array<{ name: string; values: string[] }>;
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Array<{ name: string; values: string[] }>;
    } catch {
      console.warn('[adaptMeta] field_data JSON parse failed');
    }
  }
  return [];
}

function adaptMeta(raw: unknown): NormalizedLeadPayload {
  const top = (raw ?? {}) as Record<string, unknown>;

  // Unwrap raw_data if Pabbly wrapped the envelope (which it does)
  const envelope = (
    top.raw_data && typeof top.raw_data === 'object' && !Array.isArray(top.raw_data)
      ? top.raw_data
      : top
  ) as Record<string, unknown>;

  const res3 = (envelope.res3 && typeof envelope.res3 === 'object'
    ? envelope.res3
    : {}) as Record<string, unknown>;

  // Parse field_data — this is where all form answers live
  const fieldItems = parseFieldDataString(res3.field_data);

  // Flatten field_data into a map: { name → first value }
  const fields: Record<string, string> = {};
  for (const item of fieldItems) {
    if (typeof item.name === 'string') {
      fields[item.name] = str(item.values?.[0]);
    }
  }

  // Resolve standard contact fields from the fields map
  const get = (...keys: string[]): string => {
    for (const k of keys) {
      if (fields[k]) return fields[k];
    }
    return '';
  };

  // Name
  let firstName = get('first_name');
  let lastName: string | null = get('last_name') || null;
  if (!firstName) {
    const [fn, ln] = splitName(get('full_name'));
    firstName = fn;
    lastName = lastName ?? ln;
  }

  // form_data: every field_data answer that isn't a standard column key
  // This is where all custom campaign questions land automatically
  const formData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!META_COLUMN_KEYS.has(key) && value) {
      formData[key] = value;
    }
  }

  // attribution: platform-specific ad metadata
  const campaignId = str(res3.campaign_id) || null;
  const adName     = str(res3.ad_name) ? sanitizeText(str(res3.ad_name)) : null;
  const adsetName  = str(res3.adset_name) ? sanitizeText(str(res3.adset_name)) : null;

  const attributionObj: Record<string, unknown> = { platform: 'meta' };
  if (campaignId)  attributionObj.campaign_id = campaignId;
  if (adName)      attributionObj.ad_name = adName;
  if (adsetName)   attributionObj.adset_name = adsetName;

  return {
    first_name:   sanitizeText(firstName) || 'Unknown',
    last_name:    lastName ? sanitizeText(lastName) : null,
    email:        get('email', 'email_address') || null,
    phone:        normalizePhone(get('phone', 'phone_number', 'mobile_number')),
    medium:       res3?.platform ? sanitizeText(str(res3.platform)) : null,
    utm_campaign: str(res3.campaign_name) || null,
    domain:       null,  // resolved from utm_campaign in ingestion
    attribution:  attributionObj,
    form_data:    formData,
    product_enquiry: null,
  };
}

// ─────────────────────────────────────────────
// Google adapter — source=google
// Expects flat key-value payload from Pabbly.
// ─────────────────────────────────────────────
function adaptGoogle(raw: unknown): NormalizedLeadPayload {
  const r = (raw ?? {}) as Record<string, unknown>;

  const get = (k: string) => str(r[k]);

  let firstName = get('first_name');
  let lastName: string | null = get('last_name') || null;
  if (!firstName) {
    const [fn, ln] = splitName(get('full_name'));
    firstName = fn;
    lastName = lastName ?? ln;
  }

  const campaignId = get('campaign_id') || null;
  const adName     = get('ad_name') ? sanitizeText(get('ad_name')) : null;

  const attributionObj: Record<string, unknown> = { platform: 'google' };
  if (campaignId) attributionObj.campaign_id = campaignId;
  if (adName)     attributionObj.ad_name = adName;

  return {
    first_name:   sanitizeText(firstName) || 'Unknown',
    last_name:    lastName ? sanitizeText(lastName) : null,
    email:        get('email') || null,
    phone:        normalizePhone(get('phone') || get('phone_number')),
    medium:       get('utm_medium') || null,
    utm_campaign: get('utm_campaign') || null,
    domain:       get('domain') || null,
    attribution:  attributionObj,
    form_data:    {},
    product_enquiry: null,
  };
}

// ─────────────────────────────────────────────
// Website adapter — source=website
// Accepts camelCase aliases; any non-standard key → form_data.
// ─────────────────────────────────────────────
const WEBSITE_STANDARD_KEYS = new Set([
  'first_name', 'firstName', 'last_name', 'lastName',
  'full_name', 'fullName', 'email', 'mail',
  'phone', 'phoneNumber', 'domain',
  'utm_medium', 'utm_campaign',
]);

function adaptWebsite(raw: unknown): NormalizedLeadPayload {
  const r = (raw ?? {}) as Record<string, unknown>;

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = str(r[k]);
      if (v) return v;
    }
    return '';
  };

  let firstName = pick('first_name', 'firstName');
  let lastName: string | null = pick('last_name', 'lastName') || null;
  if (!firstName) {
    const [fn, ln] = splitName(pick('full_name', 'fullName'));
    firstName = fn;
    lastName = lastName ?? ln;
  }

  const formData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(r)) {
    if (!WEBSITE_STANDARD_KEYS.has(key)) formData[key] = value;
  }

  return {
    first_name:   sanitizeText(firstName) || 'Unknown',
    last_name:    lastName ? sanitizeText(lastName) : null,
    email:        pick('email', 'mail') || null,
    phone:        normalizePhone(pick('phone', 'phoneNumber')),
    medium:       pick('utm_medium') || null,
    utm_campaign: pick('utm_campaign') || null,
    domain:       pick('domain') || null,
    attribution:  { platform: 'website' },
    form_data:    formData,
    product_enquiry: null,
  };
}

// ─────────────────────────────────────────────
// Shop app adapter — source=shop_app
//
// The Indulge Shop app (React Native client, NestJS API on EC2). Unlike Meta this
// is a first-party sender: the payload is flat, server-built, and the client
// cannot forge identity — phone/name/product are all resolved server-side from the
// authenticated member before their webhook fires.
//
// Two things make this adapter different from adaptWebsite:
//
//   1. It builds a typed product_enquiry. Product data does NOT go to form_data,
//      because one lead accumulates many enquiries over time and form_data is
//      written once at INSERT and never updated (migration 0096 contract).
//
//   2. It carries an external_id (their Mongo lead ObjectId). Their delivery loop
//      retries 3x automatically plus unlimited manual retries, all with the same
//      id, so this is the value that makes redelivery idempotent.
//
// `city` is deliberately left INSIDE form_data: ingestLead already lifts
// form_data.city into the leads.city column and strips the key (lead-ingestion.ts
// step 6). Reusing that path rather than adding a second city route (R-01).
// ─────────────────────────────────────────────
const SHOP_APP_STANDARD_KEYS: ReadonlySet<string> = new Set([
  'first_name', 'firstName', 'last_name', 'lastName', 'full_name', 'fullName',
  'email', 'phone', 'phoneNumber', 'domain', 'utm_medium', 'utm_campaign',
  'idempotency_key', 'lead_id', 'external_lead_id',
  'product_id', 'product_name', 'product_url', 'product_image_url',
  'brand', 'price', 'currency', 'price_region', 'sold_out', 'price_on_request',
  'enquiry_type', 'enquiry_message', 'note', 'submitted_at',
  'member_role', 'member_city', 'admin_member_url', 'app_user_id',
  'platform', 'app_version',
]);

function adaptShopApp(raw: unknown): NormalizedLeadPayload {
  const r = (raw ?? {}) as Record<string, unknown>;

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = str(r[k]);
      if (v) return v;
    }
    return '';
  };

  let firstName = pick('first_name', 'firstName');
  let lastName: string | null = pick('last_name', 'lastName') || null;
  if (!firstName) {
    const [fn, ln] = splitName(pick('full_name', 'fullName'));
    firstName = fn;
    lastName = lastName ?? ln;
  }

  // Unknown enquiry types fall back to the default rather than reaching the DB
  // CHECK — the same posture as service interests: drop what we don't recognise,
  // never reject the lead for it.
  const rawType = pick('enquiry_type');
  const enquiryType: ShopEnquiryType =
    (SHOP_ENQUIRY_TYPES as readonly string[]).includes(rawType)
      ? (rawType as ShopEnquiryType)
      : 'enquire';
  if (rawType && rawType !== enquiryType) {
    console.warn(`[adapters] Unknown shop enquiry_type "${rawType}", defaulting to "enquire"`);
  }

  const externalId = pick('idempotency_key', 'lead_id', 'external_lead_id');
  const productName = pick('product_name');

  // Both are required for a usable enquiry row: without external_id it cannot be
  // de-duplicated, without a name the dossier card has nothing to render. Returning
  // null here (rather than throwing) lets ingestLead reject with a specific,
  // auditable ingestion_error instead of a generic validation failure.
  const productEnquiry: ProductEnquiryPayload | null =
    externalId && productName
      ? {
          external_id:       externalId,
          product_id:        pick('product_id') || null,
          product_name:      sanitizeText(productName),
          product_url:       safeHttpUrl(pick('product_url')),
          product_image_url: safeHttpUrl(pick('product_image_url')),
          brand:             pick('brand') ? sanitizeText(pick('brand')) : null,
          price:             num(r.price),
          currency:          pick('currency') ? sanitizeText(pick('currency')) : null,
          price_region:      pick('price_region') ? sanitizeText(pick('price_region')) : null,
          sold_out:          bool(r.sold_out),
          price_on_request:  bool(r.price_on_request),
          enquiry_type:      enquiryType,
          note:              pick('enquiry_message', 'note')
                               ? sanitizeText(pick('enquiry_message', 'note'))
                               : null,
          member_role:       pick('member_role') ? sanitizeText(pick('member_role')) : null,
          admin_member_url:  safeHttpUrl(pick('admin_member_url')),
          // Their timestamps are BSON dates serialised as ISO 8601 UTC. Fall back to
          // now() only when absent — an unparseable date must not sink the enquiry.
          enquired_at:       pick('submitted_at') || new Date().toISOString(),
        }
      : null;

  if (!productEnquiry) {
    console.warn(
      '[adapters] shop_app payload missing external id or product_name — enquiry cannot be recorded',
    );
  }

  // Anything the shop adds later that we haven't mapped still lands in form_data,
  // exactly like the website adapter, so a new field is never silently lost.
  const formData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(r)) {
    if (!SHOP_APP_STANDARD_KEYS.has(key)) formData[key] = value;
  }
  // Routed through the existing form_data.city → leads.city lift in ingestLead.
  const memberCity = pick('member_city');
  if (memberCity) formData.city = sanitizeText(memberCity);

  return {
    first_name:   sanitizeText(firstName) || 'Unknown',
    last_name:    lastName ? sanitizeText(lastName) : null,
    // The shop has no email field at all (no email/password login — phone OTP only),
    // so this is null in practice. Read anyway rather than hardcode the absence.
    email:        pick('email') || null,
    phone:        normalizePhone(pick('phone', 'phoneNumber')),
    medium:       pick('utm_medium') || null,
    utm_campaign: pick('utm_campaign') || null,
    domain:       pick('domain') || null,
    attribution: {
      // `platform` stays the CHANNEL, consistent with meta/google/website. The
      // member's device platform is a different fact and gets its own key.
      platform:     'shop_app',
      app_platform: pick('platform') || null,
      app_version:  pick('app_version') || null,
      app_user_id:  pick('app_user_id') || null,
    },
    form_data:    formData,
    product_enquiry: productEnquiry,
  };
}

// ─────────────────────────────────────────────
// Source selector
// ─────────────────────────────────────────────
export type LeadSource = 'meta' | 'google' | 'website' | 'shop_app';

export function selectAdapter(source: string | null): (raw: unknown) => NormalizedLeadPayload {
  switch (source) {
    case 'meta':     return adaptMeta;
    case 'google':   return adaptGoogle;
    case 'shop_app': return adaptShopApp;
    default:         return adaptWebsite;
  }
}
