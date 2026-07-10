"use client";

/**
 * useNotifications — reads the notification inbox state from context.
 *
 * The state itself (Realtime subscription, chime, optimistic mark-read/all) now
 * lives in <NotificationsProvider> (src/components/layout/NotificationsProvider.tsx),
 * mounted ONCE in the dashboard layout so the subscription survives navigation.
 * This hook is a thin `useContext` wrapper so every consumer import keeps working.
 *
 * The provider seeds unread-only via getMyNotificationsAction — the hook no longer
 * takes a seed argument. The seed prop is accepted-and-ignored only so existing
 * `useNotifications({ userId, initialData })` call shapes compile during the
 * transition; new callers should call it with no argument.
 *
 * Display contract: the bell shows UNREAD only. Opening a notification marks it
 * read (optimistic) which drops it from the displayed list — it "goes away" once
 * actioned. See NotificationsProvider for the full state contract.
 */

import { useNotificationsContext } from "@/components/layout/NotificationsProvider";

interface UseNotificationsReturn {
  notifications: import("@/lib/types/database").Notification[];
  unreadCount:   number;
  markRead:      (id: string) => Promise<void>;
  markAllRead:   () => Promise<void>;
  isLoading:     boolean;
}

export function useNotifications(): UseNotificationsReturn {
  return useNotificationsContext();
}
