// THE Elaya SSE transport (R-01 — one loop, never forked). Both the desktop
// ElayaChatShell and the mobile ElayaChatScreen consume POST /api/elaya/chat
// through this single function: fetch, \n\n frame buffering, `data: ` parse,
// and the meta/delta/tool/done/error dispatch. The callers own ALL state
// (transcript, cap, toolStatus) via the handler callbacks — this module is
// transport only, no React.

export type ElayaSseEvent =
  | { type: 'meta'; conversationId: string; remainingToday: number }
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string }
  | { type: 'done'; messageId: string | null }
  | { type: 'error'; message: string };

// One status line per tool the model may call. Covers every read AND write tool —
// a tool with no entry falls back to the generic line. Keep in step with
// lib/elaya/tools/registry.ts + write-registry.ts (a missing write entry showed the
// generic "Checking Serene…" on a mutation — audit nit).
export const TOOL_STATUS_LABELS: Record<string, string> = {
  // Reads
  search_leads: 'Looking through your leads…',
  get_cold_leads: 'Finding leads going cold…',
  get_lead_details: 'Opening the lead…',
  get_my_tasks: 'Checking your tasks…',
  search_deals: 'Going through deals…',
  get_performance_snapshot: 'Pulling your numbers…',
  get_helpdesk_content: 'Browsing the case library…',
  get_escalations: 'Checking what needs attention…',
  get_domain_health: 'Pulling the domain scorecard…',
  get_campaigns: 'Looking at campaign performance…',
  get_budget: 'Pulling the spend numbers…',
  // Writes
  add_lead_note: 'Adding your note…',
  log_call: 'Logging the call…',
  create_lead_task: 'Creating the follow-up…',
  update_lead_status: 'Setting that up…',
  reassign_lead: 'Setting that up…',
  log_deal: 'Setting that up…',
  create_personal_task: 'Creating your task…',
  create_group_task: 'Creating the workspace…',
  create_subtask: 'Adding the task…',
  find_teammate: 'Finding your teammate…',
  update_task_status: 'Updating the task…',
  update_task: 'Updating the task…',
  delete_task: 'Setting that up…',
};

export function toolStatusLabel(name: string): string {
  return TOOL_STATUS_LABELS[name] ?? 'Checking Serene…';
}

export type ElayaStreamHandlers = {
  onMeta: (event: { conversationId: string; remainingToday: number }) => void;
  onDelta: (text: string) => void;
  onTool: (name: string) => void;
  onDone: () => void;
  /** A mid-stream `error` frame (model failure) — the stream may continue/close. */
  onStreamError: (message: string) => void;
  /** Non-200 pre-stream rejection: burst limit, daily cap, auth, Zod. */
  onRejected: (payload: { error: string | null; capReached: boolean }) => void;
};

/**
 * Send one message and pump the SSE stream to completion. Never throws for
 * server-shaped failures (routed to onRejected/onStreamError); a network-level
 * fetch/read failure DOES reject — callers keep their own catch (they already
 * own the toast + optimistic-bubble cleanup).
 */
export async function streamElayaChat(
  input: { message: string; conversationId: string },
  handlers: ElayaStreamHandlers,
): Promise<void> {
  const res = await fetch('/api/elaya/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: input.message, conversationId: input.conversationId }),
  });

  if (!res.ok || !res.body) {
    const payload = (await res.json().catch(() => null)) as
      | { error?: string; capReached?: boolean }
      | null;
    handlers.onRejected({
      error: payload?.error ?? null,
      capReached: payload?.capReached === true,
    });
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');

      if (!frame.startsWith('data: ')) continue;
      let event: ElayaSseEvent;
      try {
        event = JSON.parse(frame.slice(6)) as ElayaSseEvent;
      } catch {
        continue;
      }

      if (event.type === 'meta') {
        handlers.onMeta({
          conversationId: event.conversationId,
          remainingToday: event.remainingToday,
        });
      } else if (event.type === 'delta') {
        handlers.onDelta(event.text);
      } else if (event.type === 'tool') {
        handlers.onTool(event.name);
      } else if (event.type === 'done') {
        handlers.onDone();
      } else if (event.type === 'error') {
        handlers.onStreamError(event.message);
      }
    }
  }
}
