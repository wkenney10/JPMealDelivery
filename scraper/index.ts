/**
 * Refreshes menus for every active restaurant in data/restaurants.json.
 *
 *   npm run scrape                      # all restaurants
 *   npm run scrape -- tonino same-old-place   # just these
 *   npm run scrape:local                # Toast/ChowNow/DoorDash only, visible Chrome
 *
 * Successful scrapes overwrite data/menus/<slug>.json (only when the content
 * changed). Failures leave the previous menu in place. Every run rewrites
 * data/scrape-report.json, which the admin "Menu status" page reads.
 */
import fs from "node:fs";
import path from "node:path";
import type { Menu, Platform, Restaurant } from "../src/lib/types";
import { scrapeChowNow, scrapeDoorDash, scrapeMenuApp, scrapeToast } from "./adapters/browser-platforms";
import { scrapeClover } from "./adapters/clover";
import { scrapeSlice } from "./adapters/slice";
import { scrapeSquare } from "./adapters/square";
import { closeBrowser } from "./browser";
import { diffMenus, sameMenu } from "./diff";
import type { ScrapeResult } from "./types";
import { tidyCategories } from "./util";

const DATA = path.join(process.cwd(), "data");
const MENUS = path.join(DATA, "menus");
const REPORT = path.join(DATA, "scrape-report.json");
const TIMEOUT_MS = 180_000;

const ADAPTERS: Partial<Record<Platform, (r: Restaurant) => Promise<ScrapeResult>>> = {
  slice: scrapeSlice,
  square: scrapeSquare,
  clover: scrapeClover,
  menuapp: scrapeMenuApp,
  toast: scrapeToast,
  chownow: scrapeChowNow,
  doordash: scrapeDoorDash,
};

interface ReportEntry {
  slug: string;
  status: "ok" | "unchanged" | "failed" | "skipped";
  checkedAt: string;
  lastSuccessAt?: string;
  itemCount?: number;
  changes?: string[];
  error?: string;
}

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms))]);
}

async function scrapeOne(r: Restaurant, previous?: ReportEntry): Promise<ReportEntry> {
  const now = new Date().toISOString();
  const adapter = ADAPTERS[r.platform];
  if (!adapter) return { slug: r.slug, status: "skipped", checkedAt: now, error: `No scraper for platform "${r.platform}"` };

  const file = path.join(MENUS, `${r.slug}.json`);
  const existing = readJson<Menu>(file);
  try {
    const result = await withTimeout(adapter(r), TIMEOUT_MS);
    const categories = tidyCategories(result.categories);
    const itemCount = categories.reduce((n, c) => n + c.items.length, 0);
    if (!itemCount) throw new Error("Scrape returned no items");
    // A sudden collapse usually means a broken parse, not a new menu.
    const oldCount = existing?.categories.reduce((n, c) => n + c.items.length, 0) ?? 0;
    if (oldCount >= 10 && itemCount < oldCount * 0.4) {
      throw new Error(`Only ${itemCount} items found (was ${oldCount}); keeping previous menu`);
    }
    const menu: Menu = {
      restaurant: r.slug,
      source: "scraped",
      platform: r.platform,
      sourceUrl: r.orderUrl,
      fetchedAt: now,
      dinnerAvailable: result.dinnerAvailable,
      categories,
    };
    if (sameMenu(existing, menu)) {
      // Keep the file untouched so unchanged menus don't create commits.
      return { slug: r.slug, status: "unchanged", checkedAt: now, lastSuccessAt: now, itemCount };
    }
    fs.writeFileSync(file, JSON.stringify(menu, null, 1) + "\n");
    return { slug: r.slug, status: "ok", checkedAt: now, lastSuccessAt: now, itemCount, changes: diffMenus(existing?.categories, categories) };
  } catch (e) {
    return {
      slug: r.slug,
      status: "failed",
      checkedAt: now,
      lastSuccessAt: previous?.lastSuccessAt,
      itemCount: previous?.itemCount,
      error: (e as Error).message.split("\n")[0].slice(0, 300),
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.filter((a) => !a.startsWith("-"));
  const platforms = args.find((a) => a.startsWith("--platforms="))?.slice("--platforms=".length).split(",");
  if (args.includes("--local")) {
    // Visible Google Chrome, so bot checks can be passed by hand if needed.
    process.env.HEADED = "1";
    process.env.USE_CHROME = "1";
  }
  const registry = readJson<{ restaurants: Restaurant[] }>(path.join(DATA, "restaurants.json"));
  if (!registry) throw new Error("data/restaurants.json missing");
  const targets = registry.restaurants.filter(
    (r) => (only.length ? only.includes(r.slug) : r.active) && (!platforms || platforms.includes(r.platform)),
  );
  fs.mkdirSync(MENUS, { recursive: true });

  const report = readJson<{ restaurants: Record<string, ReportEntry> }>(REPORT)?.restaurants ?? {};
  // Plain-HTTP platforms run in parallel; browser platforms share one Chromium serially.
  const browserPlatforms: Platform[] = ["toast", "chownow", "doordash", "menuapp"];
  const http = targets.filter((r) => !browserPlatforms.includes(r.platform));
  const browser = targets.filter((r) => browserPlatforms.includes(r.platform));

  const results: ReportEntry[] = [];
  const log = (e: ReportEntry) => {
    results.push(e);
    report[e.slug] = e;
    const detail = e.status === "failed" ? e.error : `${e.itemCount} items${e.changes?.length ? `, ${e.changes.length} changes` : ""}`;
    console.log(`${e.status.padEnd(9)} ${e.slug.padEnd(28)} ${detail ?? ""}`);
  };

  await Promise.all([
    (async () => {
      const queue = [...http];
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          for (let r = queue.shift(); r; r = queue.shift()) log(await scrapeOne(r, report[r.slug]));
        }),
      );
    })(),
    (async () => {
      for (const r of browser) log(await scrapeOne(r, report[r.slug]));
    })(),
  ]);
  await closeBrowser();

  const sorted = Object.fromEntries(Object.entries(report).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(REPORT, JSON.stringify({ generatedAt: new Date().toISOString(), restaurants: sorted }, null, 1) + "\n");

  const failed = results.filter((r) => r.status === "failed");
  const summary = [
    `## Menu refresh`,
    ``,
    `${results.length} checked · ${results.filter((r) => r.status === "ok").length} updated · ${results.filter((r) => r.status === "unchanged").length} unchanged · ${failed.length} failed`,
    ``,
    ...results
      .filter((r) => r.status === "ok" || r.status === "failed")
      .map((r) =>
        r.status === "failed"
          ? `- ❌ **${r.slug}**: ${r.error}`
          : `- ✅ **${r.slug}**: ${r.changes?.slice(0, 8).join("; ")}${(r.changes?.length ?? 0) > 8 ? "; …" : ""}`,
      ),
  ].join("\n");
  console.log(`\n${summary}`);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
