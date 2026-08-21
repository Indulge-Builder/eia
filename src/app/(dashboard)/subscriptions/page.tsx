import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { SearchParams } from "next/dist/server/request/search-params";
import { getCurrentProfile } from "@/lib/services/profiles-service";
import {
  getSubscriptions,
  getSpendingOverview,
} from "@/lib/services/subscriptions-service";
import { AddSubscriptionButton } from "@/components/subscriptions/AddSubscriptionButton";
import { SubscriptionExportButton } from "@/components/subscriptions/SubscriptionExportButton";
import { SubscriptionViewTabs } from "@/components/subscriptions/SubscriptionViewTabs";
import { SubscriptionFilters } from "@/components/subscriptions/SubscriptionFilters";
import { SubscriptionsTable } from "@/components/subscriptions/SubscriptionsTable";
import { SubscriptionCalendar } from "@/components/subscriptions/SubscriptionCalendar";
import { SpendingOverview } from "@/components/subscriptions/SpendingOverview";
import { Shimmer, skeletonStagger } from "@/components/ui/PageSkeletons";
import type { AppDomain } from "@/lib/types/database";
import type {
  SubscriptionType,
  SubscriptionStatus,
} from "@/lib/constants/subscription-constants";

function getStr(v: string | string[] | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? null : null;
}
function getMulti<T extends string>(v: string | string[] | undefined): T[] {
  const raw = getStr(v);
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean) as T[];
}

type ContentProps = {
  view: string;
  tab: "active" | "archived";
  departments: AppDomain[];
  types: SubscriptionType[];
  statuses: SubscriptionStatus[];
  search: string | null;
};

async function SubscriptionContent({ view, tab, departments, types, statuses, search }: ContentProps) {
  if (view === "overview") {
    const data = await getSpendingOverview();
    return <SpendingOverview data={data} />;
  }
  if (view === "calendar") {
    const subs = await getSubscriptions({ archived: false });
    return <SubscriptionCalendar subscriptions={subs} />;
  }
  const subs = await getSubscriptions({
    archived: tab === "archived",
    departments: departments.length ? departments : undefined,
    types: types.length ? types : undefined,
    statuses: statuses.length ? statuses : undefined,
    search: search ?? undefined,
  });
  return <SubscriptionsTable subscriptions={subs} archived={tab === "archived"} />;
}

function ContentSkeleton() {
  return (
    <div
      style={{
        border: "1px solid var(--theme-paper-border)",
        borderRadius: "var(--radius-md)",
        boxShadow: "var(--shadow-1)",
        background: "var(--theme-paper)",
        padding: "var(--space-4)",
      }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            padding: "var(--space-3) 0",
            borderBottom: i < 7 ? "1px solid var(--theme-paper-border)" : "none",
          }}
        >
          <Shimmer w={160} h={16} delay={skeletonStagger(i)} />
          <Shimmer w={120} h={16} delay={skeletonStagger(i)} />
          <div style={{ flex: 1 }} />
          <Shimmer w={72} h={20} r="var(--radius-full)" delay={skeletonStagger(i)} />
        </div>
      ))}
    </div>
  );
}

export default async function SubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const sp = await searchParams;
  const view = getStr(sp.view) ?? "list";
  const tab = getStr(sp.tab) === "archived" ? "archived" : "active";
  const departments = getMulti<AppDomain>(sp.department);
  const types = getMulti<SubscriptionType>(sp.type);
  const statuses = getMulti<SubscriptionStatus>(sp.status);
  const search = getStr(sp.search);

  const contentKey = JSON.stringify({ view, tab, departments, types, statuses, search });

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="type-page-title m-0">
          Subscriptions<span className="page-title-dot">.</span>
        </h1>
        <div className="flex items-center gap-3">
          <SubscriptionExportButton />
          <AddSubscriptionButton />
        </div>
      </div>

      {/* View switcher */}
      <div className="mb-6">
        <SubscriptionViewTabs />
      </div>

      {/* Filter bar (list view only) */}
      {view === "list" && (
        <div className="px-5 py-4 mb-4 rounded-md border border-(--theme-paper-border) bg-(--theme-paper) shadow-(--shadow-1)">
          <SubscriptionFilters />
        </div>
      )}

      <Suspense key={contentKey} fallback={<ContentSkeleton />}>
        <SubscriptionContent
          view={view}
          tab={tab}
          departments={departments}
          types={types}
          statuses={statuses}
          search={search}
        />
      </Suspense>
    </main>
  );
}
