"use client";

// Spending overview — INR outflow analytics. All figures are the manually-entered
// INR paid (never a currency conversion). Recharts is code-split per the perf rule
// (non-dashboard consumers dynamic-import the chart wrappers at the call site).

import dynamic from "next/dynamic";
import type { CSSProperties } from "react";
import { TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChartSkeleton } from "@/components/ui/charts/ChartSkeleton";
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/numbers";
import { SUBSCRIPTION_TYPE_LABELS } from "@/lib/constants/subscription-constants";
import { DOMAIN_LABELS } from "@/lib/constants/domains";
import type { SpendingOverview as SpendingOverviewData } from "@/lib/services/subscriptions-service";

const DonutChart = dynamic(
  () => import("@/components/ui/charts/DonutChart").then((m) => m.DonutChart),
  { ssr: false, loading: () => <ChartSkeleton height={240} /> },
);
const BarChart = dynamic(() => import("@/components/ui/charts/BarChart").then((m) => m.BarChart), {
  ssr: false,
  loading: () => <ChartSkeleton height={240} />,
});

export function SpendingOverview({ data }: { data: SpendingOverviewData }) {
  const hasData = data.yearToDateInr > 0 || data.monthlyTrend.some((m) => m.inr > 0);

  const typeData = data.byType.map((t) => ({
    label: SUBSCRIPTION_TYPE_LABELS[t.type],
    value: t.inr,
  }));
  const deptData = data.byDepartment.map((d) => ({
    label: DOMAIN_LABELS[d.domain],
    value: d.inr,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* Stat cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        <StatCard label="Spent This Month" value={formatCurrency(data.monthToDateInr, "INR")} />
        <StatCard label="Spent This Year" value={formatCurrency(data.yearToDateInr, "INR")} />
        <StatCard label="Active Subscriptions" value={String(data.activeCount)} />
      </div>

      {!hasData ? (
        <EmptyState
          icon={TrendingUp}
          title="No spending recorded yet"
          description="Record a payment or top-up and your spending analytics will appear here."
          framed
        />
      ) : (
        <>
          {/* Breakdowns */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "var(--space-6)",
            }}
          >
            <ChartCard title="By Billing Type">
              {typeData.length > 0 ? (
                <DonutChart data={typeData} height={240} />
              ) : (
                <EmptyState variant="inline" title="No data yet." />
              )}
            </ChartCard>
            <ChartCard title="By Department">
              {deptData.length > 0 ? (
                <DonutChart data={deptData} height={240} />
              ) : (
                <EmptyState variant="inline" title="No data yet." />
              )}
            </ChartCard>
          </div>

          {/* Trend */}
          <ChartCard title="Monthly Spend (last 12 months)">
            <BarChart
              data={data.monthlyTrend as unknown as Record<string, unknown>[]}
              series={[{ key: "inr", label: "INR Spend" }]}
              xKey="label"
              height={260}
              yAxisProps={{ tickFormatter: (v: number) => formatCurrencyCompact(Number(v), "INR") }}
              tooltipProps={{
                formatter: (v: unknown) => [formatCurrency(Number(v), "INR"), "Spend"],
              }}
            />
          </ChartCard>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={cardStyle}>
      <p className="label-micro" style={{ margin: "0 0 var(--space-2)" }}>
        {label}
      </p>
      <p
        style={{
          margin: 0,
          fontSize: "var(--text-2xl)",
          fontWeight: "var(--weight-semibold)",
          color: "var(--theme-text-primary)",
          fontFamily: "var(--font-sans)",
        }}
      >
        {value}
      </p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={cardStyle}>
      <h3
        style={{
          margin: "0 0 var(--space-4)",
          fontFamily: "var(--font-serif)",
          fontSize: "var(--text-base)",
          fontWeight: "var(--weight-normal)",
          color: "var(--theme-text-primary)",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--theme-paper)",
  border: "1px solid var(--theme-paper-border)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow-1)",
  padding: "var(--space-5)",
};
