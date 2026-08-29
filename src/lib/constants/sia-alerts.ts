// Sia watcher-alarm routing (founder-specced 2026-08-29).
//
// Tier 1 — the tech responders: alerted the moment a condition fires, reminded
// every 10 minutes until resolved. A NAMED set, not a role: the responders are
// agents in the role model, and roles must never be bent for alert routing.
// Tier 2 — the founders (role 'founder'): join only after 1 unresolved hour.
//
// Editing the responder set = edit this list (ids are profiles.id — stable;
// names in comments for humans). A responder without a profile phone gets
// in-app + push only; the WhatsApp leg skips them with a warn.
export const SIA_ALERT_TIER1_PROFILE_IDS: readonly string[] = [
  "376a33f3-bc08-4a4f-b669-8cb6a8bc31b7", // Tech Wizard (the shared tech/admin account)
  "ffcd0f9e-e9d2-4ad6-b6c1-f8bd010c7b35", // Arfam
  "30ee109e-e209-46b7-953b-6519ddb94aeb", // Ethan Alvares
  "d46183ac-6549-454c-b002-f8ae61148087", // Manu Nataraju (no phone yet — WhatsApp skips until set)
];
