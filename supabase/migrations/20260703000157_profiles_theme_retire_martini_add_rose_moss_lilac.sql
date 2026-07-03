-- Migration 0157: retire the 'martini' theme; register 'rose', 'moss', 'lilac'.
--
-- The neumorphic final revision (2026-07-03) locks the theme lineup at EIGHT:
-- earth / air / water / fire / candy / rose / moss / lilac — the SQL mirror of
-- THEME_KEYS in src/lib/constants/themes.ts (keep the two in sync). martini is
-- retired; its profiles migrate to lilac (the closest tone in the new lineup —
-- the design package's stated mapping), not to the earth default.
--
-- ORDER IS LOAD-BEARING: any profile still on martini must be moved BEFORE the
-- narrowed CHECK is added, or the ALTER fails. (0156 precedent.)
--
-- No RLS change — theme is a cosmetic self-update field under the existing
-- profiles_update policy (0001). App side: a retired value in a stale cookie
-- or unregenerated cache fails isThemeKey() and falls back to DEFAULT_THEME.

UPDATE public.profiles
  SET theme = 'lilac'
  WHERE theme = 'martini';

ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_theme_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_theme_check
  CHECK (theme IN ('earth', 'air', 'water', 'fire', 'candy', 'rose', 'moss', 'lilac'));
