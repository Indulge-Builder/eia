import "server-only";

import type { cookies } from "next/headers";
import type { SearchParams } from "next/dist/server/request/search-params";
import {
  DOMAIN_COOKIE,
  parseGiaDomainParam,
  type GiaDomain,
} from "@/lib/constants/domains";
import { TOP_BAR_ENABLED } from "@/lib/constants/feature-flags";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/** Read the raw `domain` value out of resolved searchParams (string | string[]). */
function readDomainSearchParam(searchParams: Awaited<SearchParams>): string | null {
  const v = searchParams.domain;
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? null) : null;
}

/**
 * resolveDomainParam — THE single domain-scope resolver for the domain-aware
 * pages (leads / deals / campaigns). Replaces the per-page inline
 * `parseGiaDomainParam(getString('domain'))` + admin/founder branch + cookie
 * fallback. Cookie logic lives ONLY here — never inline a `serene-domain` read
 * in a page again.
 *
 * Returns:
 *   - admin / founder → the chosen Gia domain: `?domain=` param first, then the
 *     `serene-domain` cookie (the TopBar selector's cross-page memory), else
 *     `null` ("All" scope). The cookie is consulted only when TOP_BAR_ENABLED.
 *   - agent → `null` UNLESS the page opts in via `opts.allowAgentParam` (the
 *     /leads domain filter for cross-domain agents, 2026-08-07) — then the
 *     `?domain=` PARAM ONLY. The serene-domain cookie is never read for agents:
 *     that is the TopBar's admin/founder cross-page memory.
 *   - manager → ALWAYS `null` — force-scoped to `callerDomain` by the service.
 *
 * NOT a security boundary: the page parsers + service role-gates remain the
 * authority. A crafted `?domain=` can never widen an agent's scope — the
 * service composes it as an extra AND on top of `assigned_to = userId`.
 *
 * Synchronous: the caller passes the already-awaited searchParams + cookieStore
 * (`await cookies()`), so this does no awaiting itself.
 */
export function resolveDomainParam(
  searchParams: Awaited<SearchParams>,
  cookieStore: CookieStore,
  role: string,
  opts?: { allowAgentParam?: boolean },
): GiaDomain | null {
  // Agent: param-only narrowing, and only where the page opts in.
  if (role === "agent") {
    if (!opts?.allowAgentParam) return null;
    return parseGiaDomainParam(readDomainSearchParam(searchParams));
  }

  // Manager (and any other non-privileged role): scope is server-forced —
  // param and cookie are both ignored.
  if (role !== "admin" && role !== "founder") return null;

  const fromParam = parseGiaDomainParam(readDomainSearchParam(searchParams));
  if (fromParam) return fromParam;

  if (!TOP_BAR_ENABLED) return null;
  return parseGiaDomainParam(cookieStore.get(DOMAIN_COOKIE)?.value);
}
