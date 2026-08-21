import "server-only";

import { headers } from "next/headers";

/**
 * Server-side mobile-browser detection for the /dashboard → /m auto-redirect
 * (mobile-ops). A blunt User-Agent test is acceptable here because the
 * consequence of a wrong guess is only WHICH fully-functional surface loads
 * (both /dashboard and /m are complete for admin/founder), never an access
 * decision — authorization always reads public.profiles (Rule 09), never the UA.
 *
 * Phones + small Android tablets match; iPad (desktop-class Safari that reports
 * "Macintosh") deliberately does NOT — a founder on an iPad keeps the roomy
 * desktop dashboard. Tune the predicate here, never re-inline a UA test.
 */
export async function isMobileUserAgent(): Promise<boolean> {
  const ua = (await headers()).get("user-agent") ?? "";
  // Exclude iPad explicitly (modern iPadOS Safari sends a desktop UA anyway,
  // but older versions send "iPad" — keep them on desktop).
  if (/iPad/i.test(ua)) return false;
  return /Android.*Mobile|iPhone|iPod|Windows Phone|BlackBerry|Opera Mini|IEMobile/i.test(ua);
}
