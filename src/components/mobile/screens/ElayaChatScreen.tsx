'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mic, Send } from 'lucide-react';
import { scrollToBottom } from '@/lib/utils/scroll';
import { IconKnob } from '../buttons';
import { DEMO_CHAT, DEMO_CHAT_SUGGESTIONS, type DemoChatMessage } from '../demo-data';

/**
 * Elaya (§06) — the house, in conversation. Halo'd ✦ header,
 * inset date chip, raised Elaya bubbles (r 20/20/20/6), accent-grad
 * user bubbles (r 20/20/6/20, ink fg), typing dots, suggestion
 * chips, floating composer + send knob. Her glyph always breathes
 * while she is present.
 *
 * Demo surface: sends echo locally with a canned butler reply —
 * the customer persona has no live brain yet.
 */

const ELAYA_RADIUS = '20px 20px 20px 6px';
const USER_RADIUS = '20px 20px 6px 20px';

function TypingBubble() {
  return (
    <div
      className="self-start flex gap-[5px] px-4 py-3 bg-(--neu-surface) border border-(--neu-edge-strong)"
      style={{ borderRadius: ELAYA_RADIUS, boxShadow: 'var(--neu-shadow-raised)' }}
    >
      {[0, 0.18, 0.36].map((delay) => (
        <span
          key={delay}
          className="neu-m-dot w-1.5 h-1.5 rounded-full bg-(--neu-text-tertiary)"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </div>
  );
}

export function ElayaChatScreen() {
  const router = useRouter();
  const [messages, setMessages] = useState<DemoChatMessage[]>(DEMO_CHAT);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (listRef.current) scrollToBottom(listRef.current);
  }, [messages, typing]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || typing) return;
    setMessages((prev) => [...prev, { from: 'user', text: trimmed }]);
    setDraft('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        { from: 'elaya', text: 'Consider it done — the house is on it.' },
      ]);
    }, 2000);
  };

  return (
    <div
      className="h-dvh flex flex-col gap-3 px-5 min-h-0"
      style={{
        paddingTop: 'max(14px, env(safe-area-inset-top))',
        paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
      }}
    >
      {/* Header — back · halo'd ✦ + ELAYA · ··· */}
      <div className="flex items-center justify-between">
        <IconKnob size={44} aria-label="Back" onClick={() => router.back()}>
          <ArrowLeft size={16} strokeWidth={1.7} />
        </IconKnob>
        <span className="flex flex-col items-center gap-[3px]">
          <span className="neu-m-halo-slow w-[38px] h-[38px] rounded-full bg-(--neu-surface) border border-(--neu-edge-strong) flex items-center justify-center text-sm text-(--neu-accent)">
            ✦
          </span>
          <span
            className="text-[9.5px] font-semibold text-(--neu-text-secondary)"
            style={{ letterSpacing: '0.22em', paddingLeft: '0.22em' }}
          >
            ELAYA
          </span>
        </span>
        <span className="w-11 h-11 shrink-0" aria-hidden />
      </div>

      {/* Date chip — inset pill */}
      <span
        className="self-center h-6 px-3.5 rounded-full bg-(--neu-well) flex items-center text-[9.5px] font-semibold text-(--neu-text-tertiary)"
        style={{
          letterSpacing: '0.12em',
          boxShadow:
            'inset 1px 1px 3px rgb(var(--neu-dark) / 0.25), inset -1px -1px 3px rgb(var(--neu-light) / 0.7)',
        }}
      >
        TODAY · 21:14
      </span>

      {/* Messages — the one scroll axis */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2.5">
        {messages.map((msg, i) =>
          msg.from === 'elaya' ? (
            <div
              key={i}
              className="self-start max-w-[82%] px-[15px] py-[13px] bg-(--neu-surface) border border-(--neu-edge-strong) text-[12.5px] leading-[1.55] text-(--neu-text-primary)"
              style={{ borderRadius: ELAYA_RADIUS, boxShadow: 'var(--neu-shadow-raised)' }}
            >
              {msg.text}
            </div>
          ) : (
            <div
              key={i}
              className="self-end max-w-[78%] px-[15px] py-[13px] border border-(--neu-accent-btn-edge) text-[12.5px] leading-[1.55] text-(--neu-accent-fg)"
              style={{
                borderRadius: USER_RADIUS,
                background: 'var(--neu-accent-gradient)',
                boxShadow: 'var(--neu-shadow-raised)',
              }}
            >
              {msg.text}
            </div>
          ),
        )}
        {typing && <TypingBubble />}
      </div>

      {/* Suggestion chips */}
      <div className="flex gap-2 overflow-x-auto">
        {DEMO_CHAT_SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="neu-m-touch h-9 px-3.5 shrink-0 rounded-full bg-(--neu-surface) border border-(--neu-edge) text-[11px] font-medium text-(--neu-accent-deep)"
            style={{ boxShadow: 'var(--neu-shadow-raised-sm)' }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Composer — floating pill + send knob */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex-1 flex items-center gap-2.5 h-[50px] px-4 rounded-full"
          style={{
            background: 'var(--neu-input-bg)',
            border: '1px solid var(--neu-input-edge)',
            boxShadow: 'var(--neu-shadow-input)',
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send(draft);
            }}
            placeholder="Write to Elaya…"
            className="flex-1 bg-transparent outline-none border-none text-[12.5px] text-(--neu-text-primary) placeholder:text-(--neu-text-tertiary)"
          />
          <Mic size={15} strokeWidth={1.7} className="shrink-0 text-(--neu-text-tertiary)" />
        </div>
        <button
          onClick={() => send(draft)}
          aria-label="Send"
          className="neu-m-touch-knob w-[50px] h-[50px] shrink-0 rounded-full border border-(--neu-accent-btn-edge) flex items-center justify-center text-(--neu-accent-fg)"
          style={{
            background: 'var(--neu-accent-gradient)',
            boxShadow: 'var(--neu-shadow-raised)',
          }}
        >
          <Send size={17} strokeWidth={1.7} />
        </button>
      </div>
    </div>
  );
}
