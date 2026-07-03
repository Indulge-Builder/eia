import { getDealsByRole, getDealsSummary } from '@/lib/services/deals-service';
import { DealCard } from '@/components/deals/DealCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { DealsSummaryStrip } from '@/components/deals/DealsSummaryStrip';
import { LeadsPagination } from '@/components/leads/LeadsPagination';
import type { UserRole, AppDomain, DealFilters } from '@/lib/types/database';

type DealsAsyncProps = {
  role:         UserRole;
  userId:       string;
  domain:       AppDomain;
  filters:      DealFilters;
  pageSize:     number;
};

export async function DealsAsync({
  role,
  userId,
  domain,
  filters,
  pageSize,
}: DealsAsyncProps) {
  const [{ deals, totalCount }, summary] = await Promise.all([
    getDealsByRole(role, userId, domain, filters),
    getDealsSummary(role, userId, domain, filters),
  ]);

  const page             = filters.page ?? 1;
  const hasActiveFilters =
    !!(filters.search || filters.domain || filters.deal_type || filters.agent_id || filters.date_from || filters.date_to);

  // Effective domain for the summary strip's type-count cells:
  //   admin/founder → filters.domain (their picked scope; null = all domains → both cells)
  //   manager/agent → their own profile domain (always single-domain → one cell)
  // resolveDomainParam returns null for manager/agent, so filters.domain alone
  // would wrongly show both cells for a domain-pinned manager.
  const summaryDomain = role === 'admin' || role === 'founder' ? filters.domain : domain;

  return (
    <>
      <DealsSummaryStrip summary={summary} domain={summaryDomain} />

      {deals.length === 0 ? (
        hasActiveFilters ? (
          <EmptyState
            variant="inline"
            size="lg"
            title="Nothing matches these filters."
            style={{ padding: 'var(--space-16) var(--space-8)' }}
          />
        ) : (
          // §08 brand empty — the mark rests here until the first win lands.
          <EmptyState
            brand
            title="The first win is still on its way."
            description="Deals you close will gather here — gold petals and all."
            minHeight="340px"
          />
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {deals.map((deal, i) => (
            <DealCard key={deal.id} deal={deal} index={i} />
          ))}
        </div>
      )}

      {totalCount > pageSize && (
        <LeadsPagination page={page} pageSize={pageSize} totalCount={totalCount} />
      )}
    </>
  );
}
