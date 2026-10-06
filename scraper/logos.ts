/**
 * Finds each restaurant's logo and converts it to a single-ink "printed" mark
 * that the app tints to match the menu-board design.
 *
 *   npm run logos                    # all restaurants without a logo yet
 *   npm run logos -- --all           # redo every restaurant
 *   npm run logos -- tonino casa-verde
 *
 * Output: public/logos/<slug>.png (black ink on transparent) and data/logos.json.
 * Per-restaurant tweaks live in data/restaurants.json under "logo":
 *   { "url": "...", "threshold": 0.3, "invert": true, "mode": "original", "disabled": true }
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import sharp from "sharp";
import type { Restaurant } from "../src/lib/types";
import { cloverSlug } from "./adapters/clover";
import { parseSliceState } from "./adapters/slice";
import { USER_AGENT, fetchJson, fetchText } from "./util";

const DATA = path.join(process.cwd(), "data");
const OUT_DIR = path.join(process.cwd(), "public", "logos");
const INDEX = path.join(DATA, "logos.json");

export interface LogoEntry {
  file: string; // public path
  width: number;
  height: number;
  mode: "ink" | "original";
  source: string;
  updatedAt: string;
}

// ---------------------------------------------------------------- discovery

const absolute = (src: string, base: string) => {
  try {
    return new URL(src, base).toString();
  } catch {
    return undefined;
  }
};

/** Logo candidates from a restaurant's own website, best first. */
export function logoCandidatesFromHtml(html: string, base: string): string[] {
  const $ = cheerio.load(html);
  const out: string[] = [];
  const push = (src?: string) => {
    const url = src && absolute(src.trim(), base);
    if (url && !/\.ico(\?|$)/i.test(url) && !url.startsWith("data:") && !out.includes(url)) out.push(url);
  };
  // <img> tags that say they are the logo, header ones first.
  const imgs = $("img").toArray();
  const isLogo = (el: (typeof imgs)[number]) =>
    /logo/i.test([$(el).attr("src"), $(el).attr("alt"), $(el).attr("class"), $(el).attr("id"), $(el).parent().attr("class")].join(" "));
  const srcOf = (el: (typeof imgs)[number]) =>
    $(el).attr("data-src") || $(el).attr("data-image") || $(el).attr("src") || $(el).attr("srcset")?.split(/[\s,]+/)[0];
  imgs.filter((el) => isLogo(el) && $(el).closest("header, nav, [class*=header]").length).forEach((el) => push(srcOf(el)));
  imgs.filter(isLogo).forEach((el) => push(srcOf(el)));
  // Site builders (Squarespace, Wix, ...) often mark the header logo by position, not name.
  $(".header-title-logo img, [class*=site-title] img, [class*=brand] img, header a[href='/'] img, header img")
    .toArray()
    .slice(0, 3)
    .forEach((el) => push(srcOf(el as (typeof imgs)[number])));
  push($('meta[property="og:logo"]').attr("content"));
  push($('link[rel="apple-touch-icon"]').attr("href"));
  return out;
}

async function candidates(r: Restaurant): Promise<string[]> {
  const urls: string[] = [];
  if (r.logo?.url) return [r.logo.url];
  if (r.platform === "slice") {
    try {
      const state = parseSliceState(await fetchText(r.orderUrl)) as unknown as {
        shop: { shops: Record<string, { value?: { logo?: string } }> };
      };
      const logo = Object.values(state.shop.shops)[0]?.value?.logo;
      if (logo) urls.push(logo);
    } catch {
      // Fall through to the website.
    }
  }
  if (r.platform === "clover") {
    try {
      const slug = cloverSlug(r.orderUrl);
      const merchant = await fetchJson<{ logo?: string }>(`https://www.clover.com/oloservice/v1/merchants/${slug}?slug=true`);
      if (merchant.logo) urls.push(merchant.logo);
    } catch {
      // Fall through to the website.
    }
  }
  if (r.website) {
    try {
      urls.push(...logoCandidatesFromHtml(await fetchText(r.website), r.website));
    } catch {
      // Site unreachable.
    }
  }
  return urls;
}

// ---------------------------------------------------------------- processing

interface Options {
  threshold?: number;
  invert?: boolean;
}

const luminance = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

/**
 * Converts any logo image to black ink on a transparent background.
 * - Transparent logos: every opaque pixel is ink, except near-white details
 *   (or, with `invert`, near-black ones) which become paper.
 * - Logos on a solid background: ink is how far each pixel's colour is from
 *   the background colour, so light-on-dark logos work too.
 * Returns undefined when the result doesn't look like a logo (blank or a photo).
 */
export async function toInk(input: Buffer, opts: Options = {}): Promise<{ png: Buffer; width: number; height: number; coverage: number } | undefined> {
  const { data, info } = await sharp(input, { density: 300 })
    .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const px = (i: number) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]] as const;

  // Background: the typical colour along the border.
  const border: number[] = [];
  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 0; y < height; y++) border.push(y * width, y * width + width - 1);
  const transparentBorder = border.filter((i) => px(i)[3] < 32).length > border.length * 0.6;
  const opaque = border.filter((i) => px(i)[3] >= 32).map(px);
  const median = (k: 0 | 1 | 2) => opaque.map((p) => p[k]).sort((a, b) => a - b)[Math.floor(opaque.length / 2)] ?? 255;
  const bg = [median(0), median(1), median(2)];

  const threshold = opts.threshold ?? 0.25;
  const n = width * height;
  const ink = new Float32Array(n);

  if (transparentBorder) {
    // Light pixels (dark with `invert`) are paper only when enclosed by the mark,
    // like letter counters; light strokes that touch the outside are part of it.
    const light = (i: number) => {
      const [r, g, b] = px(i);
      const lum = luminance(r, g, b);
      return opts.invert ? lum < 0.15 : lum > 0.88;
    };
    const outside = new Uint8Array(n);
    const queue: number[] = [];
    for (let i = 0; i < n; i++) if (px(i)[3] < 32) {
      outside[i] = 1;
      queue.push(i);
    }
    while (queue.length) {
      const i = queue.pop()!;
      const x = i % width;
      for (const j of [i - width, i + width, x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1]) {
        if (j >= 0 && j < n && !outside[j] && light(j)) {
          outside[j] = 1;
          queue.push(j);
        }
      }
    }
    for (let i = 0; i < n; i++) {
      const a = px(i)[3];
      if (a < 32 || (light(i) && !outside[i])) continue;
      // Boost partial transparency so faint strokes still print solid.
      ink[i] = Math.min(1, ((a / 255) * 1.8) ** 0.8);
    }
  } else {
    for (let i = 0; i < n; i++) {
      const [r, g, b, a] = px(i);
      const dist = Math.hypot(r - bg[0], g - bg[1], b - bg[2]) / 441.7;
      // Soft threshold keeps anti-aliased edges smooth.
      ink[i] = Math.min(1, Math.max(0, (dist - threshold * 0.6) / (threshold * 0.8))) * (a / 255);
    }
  }

  // A solid badge (lettering on a coloured disc or tile): print the badge and
  // knock the lettering out, like a rubber stamp.
  const badge = findBadge(data, width, height, ink);
  if (badge) {
    for (let i = 0; i < n; i++) {
      const [r, g, b] = px(i);
      if (ink[i] > 0 && Math.hypot(r - badge[0], g - badge[1], b - badge[2]) / 441.7 > 0.2) ink[i] = 0;
    }
  }

  const alpha = Buffer.alloc(n);
  let inked = 0;
  for (let i = 0; i < n; i++) {
    alpha[i] = Math.round(ink[i] * 255);
    if (alpha[i] > 128) inked++;
  }
  const coverage = inked / (width * height);

  // Crop to the inked area.
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (alpha[y * width + x] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
  if (maxX < 0) return undefined;
  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  const cropCoverage = inked / (cropW * cropH);
  // A real logo is neither a speck nor a solid block (photos end up as blocks).
  if (cropW < 16 || cropH < 8 || coverage < 0.003 || cropCoverage > 0.85) return undefined;

  const rgba = Buffer.alloc(width * height * 4); // black ink, alpha = mask
  for (let i = 0; i < width * height; i++) rgba[i * 4 + 3] = alpha[i];
  const png = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract({ left: minX, top: minY, width: cropW, height: cropH })
    .resize({ height: 240, width: 720, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
  const meta = await sharp(png).metadata();
  return { png, width: meta.width!, height: meta.height!, coverage: cropCoverage };
}

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "user-agent": USER_AGENT }, signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * If the inked area is a solid shape (it fills most of its bounding box) and is
 * mostly one colour, with some other-coloured detail on it, returns that colour.
 */
function findBadge(data: Buffer, width: number, height: number, ink: Float32Array): [number, number, number] | undefined {
  const counts = new Map<string, { n: number; rgb: [number, number, number] }>();
  let total = 0;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (ink[p] < 0.5) continue;
      total++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const i = p * 4;
      // Bucket colours coarsely.
      const key = `${data[i] >> 5},${data[i + 1] >> 5},${data[i + 2] >> 5}`;
      const c = counts.get(key) ?? { n: 0, rgb: [data[i], data[i + 1], data[i + 2]] };
      c.n++;
      counts.set(key, c);
    }
  if (!total) return undefined;
  const fill = total / ((maxX - minX + 1) * (maxY - minY + 1));
  const top = [...counts.values()].sort((a, b) => b.n - a.n)[0];
  const share = top.n / total;
  return fill > 0.6 && share > 0.4 && share < 0.95 ? top.rgb : undefined;
}

// ---------------------------------------------------------------- main

async function processRestaurant(r: Restaurant): Promise<{ entry?: LogoEntry; note: string }> {
  if (r.logo?.disabled) return { note: "disabled" };
  const urls = await candidates(r);
  if (!urls.length) return { note: "no logo found" };
  for (const url of urls.slice(0, 6)) {
    try {
      const buf = await download(url);
      const file = path.join(OUT_DIR, `${r.slug}.png`);
      if (r.logo?.mode === "original") {
        const png = await sharp(buf, { density: 300 }).trim().resize({ height: 240, width: 720, fit: "inside", withoutEnlargement: true }).png().toBuffer();
        fs.writeFileSync(file, png);
        const meta = await sharp(png).metadata();
        return { entry: { file: `/logos/${r.slug}.png`, width: meta.width!, height: meta.height!, mode: "original", source: url, updatedAt: new Date().toISOString() }, note: `original from ${url}` };
      }
      const ink = await toInk(buf, r.logo);
      if (!ink) continue;
      fs.writeFileSync(file, ink.png);
      return {
        entry: { file: `/logos/${r.slug}.png`, width: ink.width, height: ink.height, mode: "ink", source: url, updatedAt: new Date().toISOString() },
        note: `ink from ${url}`,
      };
    } catch {
      // Try the next candidate.
    }
  }
  return { note: `no usable image among ${urls.length} candidates` };
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.filter((a) => !a.startsWith("-"));
  const all = args.includes("--all");
  const registry = JSON.parse(fs.readFileSync(path.join(DATA, "restaurants.json"), "utf8")) as { restaurants: Restaurant[] };
  const index: Record<string, LogoEntry> = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, "utf8")) : {};
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const targets = registry.restaurants.filter((r) =>
    only.length ? only.includes(r.slug) : r.active && (all || !index[r.slug]),
  );
  for (const r of targets) {
    const { entry, note } = await processRestaurant(r);
    if (entry) index[r.slug] = entry;
    else if (r.logo?.disabled) {
      delete index[r.slug];
      fs.rmSync(path.join(OUT_DIR, `${r.slug}.png`), { force: true });
    }
    console.log(`${entry ? "ok  " : "--  "} ${r.slug.padEnd(26)} ${note}`);
  }
  const sorted = Object.fromEntries(Object.entries(index).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(INDEX, JSON.stringify(sorted, null, 1) + "\n");
}

if (process.argv[1]?.endsWith("logos.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
