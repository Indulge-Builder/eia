"use client";

/**
 * NotificationsProvider — the ONE mount that owns notification inbox state.
 *
 * Mounted once in the dashboard layout (src/app/(dashboard)/layout.tsx) so the
 * Realtime channel survives navigation. Before this, the bell lived in
 * PageControls, which remounts on every route change — tearing down and
 * recreating the Realtime channel per navigation, so INSERTs landing in the gap
 * were silently missed, the badge flickered through the fallback, and optimistic
 * state was discarded.
 *
 * State (read + unread, subscription, chime) lives HERE and is exposed via
 * context. `useNotifications` is now just `useContext(NotificationsContext)`, so
 * every consumer import (NotificationBell) keeps working unchanged.
 *
 * Display contract: the bell shows UNREAD only. Opening a notification marks it
 * read (optimistic) which drops it from the displayed list — it "goes away" once
 * actioned. The full array is kept internally so a failed mark-read rolls the
 * item back into view.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  markNotificationReadAction,
  markAllReadAction,
  getMyNotificationsAction,
} from "@/lib/actions/notifications";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import type { Notification } from "@/lib/types/database";

// ─── Context shape ──────────────────────────────────────────────────────────

interface NotificationsContextValue {
  notifications: Notification[];
  unreadCount:   number;
  markRead:      (id: string) => Promise<void>;
  markAllRead:   () => Promise<void>;
  isLoading:     boolean;
}

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/** Consumed by `useNotifications` (src/hooks/useNotifications.ts). */
export function useNotificationsContext(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error(
      "useNotifications must be used within a <NotificationsProvider>",
    );
  }
  return ctx;
}

// ─── Provider ───────────────────────────────────────────────────────────────

interface NotificationsProviderProps {
  userId:   string;
  children: ReactNode;
}

export function NotificationsProvider({
  userId,
  children,
}: NotificationsProviderProps) {
  // `allNotifications` holds the full set (read + unread) so a failed mark-read
  // can roll an item back. The bell only ever renders the unread slice below.
  const [allNotifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading]            = useState(false);

  // Strict Mode runs setup→teardown→setup; the mount nonce makes the second
  // setup create a fresh channel instead of re-`.on()`ing a subscribed one (P-06).
  const mountId = useId();

  const sound = useNotificationSound();

  // Latest-ref for the chime: `play` is recreated when the sound pref hydrates/
  // changes, but the channel subscription must NOT re-run on that — the ref keeps
  // the handler on the current `play` without adding it to the effect deps.
  const playRef = useRef(sound.play);
  playRef.current = sound.play;

  // Displayed list = unread only. Marking read drops the item from view.
  const notifications = allNotifications.filter((n) => n.read_at === null);
  const unreadCount    = notifications.length;

  // ── Seed (unread-only, once on mount) ───────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    void getMyNotificationsAction().then((result) => {
      if (cancelled) return;
      if (result.data) setNotifications(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    const supabase = createClient();

    // Filter strictly at channel level — not in JS after event arrives.
    // Wrong filter = all users' notifications broadcast to all clients (pre-mortem item 1).
    const channel = supabase
      .channel(`notifications:${userId}:${mountId}`)
      .on(
        "postgres_changes",
        {
          event:  "INSERT",
          schema: "public",
          table:  "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as Notification;
          setNotifications((prev) => [incoming, ...prev].slice(0, 50));
          playRef.current();
        },
      )
      .on(
        "postgres_changes",
        {
          event:  "UPDATE",
          schema: "public",
          table:  "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification;
          // Upsert semantics — the list is unread-only, so an UPDATE may target a
          // row outside the window. A plain `.map` by id would silently drop it.
          setNotifications((prev) => {
            // Marked read elsewhere → remove it from view.
            if (updated.read_at !== null) {
              return prev.filter((n) => n.id !== updated.id);
            }
            // Still unread and not in state → prepend, re-cap at 50.
            if (!prev.some((n) => n.id === updated.id)) {
              return [updated, ...prev].slice(0, 50);
            }
            // Present → replace in place.
            return prev.map((n) => (n.id === updated.id ? updated : n));
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, mountId]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const markRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString() } : n,
      ),
    );

    const result = await markNotificationReadAction(id);
    if (result.error) {
      // Rollback on failure
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: null } : n)),
      );
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();

    // Snapshot the ids of every currently-unread row BEFORE the optimistic write,
    // so a failed server write rolls back exactly those rows — keyed by id, not by
    // `read_at === now` (a Realtime UPDATE interleaving during the request would
    // give a touched row a different timestamp and leave it stuck hidden).
    let snapshotUnreadIds: string[] = [];
    setNotifications((prev) => {
      snapshotUnreadIds = prev.filter((n) => n.read_at === null).map((n) => n.id);
      return prev.map((n) => (n.read_at === null ? { ...n, read_at: now } : n));
    });

    setIsLoading(true);
    const result = await markAllReadAction();
    setIsLoading(false);

    if (result.error) {
      // Rollback on failure — restore read_at = null for every snapshotted id
      // still present in state (a since-removed row is simply skipped).
      const ids = new Set(snapshotUnreadIds);
      setNotifications((prev) =>
        prev.map((n) => (ids.has(n.id) ? { ...n, read_at: null } : n)),
      );
    }
  }, []);

  return (
    <NotificationsContext.Provider
      value={{ notifications, unreadCount, markRead, markAllRead, isLoading }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
