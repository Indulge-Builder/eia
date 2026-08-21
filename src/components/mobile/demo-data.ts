import { Plane, Home, ShoppingBag, Landmark, type LucideIcon } from 'lucide-react';

/**
 * Specimen content for the Indulge client-app mobile surface
 * (design_handoff_mobile_system/Serene Mobile.dc.html §06 Screens).
 * The client app has no backend yet — these are the high-fidelity
 * reference values the screens compose. Copy follows the butler
 * voice: requests never tasks, no exclamation marks, no emoji.
 */

export type RequestStatus = 'settled' | 'waiting' | 'attention';

export type DemoVerticalKey = 'global' | 'house' | 'shop' | 'legacy';

export type DemoVertical = {
  key: DemoVerticalKey;
  label: string;
  /** icon colour on the surface-high tile — pastel -deep token */
  iconToken: string;
  icon: LucideIcon;
  micro: string;
  drawerCount?: number;
};

/** Vertical → pastel mapping (README: Global powder · House sage · Shop butter · Legacy lilac). */
export const DEMO_VERTICALS: DemoVertical[] = [
  { key: 'global', label: 'Global', iconToken: 'var(--neu-powder-deep)', icon: Plane,       micro: '2 in motion', drawerCount: 2 },
  { key: 'house',  label: 'House',  iconToken: 'var(--neu-sage-deep)',   icon: Home,        micro: '1 needs you', drawerCount: 1 },
  { key: 'shop',   label: 'Shop',   iconToken: 'var(--neu-butter-deep)', icon: ShoppingBag, micro: '1 in motion', drawerCount: 1 },
  { key: 'legacy', label: 'Legacy', iconToken: 'var(--neu-lilac-deep)',  icon: Landmark,    micro: 'quiet' },
];

export type DemoRequest = {
  ref: string;
  vertical: DemoVerticalKey;
  title: string;
  sub: string;
  status: RequestStatus;
};

export const DEMO_REQUESTS: DemoRequest[] = [
  {
    ref: 'glb-4217',
    vertical: 'global',
    title: 'Gulfstream — Nice → Riyadh',
    sub: 'Wheels up Friday 09:00',
    status: 'settled',
  },
  {
    ref: 'shp-1108',
    vertical: 'shop',
    title: 'Patek 5711 — authentication',
    sub: 'Quote received · awaiting your word',
    status: 'waiting',
  },
  {
    ref: 'hse-0473',
    vertical: 'house',
    title: 'Villa Como — interior consult',
    sub: 'Needs attention · date conflict',
    status: 'attention',
  },
];

export type DemoThreadStep = {
  label: string;
  micro: string;
  state: 'done' | 'current';
};

/** THE THREAD — butler-voice timeline for GLB-4217. */
export const DEMO_THREAD: DemoThreadStep[] = [
  { label: 'Received',          micro: 'Tuesday 21:02 — noted, Arfam',       state: 'done' },
  { label: 'Options presented', micro: 'Wednesday 10:15 — three aircraft',   state: 'done' },
  { label: 'Confirmed',         micro: 'Wednesday 18:40 — your word taken',  state: 'done' },
  { label: 'Wheels up',         micro: 'Friday 09:00 — cars follow on arrival', state: 'current' },
];

export type DemoChatMessage = {
  from: 'elaya' | 'user';
  text: string;
};

export const DEMO_CHAT: DemoChatMessage[] = [
  {
    from: 'elaya',
    text: 'Good evening, Arfam. The Gulfstream is confirmed for Friday — wheels up at 09:00. Shall I arrange the cars in Riyadh?',
  },
  { from: 'user', text: 'Yes — two, please. One ahead for the luggage.' },
  {
    from: 'elaya',
    text: 'Consider it done. Two S-Classes, the first departing forty minutes ahead. Anything for the return leg?',
  },
];

export const DEMO_CHAT_SUGGESTIONS = ['Return Sunday', 'Add catering', 'Not yet'];

export const DEMO_PERSONA = {
  name: 'Arfam Alam',
  email: 'arfam@indulge.global',
  initials: 'AA',
  greeting: 'Good evening, Arfam',
  dateLabel: 'THURSDAY 9 JULY',
  motionLine: 'Three requests are in motion.',
};

export const DEMO_CONCIERGE = {
  name: 'Sara Mehta',
  role: 'Senior concierge — attending',
  initials: 'SM',
};
