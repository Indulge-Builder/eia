/**
 * One-time (re-runnable) icon builder for the PWA home-screen icons.
 *
 * The source art (public/_icon-originals/icon-N.webp) is the umber→gold
 * seed-of-life glyph on a TRANSPARENT background. A transparent home-screen
 * icon gets filled with whatever plate the OS picks (white on iOS) — which
 * looked wrong. Each icon is the glyph composited centred on a SOLID cream
 * plate (#ECE8E1 — NEU_CANVAS_LIGHT, the same --neu-canvas the boot screen
 * sits on), so the OS splash screen (manifest background + icon) reads as the
 * boot screen's own canvas and the two loading moments merge into one.
 * (The previous plate was the legacy Earth #0d0c0a black — it made the OS
 * splash look like a separate pitch-black screen; retired 2026-07-10.)
 *
 * For each chosen icon we trim the source's transparent margin, resize the
 * glyph to GLYPH_RATIO of the canvas, and composite it on the plate. The
 * output has NO transparency — that is what keeps the manifest's `maskable`
 * entry valid (Android crops a circle/squircle; corners are cream, never
 * transparent). NEVER re-add maskable if the art reverts to transparency.
 *
 * Besides the four /public/icon-N.webp picks this also emits, from the
 * DEFAULT icon (icon-1):
 *   - src/app/apple-icon.png            (static apple-touch-icon fallback)
 *   - public/icons/icon-192.png / -512  (sw.js push icon + offline shell)
 * Bump CACHE_VERSION in public/sw.js after re-running (the SW precaches
 * /icons/icon-192.png).
 *
 *   node scripts/pad-app-icons.mjs
 *
 * Resolves sharp from Next's dependency (already installed) — no new package.
 */
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const nextDir = dirname(require.resolve("next/package.json"));
const sharp = require(require.resolve("sharp", { paths: [nextDir] }));

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = join(ROOT, "public", "_icon-originals");
const OUT_DIR = join(ROOT, "public");

const SIZE = 1254;          // final square edge (matches icon-2/3/4 source)
const GLYPH_RATIO = 0.82;   // art occupies 82% → large, like the original icon-512
// NEU_CANVAS_LIGHT #ECE8E1 (lib/constants/appearance.ts) — the boot screen canvas.
const PLATE = { r: 0xec, g: 0xe8, b: 0xe1, alpha: 1 };
const KEYS = ["icon-1", "icon-2", "icon-3", "icon-4"];
const DEFAULT_KEY = "icon-1"; // mirrors DEFAULT_ICON in lib/constants/app-icons.ts

const inner = Math.round(SIZE * GLYPH_RATIO);
const pad = Math.round((SIZE - inner) / 2);

async function buildPlated(key) {
  const srcPath = join(SRC_DIR, `${key}.webp`);

  // Trim any transparent margin so GLYPH_RATIO applies to the actual artwork,
  // then resize the glyph to the inner box (contain, transparent fill so the
  // glyph's own alpha is preserved before it lands on the plate).
  const glyph = await sharp(srcPath)
    .trim()
    .resize(inner, inner, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .toBuffer();

  // Composite the glyph onto the SOLID cream plate — no transparency in the
  // output, so the OS shows the brand canvas plate, never its own fill.
  return sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: PLATE },
  })
    .composite([{ input: glyph, top: pad, left: pad }])
    .flatten({ background: PLATE })
    .png()
    .toBuffer();
}

for (const key of KEYS) {
  const plated = await buildPlated(key);
  const outPath = join(OUT_DIR, `${key}.webp`);
  await sharp(plated).webp({ quality: 92 }).toFile(outPath);
  console.log(`built ${key}.webp → ${SIZE}×${SIZE} on #ECE8E1, glyph ${inner}px (inset ${pad}px)`);
}

// Derived assets from the default icon — apple-touch fallback + SW push/offline PNGs.
const base = await buildPlated(DEFAULT_KEY);
const derived = [
  { out: join(ROOT, "src", "app", "apple-icon.png"), size: 180 },
  { out: join(OUT_DIR, "icons", "icon-192.png"), size: 192 },
  { out: join(OUT_DIR, "icons", "icon-512.png"), size: 512 },
];
for (const { out, size } of derived) {
  await sharp(base).resize(size, size).png().toFile(out);
  console.log(`built ${out.replace(ROOT + "/", "")} → ${size}×${size}`);
}

console.log("done. Remember: bump CACHE_VERSION in public/sw.js.");
