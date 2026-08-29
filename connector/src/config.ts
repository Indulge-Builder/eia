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
   * EMERGENCY-ONLY. The pairing-code flow is RETIRED (2026-08-29, RUNBOOK):
   * codes bind to the socket that minted them — crash-only restarts killed
   * them before they could be typed, and a failed attempt persists a
   * half-identity that poisons the next boot. THE flow is QR on a local
   * terminal into the Postgres auth store; leave WAG_PAIR_NUMBER unset.
   */
  pairNumber: env.WAG_PAIR_NUMBER || null,
};
