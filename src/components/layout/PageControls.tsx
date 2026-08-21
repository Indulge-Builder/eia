"use client";

/**
 * PageControls — the global controls cluster that lives ON the page title row
 * (right-aligned, beside the page's own action button), so it reads as part of
 * the page — no separate bar, no strip, no divider (TOP_BAR_ENABLED).
 *
 * Hosts the admin/founder domain selector + the notification bell. Pages render
 * it in their `flex items-center justify-between` title row; it sits at the far
 * right next to the page CTA. The domain selector stays visible at every
 * breakpoint — it used to hide below md, but the dashboard has no per-page filter
 * bar to fall back to, so hiding it stranded admin/founder with the date filter
 * but no domain scope. DomainSelector composes <FilterDropdown menuPortal>, so
 * its menu body-portals out and never clips on a narrow viewport.
 *
 * The bell reads its state from <NotificationsProvider> (mounted once in the
 * dashboard layout) via useNotifications — so it no longer seeds per page and no
 * longer tears down its Realtime channel on navigation. PageControls no longer
 * takes or forwards a notification seed.
 */

import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Tooltip } from "@/components/ui/Tooltip";
import { DomainSelector } from "@/components/layout/DomainSelector";

// ─── PageControls ─────────────────────────────────────────

type PageControlsProps = {
  isPrivileged: boolean; // admin || founder → the domain selector renders
};

export function PageControls({ isPrivileged }: PageControlsProps) {
  return (
    <div className="serene-page-controls">
      {isPrivileged && (
        <span className="serene-page-controls-selector">
          <DomainSelector />
        </span>
      )}

      {/* Icon-only control — charcoal tooltip carries the label (polish §05) */}
      <Tooltip label="Notifications" side="bottom">
        <NotificationBell variant="topbar" />
      </Tooltip>
    </div>
  );
}
