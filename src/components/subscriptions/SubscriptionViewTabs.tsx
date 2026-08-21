"use client";

// List / Calendar / Overview view switcher for /subscriptions. Writes ?view= while
// preserving the other params. Reads the active view from the URL.

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { TabSelector } from "@/components/ui/TabSelector";

const VIEWS = [
  { id: "list", label: "List" },
  { id: "calendar", label: "Calendar" },
  { id: "overview", label: "Overview" },
];

export function SubscriptionViewTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const current = params.get("view") ?? "list";

  function onChange(id: string) {
    if (id === current) return;
    const next = new URLSearchParams(params.toString());
    if (id === "list") next.delete("view");
    else next.set("view", id);
    const qs = next.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <TabSelector
      variant="pill"
      indicatorLayoutId="subscriptions-view"
      tabs={VIEWS}
      activeTab={current}
      onChange={onChange}
    />
  );
}
