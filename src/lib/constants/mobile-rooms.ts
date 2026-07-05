import {
  LayoutDashboard,
  SquareCheckBig,
  Wallet,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/lib/types/database';
import {
  GIA_DOMAINS,
  DOMAIN_LABELS,
  DOMAIN_ICONS,
  isGiaDomain,
  type GiaDomain,
} from '@/lib/constants/domains';
import type { AppDomain } from '@/lib/types/database';

/**
 * Mobile Ops room registry (docs/modules/mobile-ops.md §4).
 * Pure data, no component refs (dashboard-widgets.ts precedent).
 *
 * EXACTLY four rooms per role — the tuple type makes a fifth tab a
 * compile error. The Elaya knob is NOT a room; MobileTabBar hardcodes
 * it center, always.
 */

/**
 * Set by the mobile drawer's "View desktop site" link; read by the
 * /dashboard page to skip the mobile auto-redirect for a user who
 * deliberately chose the desktop surface on their phone. Value '1' = opt out.
 */
export const FORCE_DESKTOP_COOKIE = 'serene-force-desktop';

export type MobileRoomKey = 'dashboard' | 'tasks' | 'budget' | 'activity';

export type MobileRoom = {
  key: MobileRoomKey;
  href: string;
  label: string;
  icon: LucideIcon;
};

/** The exactly-4 contract, enforced at the type level. */
export type MobileRoomSet = readonly [MobileRoom, MobileRoom, MobileRoom, MobileRoom];

const ADMIN_ROOMS: MobileRoomSet = [
  { key: 'dashboard', href: '/m', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'tasks', href: '/m/tasks', label: 'Tasks', icon: SquareCheckBig },
  { key: 'budget', href: '/m/budget', label: 'Budget', icon: Wallet },
  { key: 'activity', href: '/m/activity', label: 'Activity', icon: Clock },
];

/**
 * admin/founder rooms are built (Phase 0–4); manager and agent sets are
 * registered stubs — the same four is the v1 default, refined in later
 * phases (mobile-ops.md §4). guest falls back to the same shell.
 */
export const MOBILE_ROOMS_BY_ROLE: Record<UserRole, MobileRoomSet> = {
  founder: ADMIN_ROOMS,
  admin: ADMIN_ROOMS,
  manager: ADMIN_ROOMS,
  agent: ADMIN_ROOMS,
  guest: ADMIN_ROOMS,
};

export function getMobileRooms(role: UserRole): MobileRoomSet {
  return MOBILE_ROOMS_BY_ROLE[role] ?? ADMIN_ROOMS;
}

/**
 * Which Gia domains a caller can swipe through on the mobile rooms
 * (mobile-ops.md §5). Mobile scope is carousel state, not a URL param —
 * the resolveDomainParam posture, adapted: admin/founder page through
 * all four; a manager in a Gia domain is pinned to it (no swipe);
 * everyone else gets none (their room set is a later phase).
 */
export function getMobileDomains(role: UserRole, domain: AppDomain): GiaDomain[] {
  if (role === 'admin' || role === 'founder') return [...GIA_DOMAINS];
  if (role === 'manager' && isGiaDomain(domain)) return [domain];
  return [];
}

/**
 * Domain → presentation lookup for the mobile layer (mobile-ops.md §9).
 * Replaces the demo DEMO_VERTICALS as the tile/header vocabulary.
 * Icons reuse DOMAIN_ICONS (never re-map a domain→icon inline);
 * pastels are the mobile handoff mapping (powder/sage/butter/lilac -deep).
 */
export type DomainVertical = {
  domain: GiaDomain;
  label: string;
  icon: LucideIcon;
  /** icon colour on the surface-high tile — pastel -deep token */
  iconToken: string;
};

const DOMAIN_PASTEL_TOKENS: Record<GiaDomain, string> = {
  onboarding: 'var(--neu-powder-deep)',
  house: 'var(--neu-sage-deep)',
  shop: 'var(--neu-butter-deep)',
  legacy: 'var(--neu-lilac-deep)',
};

export const DOMAIN_VERTICALS: Record<GiaDomain, DomainVertical> = Object.fromEntries(
  GIA_DOMAINS.map((d) => [
    d,
    { domain: d, label: DOMAIN_LABELS[d], icon: DOMAIN_ICONS[d], iconToken: DOMAIN_PASTEL_TOKENS[d] },
  ]),
) as Record<GiaDomain, DomainVertical>;
