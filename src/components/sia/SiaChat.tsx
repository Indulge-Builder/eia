"use client";

// The Sia chat pane — a read-only WhatsApp-Web-style viewer over one group.
// There is deliberately NO compose bar: Serene never sends into these groups
// (the watcher is a silent ear, plan-whatsapp §6.1).
//
// Live tail: while the chat is open and the tab visible, a 4s poll through the
// role-gated action appends anything newer than the last known message. This is
// the pilot's "realtime" — wag_ tables are service_role-only (deny-by-default
// RLS), so client-side Supabase Realtime would deliver nothing; the poll keeps
// every byte behind the admin/founder action boundary (Q-13). Push transport can
// replace the interval when the connector moves to Fargate (Sia W1).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import { ArrowDown, ArrowLeft, Search, Users, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { SearchBar } from "@/components/ui/SearchBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { LogoSpinner } from "@/components/ui/LogoSpinner";
import { CollapseReveal } from "@/components/ui/CollapseReveal";
import { useDebounce } from "@/hooks/useDebounce";
import { scrollToBottom } from "@/lib/utils/scroll";
import { formatDate } from "@/lib/utils/dates";
import { SPRING_CONFIG, FAST_DURATION, EASE_IN_OUT } from "@/lib/constants/motion";
import { getSiaMessagesAction, searchSiaMessagesAction } from "@/lib/actions/sia";
import { SiaDaySeparator, SiaMessageBubble } from "./SiaMessageBubble";
import { SiaGroupInfoPanel } from "./SiaGroupInfoPanel";
import { groupTitle, senderLabel, SiaKindPill } from "./sia-shared";
import type { SiaGroupRow, SiaMessageRow, SiaSearchHit } from "@/lib/services/sia-service";

const LIVE_POLL_MS = 4000;
const NEAR_BOTTOM_PX = 140;

export function SiaChat({
  group,
  isMobile,
  onBack,
  onLiveMessages,
  onPatchGroup,
}: {
  group: SiaGroupRow;
  isMobile: boolean;
  onBack: () => void;
  /** Lets the rail update its preview/count when new messages land here. */
  onLiveMessages: (groupJid: string, latest: SiaMessageRow[], addedCount: number) => void;
  /** Mapping writes from the info panel patch the shared group state. */
  onPatchGroup: (jid: string, patch: Partial<SiaGroupRow>) => void;
}) {
  const [messages, setMessages] = useState<SiaMessageRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [hits, setHits] = useState<SiaSearchHit[] | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const knownIds = useRef<Set<string>>(new Set());
  const latestTs = useRef<string | null>(null);
  const liveIds = useRef<Set<string>>(new Set());
  const debouncedSearch = useDebounce(searchInput, 350);
  const searching = hits !== null;

  const nearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX;
  };

  // ── Initial page ──
  useEffect(() => {
    let alive = true;
    setLoading(true);
    getSiaMessagesAction(group.group_jid).then((res) => {
      if (!alive) return;
      if (res.data) {
        setMessages(res.data.messages);
        setHasMore(res.data.hasMore);
        knownIds.current = new Set(res.data.messages.map((m) => m.id));
        latestTs.current = res.data.messages.at(-1)?.wa_timestamp ?? null;
      }
      setLoading(false);
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollToBottom(scrollRef.current);
      });
    });
    return () => {
      alive = false;
    };
  }, [group.group_jid]);

  // ── Live tail — the 4s poll ──
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      if (!latestTs.current) return;
      const res = await getSiaMessagesAction(group.group_jid, { after: latestTs.current });
      const fresh = (res.data?.messages ?? []).filter((m) => !knownIds.current.has(m.id));
      if (fresh.length === 0) return;
      for (const m of fresh) {
        knownIds.current.add(m.id);
        liveIds.current.add(m.id);
      }
      latestTs.current = fresh.at(-1)!.wa_timestamp;
      const stick = nearBottom();
      setMessages((prev) => [...prev, ...fresh]);
      onLiveMessages(group.group_jid, fresh, fresh.length);
      if (stick && !searching) {
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollToBottom(scrollRef.current);
        });
      } else {
        setUnseen((n) => n + fresh.length);
      }
    };
    const t = setInterval(tick, LIVE_POLL_MS);
    return () => clearInterval(t);
  }, [group.group_jid, onLiveMessages, searching]);

  // ── Clear the unseen pill once the reader reaches the bottom ──
  const handleScroll = useCallback(() => {
    if (unseen > 0 && nearBottom()) setUnseen(0);
  }, [unseen]);

  const jumpToLatest = useCallback(() => {
    if (scrollRef.current) scrollToBottom(scrollRef.current);
    setUnseen(0);
  }, []);

  // ── Older history (scroll position preserved) ──
  const loadOlder = useCallback(async () => {
    if (loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[0].wa_timestamp;
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const res = await getSiaMessagesAction(group.group_jid, { before: oldest });
    if (res.data) {
      const older = res.data.messages.filter((m) => !knownIds.current.has(m.id));
      for (const m of older) knownIds.current.add(m.id);
      setMessages((prev) => [...older, ...prev]);
      setHasMore(res.data.hasMore);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    }
    setLoadingMore(false);
  }, [group.group_jid, messages, loadingMore]);

  // ── In-group search (debounced) ──
  useEffect(() => {
    const q = debouncedSearch.trim();
    if (q.length < 2) {
      setHits(null);
      return;
    }
    let alive = true;
    searchSiaMessagesAction(q, group.group_jid).then((res) => {
      if (alive && res.data) setHits(res.data);
    });
    return () => {
      alive = false;
    };
  }, [debouncedSearch, group.group_jid]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchInput("");
    setHits(null);
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollToBottom(scrollRef.current);
    });
  }, []);

  const memberMeta = useMemo(() => {
    const parts: string[] = [];
    if (group.member_count) parts.push(`${group.member_count} members`);
    parts.push(`${group.message_count.toLocaleString("en-IN")} messages`);
    return parts.join(" · ");
  }, [group.member_count, group.message_count]);

  return (
    <section
      className="relative flex flex-col min-h-0 flex-1 rounded-(--radius-lg) border border-(--theme-paper-border) bg-(--theme-paper) shadow-(--shadow-1) overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="px-4 py-2.5 border-b border-(--theme-paper-border) bg-(--theme-paper)">
        <div className="flex items-center gap-3">
          {isMobile && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to conversations"
              className="serene-pressable shrink-0 w-8 h-8 rounded-full border border-(--theme-paper-border) bg-(--theme-paper) flex items-center justify-center text-(--theme-text-secondary)"
              style={{ cursor: "pointer" }}
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setInfoOpen((v) => !v)}
            aria-label="Open group info"
            title="Group info"
            className="min-w-0 flex-1 flex items-center gap-3 text-left border-0 bg-transparent rounded-(--radius-md) px-1 py-0.5 -mx-1 hover:bg-(--theme-paper-subtle)"
            style={{ cursor: "pointer", transition: "background var(--duration-fast) var(--ease-in-out)" }}
          >
            <Avatar name={groupTitle(group)} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="type-body-sm font-(--weight-medium) text-(--theme-text-primary) truncate">
                  {groupTitle(group)}
                </span>
                <SiaKindPill kind={group.group_kind} />
              </div>
              <div className="type-caption text-(--theme-text-tertiary) truncate inline-flex items-center gap-1">
                <Users className="w-3 h-3" strokeWidth={1.5} />
                {memberMeta}
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            aria-label={searchOpen ? "Close search" : "Search this conversation"}
            title={searchOpen ? "Close search" : "Search this conversation"}
            className="serene-pressable shrink-0 w-8 h-8 rounded-full border flex items-center justify-center"
            style={{
              cursor: "pointer",
              borderColor: searchOpen ? "var(--theme-accent)" : "var(--theme-paper-border)",
              background: searchOpen ? "var(--theme-accent-surface)" : "var(--theme-paper)",
              color: searchOpen ? "var(--neu-accent-deep)" : "var(--theme-text-secondary)",
            }}
          >
            {searchOpen ? <X className="w-4 h-4" strokeWidth={1.5} /> : <Search className="w-4 h-4" strokeWidth={1.5} />}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {searchOpen && (
            <CollapseReveal key="sia-chat-search">
              <div className="pt-2.5">
                <SearchBar
                  value={searchInput}
                  onChange={setSearchInput}
                  placeholder="Search this conversation"
                  size="sm"
                  autoFocus
                  aria-label="Search messages in this group"
                />
              </div>
            </CollapseReveal>
          )}
        </AnimatePresence>
      </div>

      {/* ── Body: the wallpapered stream (or search results) ── */}
      <div className="relative flex-1 min-h-0 flex flex-col" style={{ background: "var(--theme-paper-subtle)" }}>
        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 sm:px-6">
          {searching ? (
            <SiaSearchResults hits={hits} query={debouncedSearch} />
          ) : loading ? (
            <div className="h-full flex items-center justify-center">
              <LogoSpinner size="md" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <EmptyState variant="inline" title="No messages captured yet" />
            </div>
          ) : (
            <>
              {hasMore && (
                <div className="flex justify-center mb-2">
                  <button
                    type="button"
                    onClick={loadOlder}
                    disabled={loadingMore}
                    className="serene-pressable type-caption rounded-full px-3.5 py-1 border border-(--neu-edge)"
                    style={{
                      background: "var(--neu-surface-high)",
                      boxShadow: "var(--neu-shadow-chip)",
                      color: "var(--theme-text-secondary)",
                      cursor: loadingMore ? "default" : "pointer",
                      fontWeight: "var(--weight-medium)",
                    }}
                  >
                    {loadingMore ? "Loading…" : "Load older messages"}
                  </button>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={m.id}>
                  {(!messages[i - 1] ||
                    new Date(messages[i - 1].wa_timestamp).toDateString() !==
                      new Date(m.wa_timestamp).toDateString()) && <SiaDaySeparator ts={m.wa_timestamp} />}
                  <SiaMessageBubble
                    m={m}
                    prev={messages[i - 1]}
                    chatJid={group.group_jid}
                    entrance={liveIds.current.has(m.id)}
                  />
                </div>
              ))}
            </>
          )}
        </div>

        {/* ── New-messages pill (arrivals while scrolled up) ── */}
        <AnimatePresence>
          {unseen > 0 && !searching && (
            <motion.button
              key="sia-unseen"
              type="button"
              onClick={jumpToLatest}
              initial={{ opacity: 0, y: 10, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, transition: { duration: FAST_DURATION, ease: EASE_IN_OUT } }}
              transition={SPRING_CONFIG}
              className="serene-pressable absolute left-1/2 -translate-x-1/2 rounded-full inline-flex items-center gap-1.5 border-0 type-caption"
              style={{
                bottom: "16px",
                padding: "5px 14px",
                background: "var(--theme-accent)",
                color: "var(--theme-accent-fg)",
                boxShadow: "var(--shadow-2)",
                cursor: "pointer",
                fontWeight: "var(--weight-medium)",
                zIndex: "var(--z-raised)",
              }}
            >
              <ArrowDown className="w-3.5 h-3.5" strokeWidth={2} />
              {unseen} new {unseen === 1 ? "message" : "messages"}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Group info panel (parallel side panel over the pane) ── */}
      <AnimatePresence>
        {infoOpen && (
          <SiaGroupInfoPanel
            key={`info-${group.group_jid}`}
            group={group}
            onClose={() => setInfoOpen(false)}
            onPatchGroup={onPatchGroup}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

function SiaSearchResults({ hits, query }: { hits: SiaSearchHit[] | null; query: string }) {
  if (!hits || hits.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState variant="inline" title={hits ? `Nothing matches "${query.trim()}"` : "Searching…"} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="type-caption text-(--theme-text-tertiary)">
        {hits.length} match{hits.length === 1 ? "" : "es"}
      </div>
      {hits.map((h) => (
        <motion.div
          key={h.id}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: FAST_DURATION, ease: EASE_IN_OUT }}
          className="rounded-(--radius-md) px-3.5 py-2.5 border border-(--neu-edge)"
          style={{ background: "var(--neu-surface-high)", boxShadow: "var(--neu-shadow-chip)" }}
        >
          <div className="flex items-baseline justify-between gap-3 mb-0.5">
            <span
              className="type-caption truncate"
              style={{ color: "var(--theme-text-secondary)", fontWeight: "var(--weight-medium)" }}
            >
              {senderLabel(h)}
            </span>
            <span
              className="tabular-nums shrink-0"
              style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--theme-text-tertiary)" }}
            >
              {formatDate(h.wa_timestamp, "h:mm a, d MMM yyyy")}
            </span>
          </div>
          <div className="type-body-sm text-(--theme-text-primary)" style={{ wordBreak: "break-word" }}>
            {h.text ?? `(${h.type})`}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
