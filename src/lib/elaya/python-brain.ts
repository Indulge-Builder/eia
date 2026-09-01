// SERVER ONLY — THE Node → Python-brain transport (Step 3, channel tranche 2026-08-31).
//
// The Python brain (backend/app, the Fargate `api` service) exposes the SAME SSE
// wire as /api/elaya/chat. This module is the one place Node speaks to it:
// bearer auth with the shared BRAIN_API_SECRET, the request shape, the frame
// pump (lib/elaya/sse.ts — the browser transport's own parser), and the
// mapping of its rejections onto a small, typed outcome the caller can act on
// without ever seeing HTTP. Today's caller is the WhatsApp staff gate
// (services/elaya-whatsapp.ts); the in-app flip will pipe the same frames
// through /api/elaya/chat — never a second client.
//
// Trust posture: the bearer is a server secret (S-11) and the brain
// re-verifies the user id against public.profiles before any model runs, so
// this client passes ONLY an id it has already resolved from a verified source
// (the phone-matched active profile). Never a request-supplied user id.
//
// Transport security: ELAYA_BRAIN_URL must be an https:// origin in production
// (the CloudFront front on the brain's load balancer) — the bearer and staff
// message text cross the public internet on this hop. A plain http:// URL is
// refused outside development, by construction.

import { readElayaSseStream, type ElayaSseEvent } from '@/lib/elaya/sse';
import type { ElayaChannel } from '@/lib/types/elaya';

/** Whole-turn budget. The WhatsApp webhook lambda has 180s; voice transcription
 *  (≤15s) and the reply send must still fit after this. */
const DEFAULT_TIMEOUT_MS = 120_000;

export type PythonBrainTurnInput = {
  /** A VERIFIED profile id (phone-matched / session-resolved) — never request input. */
  userId: string;
  /** Already sanitised text (the caller runs sanitizeText + its length bound). */
  message: string;
  channel: ElayaChannel;
  /** WhatsApp only — the Gupshup message id (the brain's dedup key). */
  waMessageId?: string;
  /** Continue a specific owned conversation; omitted → the active 24h session. */
  conversationId?: string;
};

export type PythonBrainTurnResult =
  | {
      ok: true;
      /** The full assistant text (resolver line + model prose), raw markdown. */
      text: string;
      conversationId: string | null;
      /** The persisted assistant row id (null if the brain could not save it). */
      messageId: string | null;
      toolsUsed: string[];
      /** This message's ordinal today — for the learned-memory throttle; 0 when unknown. */
      messagesToday: number;
    }
  | {
      ok: false;
      reason:
        | 'unconfigured' // ELAYA_BRAIN_URL / BRAIN_API_SECRET missing (or http:// in prod)
        | 'cap' // 429 — the shared daily cap; nothing persisted
        | 'duplicate' // 409 — the wa_message_id already ran (BSP redelivery)
        | 'unauthorized' // 401/403 — secret drift or an unknown/inactive user
        | 'unavailable'; // network / 5xx / timeout / mid-stream error frame
      /** Text collected BEFORE a mid-stream error frame (may confirm an executed action). */
      partialText?: string;
      status?: number;
    };

function brainBaseUrl(): string | null {
  const raw = process.env.ELAYA_BRAIN_URL?.trim();
  if (!raw) return null;
  const url = raw.replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(url)) return null;
  if (url.startsWith('http://') && process.env.NODE_ENV === 'production') {
    // The bearer + staff text must never cross the internet in cleartext.
    console.error('[python-brain] ELAYA_BRAIN_URL must be https:// in production — refusing');
    return null;
  }
  return url;
}

/** True when Node can reach the Python brain (URL + secret present and sane). */
export function isPythonBrainConfigured(): boolean {
  return brainBaseUrl() !== null && Boolean(process.env.BRAIN_API_SECRET?.trim());
}

/**
 * Run ONE turn on the Python brain and pump its stream to completion.
 * Never throws for server-shaped failures — every rejection maps to a typed
 * `ok: false` reason so the caller picks the user-facing copy. `onEvent`
 * receives every frame (the future in-app proxy pipes them through).
 */
export async function runPythonBrainTurn(
  input: PythonBrainTurnInput,
  opts: { onEvent?: (event: ElayaSseEvent) => void; timeoutMs?: number } = {},
): Promise<PythonBrainTurnResult> {
  const base = brainBaseUrl();
  const secret = process.env.BRAIN_API_SECRET?.trim();
  if (!base || !secret) return { ok: false, reason: 'unconfigured' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let text = '';
  let conversationId: string | null = null;
  let messageId: string | null = null;
  let messagesToday = 0;
  const toolsUsed: string[] = [];
  let errorFrame: string | null = null;

  try {
    const res = await fetch(`${base}/v1/elaya/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        user_id: input.userId,
        message: input.message,
        channel: input.channel,
        conversation_id: input.conversationId ?? null,
        wa_message_id: input.waMessageId ?? null,
      }),
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const status = res.status;
      if (status === 429) return { ok: false, reason: 'cap', status };
      if (status === 409) return { ok: false, reason: 'duplicate', status };
      if (status === 401 || status === 403) return { ok: false, reason: 'unauthorized', status };
      return { ok: false, reason: 'unavailable', status };
    }

    await readElayaSseStream(res.body, (event) => {
      opts.onEvent?.(event);
      if (event.type === 'meta') {
        conversationId = event.conversationId;
        if (typeof event.messagesToday === 'number') messagesToday = event.messagesToday;
      } else if (event.type === 'delta') {
        text += event.text;
      } else if (event.type === 'tool') {
        toolsUsed.push(event.name);
      } else if (event.type === 'done') {
        messageId = event.messageId;
      } else if (event.type === 'error') {
        errorFrame = event.message;
      }
    });
  } catch (err) {
    // D-05: the failure shape only — never the message text.
    console.error(
      '[python-brain] turn transport failed:',
      err instanceof Error ? `${err.name}: ${err.message}` : err,
    );
    return { ok: false, reason: 'unavailable', partialText: text || undefined };
  } finally {
    clearTimeout(timer);
  }

  if (errorFrame !== null) {
    console.error('[python-brain] brain reported a turn error:', errorFrame);
    return { ok: false, reason: 'unavailable', partialText: text || undefined };
  }

  return { ok: true, text, conversationId, messageId, toolsUsed, messagesToday };
}
