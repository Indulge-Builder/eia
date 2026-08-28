// Connector config — reads the repo's .env.local (Supabase URL + service key).
// The connector is its own process with its own Supabase client (service role,
// direct writes per plan-whatsapp §10.2 — no webhook hop). Secrets never logged.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const CONNECTOR_DIR = resolve(HERE, "..");
const REPO_ROOT = resolve(CONNECTOR_DIR, "..");

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const eq = trimmed.indexOf("=");
      out[trimmed.slice(0, eq).trim()] = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  } catch {
    /* missing file → env vars only */
  }
  return out;
}

const fileEnv = parseEnvFile(resolve(REPO_ROOT, ".env.local"));
const env = { ...fileEnv, ...process.env } as Record<string, string>;

function required(key: string): string {
  const value = env[key];
  if (!value) throw new Error(`[config] missing ${key} (looked in ../.env.local and process env)`);
  return value;
}

export const config = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, ""),
  supabaseServiceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  /**
   * Media store (Sia W1): when WAG_MEDIA_BUCKET is set (the Fargate deployment —
   * Copilot's S3 addon injects SIA_MEDIA_NAME), downloads upload to S3 and
   * wag_media.storage_path records `s3://bucket/key`. Unset (local dev) keeps
   * the on-disk store under connector/media/.
   */
  mediaBucket: env.WAG_MEDIA_BUCKET || env.SIAMEDIA_NAME || null,
  awsRegion: env.AWS_REGION || "ap-south-1",
  mediaDir: env.WAG_MEDIA_DIR || resolve(CONNECTOR_DIR, "media"),
  /**
   * The watcher's own number (digits + country code, no '+'). When set AND the
   * session is unregistered, the connector pairs with an 8-character CODE
   * instead of a QR — the only workable route on a headless host, where a
   * 65-line QR arrives in log batches and expires before it is fully drawn.
   * Unset (local dev with a terminal) keeps the QR.
   */
  pairNumber: env.WAG_PAIR_NUMBER || null,
};
