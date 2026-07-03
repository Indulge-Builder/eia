import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { buildManifest } from "@/app/manifest";
import { DEFAULT_ICON, isIconKey } from "@/lib/constants/app-icons";
import {
  APPEARANCE_COOKIE,
  DEFAULT_APPEARANCE,
  isAppearanceKey,
} from "@/lib/constants/appearance";

// THE per-icon dynamic Web App Manifest. The root layout points
// <link rel="manifest"> here (?icon=<saved>) for a signed-in device, and the
// install prompt swaps the same link to the in-the-moment pick before calling
// prompt() — so the icon that installs into the homescreen shortcut is the
// user's choice, not the static default.
//
// NOT a data API (P-02): this produces static JSON for the PWA surface, the
// dynamic twin of app/manifest.ts. No DB, no session, no business logic — it is
// fetched by the browser outside any auth context (the proxy matcher excludes
// /api/manifest, same as manifest.webmanifest/sw.js/icons). Sanctioned PWA
// carve-out, like the Elaya SSE route is the sanctioned streaming carve-out.
//
// FAILURE MODE GUARD: the `icon` param is fully attacker-controlled. It is
// validated against ICON_KEYS via isIconKey before use; an unknown value
// collapses to DEFAULT_ICON. buildManifest → iconSrc only ever emits
// `/<known-key>.webp` — a raw param can never become an arbitrary `src` path.
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("icon");
  const icon = isIconKey(raw) ? raw : DEFAULT_ICON;

  // Appearance mirrors the dark-mode canvas into background/theme_color
  // (#ECE8E1 ↔ #28241C). Same validated-cookie posture as app/manifest.ts;
  // a credential-less manifest fetch simply falls back to the light default.
  const cookieAppearance = (await cookies()).get(APPEARANCE_COOKIE)?.value;
  const appearance = isAppearanceKey(cookieAppearance)
    ? cookieAppearance
    : DEFAULT_APPEARANCE;

  return NextResponse.json(buildManifest(icon, appearance), {
    headers: {
      "Content-Type": "application/manifest+json",
      // Per-user, per-icon — never shared across users by a CDN. The install
      // flow also rewrites the link to a fresh ?icon= each time it changes.
      "Cache-Control": "private, no-store",
    },
  });
}
