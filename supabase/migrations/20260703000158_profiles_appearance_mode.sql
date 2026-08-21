-- Migration 0158: profiles.appearance — the light/dark mode preference.
--
-- The dark-mode handoff (design_handoff_dark_mode, 2026-07-03) adds a
-- three-state appearance preference: 'light' | 'dark' | 'system'
-- ('system' follows prefers-color-scheme; UI label "Auto"). The SQL mirror
-- of APPEARANCE_KEYS in src/lib/constants/appearance.ts — keep in sync.
--
-- Mirrors profiles.theme end-to-end: cosmetic self-update field under the
-- existing profiles_update policy (0001), persisted via the existing
-- updateProfile action, mirrored in the serene-appearance cookie for SSR
-- (the root layout stamps data-neu="dark" on <html> from the first byte).
-- Default 'light' — the shipped cream material stays the baseline.
--
-- No RLS change. A retired/invalid value in a stale cookie or unregenerated
-- cache fails isAppearanceKey() and falls back to DEFAULT_APPEARANCE.

ALTER TABLE public.profiles
  ADD COLUMN appearance text NOT NULL DEFAULT 'light'
  CONSTRAINT profiles_appearance_check
  CHECK (appearance IN ('light', 'dark', 'system'));
