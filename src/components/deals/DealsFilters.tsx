'use client';

import { FilterBar } from '@/components/ui/FilterBar';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import {
  DEAL_TYPE_OPTIONS,
  DEAL_CATEGORY_OPTIONS,
  DOMAIN_DEAL_CONFIG,
} from '@/lib/constants/deal-types';
import type { UserRole } from '@/lib/types/database';
import type { Profile } from '@/lib/types/database';

type DealsFiltersProps = {
  role:             UserRole;
  showDomainFilter: boolean;
  showAgentFilter:  boolean;
  agents:           Pick<Profile, 'id' | 'full_name'>[];
};

const DEAL_TYPE_ITEMS = DEAL_TYPE_OPTIONS;
// Category vocabulary comes straight from DOMAIN_DEAL_CONFIG (the source of
// truth) — never a second hardcoded list. shop is the only category-bearing
// domain today; the filter surfaces when its domain slice is active.
const DEAL_CATEGORY_ITEMS = DEAL_CATEGORY_OPTIONS;
const CATEGORY_DOMAIN = 'shop' as const; // the domain whose deal_type carries categories

// Immediate-commit model: every change pushes the URL via useUrlFilters.
export function DealsFilters({
  role: _role,
  showDomainFilter,
  showAgentFilter,
  agents,
}: DealsFiltersProps) {
  const url = useUrlFilters({ resetKeys: ['page'] });
  const { params, push } = url;

  const dealTypeFilter = params.get('deal_type');
  const categoryFilter = params.get('deal_category');
  const agentFilter    = showAgentFilter ? params.get('agent_id') : null;
  const dateFrom       = params.get('date_from');
  const dateTo         = params.get('date_to');

  // The in-page Domain dropdown was removed (2026-07-10) — the global
  // DomainSelector now owns the `?domain=` param for admin/founder. We still
  // READ the param (never write, never count it) to decide whether the shop
  // slice is active, because the category filter only makes sense there (shop
  // is the sole category-bearing deal_type). The global domain is NOT one of
  // this bar's own filters, so it never enters `activeCount` or the Clear list.
  const globalDomain = showDomainFilter ? params.get('domain') : null;
  const showCategoryFilter =
    showDomainFilter &&
    globalDomain === CATEGORY_DOMAIN &&
    DOMAIN_DEAL_CONFIG[CATEGORY_DOMAIN].categories !== null;

  const activeCount =
    (params.get('search') ? 1 : 0) +
    (dealTypeFilter ? 1 : 0) +
    (showCategoryFilter && categoryFilter ? 1 : 0) +
    (agentFilter ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);

  const agentItems = agents.map((a) => ({ id: a.id, label: a.full_name }));

  return (
    <FilterBar
      searchValue={url.searchInput}
      onSearchChange={url.setSearchInput}
      searchPlaceholder="Search deals…"
      searchAriaLabel="Search deals"
      searchStyle={{ flex: '1 1 220px', minWidth: '180px' }}
      activeCount={activeCount}
      onClearAll={url.clearAll}
      dateRange={{
        panelKey:     'deals-range-panel',
        from:         dateFrom,
        to:           dateTo,
        // Setting an explicit date clears the "default to This Month" marker.
        onFromChange: (v) => push({ date_from: v, dates: null }),
        onToChange:   (v) => push({ date_to: v, dates: null }),
        // Clearing dates lands on the `dates=all` escape hatch so the page
        // doesn't re-default the range back to This Month (see deals/page.tsx).
        onClear:      () => push({ date_from: null, date_to: null, dates: 'all' }),
        onPresetSelect: (from, to) => push({ date_from: from, date_to: to, dates: null }),
      }}
    >
      {/* Deal type — single select */}
      <FilterDropdown
        label="Type"
        items={DEAL_TYPE_ITEMS}
        selected={dealTypeFilter ? [dealTypeFilter] : []}
        onChange={(next) => push({ deal_type: next[0] ?? null })}
        menuPortal
      />

      {/* Category — only inside the shop domain slice (retail product category) */}
      {showCategoryFilter && (
        <FilterDropdown
          label="Category"
          items={DEAL_CATEGORY_ITEMS}
          selected={categoryFilter ? [categoryFilter] : []}
          onChange={(next) => push({ deal_category: next[0] ?? null })}
          menuPortal
        />
      )}

      {/* Agent — manager/admin/founder only */}
      {showAgentFilter && (
        <FilterDropdown
          label="Agent"
          items={agentItems}
          selected={agentFilter ? [agentFilter] : []}
          onChange={(next) => push({ agent_id: next[0] ?? null })}
          menuPortal
        />
      )}
    </FilterBar>
  );
}
