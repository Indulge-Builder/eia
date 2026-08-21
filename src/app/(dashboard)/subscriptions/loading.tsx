import {
  PageHeaderSkeleton,
  FilterBarSkeleton,
  Shimmer,
  skeletonStagger,
} from "@/components/ui/PageSkeletons";

export default function SubscriptionsLoading() {
  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8">
      <PageHeaderSkeleton titleWidth={180} actionWidth={150} />

      {/* View switcher */}
      <div style={{ marginBottom: "var(--space-6)" }}>
        <Shimmer w={220} h={36} r="var(--radius-xl)" />
      </div>

      <FilterBarSkeleton chips={[110, 80, 90]} />

      {/* Table */}
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
    </main>
  );
}
