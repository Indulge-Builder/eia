"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { updateProfile } from "@/lib/actions/profiles";
import { TabSelector } from "@/components/ui/TabSelector";
import {
  APPEARANCE_OPTIONS,
  applyAppearanceToDom,
  isAppearanceKey,
  persistAppearanceCookie,
  type AppearanceKey,
} from "@/lib/constants/appearance";

type Props = {
  currentAppearance: AppearanceKey;
  profileId:         string;
};

/**
 * Segmented Light · Dark · Auto control (dark-mode handoff §Mode switch) —
 * the ThemeSelector's sibling on the profile Appearance card. Applies the
 * mode to the DOM instantly (data-neu + meta theme-color via
 * applyAppearanceToDom), mirrors the serene-appearance cookie for the next
 * SSR paint, and persists profiles.appearance in the background through the
 * existing updateProfile action (no new persist action).
 */
export function AppearanceSelector({ currentAppearance, profileId }: Props) {
  const [active, setActive] = useState<AppearanceKey>(currentAppearance);
  const [isPending, startTransition] = useTransition();
  const dissolveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Never leave the dissolve class stranded on <html> if the page unmounts
  // mid-switch (the ThemeSelector convention).
  useEffect(() => {
    return () => {
      if (dissolveTimer.current) clearTimeout(dissolveTimer.current);
      document.documentElement.classList.remove("serene-theme-transition");
    };
  }, []);

  function handleChange(id: string) {
    if (!isAppearanceKey(id) || id === active) return;

    // 1. Cross-dissolve window while the material recolours (design-tokens
    //    §15) — the same mechanism a theme switch uses.
    const root = document.documentElement;
    root.classList.add("serene-theme-transition");
    if (dissolveTimer.current) clearTimeout(dissolveTimer.current);
    dissolveTimer.current = setTimeout(() => {
      root.classList.remove("serene-theme-transition");
    }, 400);

    // 2. DOM switch + SSR cookie mirror — instant, no reload.
    applyAppearanceToDom(id);
    persistAppearanceCookie(id);
    setActive(id);

    // 3. Persist to DB in the background via the existing updateProfile action.
    startTransition(async () => {
      const fd = new FormData();
      fd.append("id",         profileId);
      fd.append("appearance", id);
      await updateProfile({ data: null, error: null }, fd);
    });
  }

  return (
    <div>
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          gap:            "var(--space-4)",
          flexWrap:       "wrap",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize:   "var(--text-sm)",
            color:      "var(--theme-text-secondary)",
            margin:     0,
          }}
        >
          Light, warm-charcoal dark, or follow your device.
        </p>

        <TabSelector
          tabs={APPEARANCE_OPTIONS.map(({ id, label }) => ({ id, label }))}
          activeTab={active}
          onChange={handleChange}
          variant="connected"
          indicatorLayoutId="appearance-mode"
        />
      </div>

      {isPending && (
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize:   "var(--text-xs)",
            color:      "var(--theme-text-tertiary)",
            margin:     "var(--space-3) 0 0",
          }}
        >
          Saving preference…
        </p>
      )}
    </div>
  );
}
