"use client";

import { useEffect, useLayoutEffect } from "react";
import { persistThemeCookie, type ThemeKey } from "@/lib/constants/themes";
import {
  applyAppearanceToDom,
  persistAppearanceCookie,
  type AppearanceKey,
} from "@/lib/constants/appearance";

type Props = { theme: ThemeKey; appearance: AppearanceKey };

/**
 * Corrective sync for the SSR theme + appearance cookies
 * (lib/constants/themes.ts / appearance.ts).
 * The root layout already stamps data-theme (and data-neu for 'dark'; an
 * inline pre-paint script resolves 'system') from the cookies on the server,
 * so the first paint is normally correct. This only flips the attributes when
 * a cookie was missing or stale vs the DB truth (new device, cleared cookies,
 * user switch) — and re-writes the cookies so the NEXT request server-renders
 * right from the first byte. It also owns the live prefers-color-scheme
 * listener while the 'system' appearance is active.
 */
export function ThemeInitializer({ theme, appearance }: Props) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (root.getAttribute("data-theme") !== theme) {
      root.setAttribute("data-theme", theme);
    }
    persistThemeCookie(theme);
  }, [theme]);

  useLayoutEffect(() => {
    applyAppearanceToDom(appearance);
    persistAppearanceCookie(appearance);
  }, [appearance]);

  // 'system': follow the OS live — re-apply on prefers-color-scheme flips.
  useEffect(() => {
    if (appearance !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyAppearanceToDom("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [appearance]);

  return null;
}
