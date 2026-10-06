import fs from "node:fs";
import path from "node:path";
import type { Page } from "playwright";
import type { MenuCategory, Restaurant } from "../../src/lib/types";
import { captureJson, type Captured } from "../browser";
import { extractMenuFromJson } from "../extract";
import type { ScrapeResult } from "../types";
import { cleanText } from "../util";

/** Saves raw API captures so parsers can be tuned (uploaded as a CI artifact). */
function dumpDebug(slug: string, captured: Captured[], html?: string) {
  const dir = process.env.SCRAPE_DEBUG_DIR;
  if (!dir) return;
  const out = path.join(dir, slug);
  fs.mkdirSync(out, { recursive: true });
  captured.forEach((c, i) => fs.writeFileSync(path.join(out, `${i}.json`), JSON.stringify({ url: c.url, body: c.body })));
  if (html) fs.writeFileSync(path.join(out, "page.html"), html);
}

function requireMenu(slug: string, captured: Captured[], categories: MenuCategory[], html?: string): ScrapeResult {
  dumpDebug(slug, captured, html);
  if (!categories.some((c) => c.items.length)) {
    throw new Error(`No menu found in ${captured.length} API responses`);
  }
  return { categories };
}

// ---------------------------------------------------------------- menu.app

interface MenuAppProduct {
  id: string;
  name: string;
  description?: string;
  price: number; // cents
  in_stock?: boolean;
  show_in_menu?: boolean;
  state?: number;
}

export function parseMenuAppCategories(body: unknown): MenuCategory[] {
  const cats = (body as { data?: { categories?: { name: string; state?: number; products?: MenuAppProduct[] }[] } })?.data
    ?.categories;
  return (cats ?? [])
    .filter((c) => c.state !== 0)
    .map((c) => ({
      name: c.name,
      items: (c.products ?? [])
        .filter((p) => p.show_in_menu !== false && p.in_stock !== false && p.state !== 0 && Number.isInteger(p.price))
        .map((p) => ({ id: p.id, name: p.name, description: cleanText(p.description), price: p.price })),
    }));
}

/** menu.app (used by Life Alive). The order page calls a public JSON API. */
export async function scrapeMenuApp(r: Restaurant): Promise<ScrapeResult> {
  const { captured } = await captureJson(r.orderUrl, /api[-\w.]*\.menu\.app\/api\/v2\/venues\/.+\/categories/);
  const api = captured.filter((c) => c.url.includes("menu.app/"));
  return requireMenu(r.slug, captured, parseMenuAppCategories(api.at(-1)?.body));
}

// ---------------------------------------------------------------- Toast

/** Toast online ordering: menus arrive from its GraphQL gateway. */
export async function scrapeToast(r: Restaurant): Promise<ScrapeResult> {
  // Capture every JSON response: the menu query's endpoint has moved before.
  const { captured, html } = await captureJson(r.orderUrl, /./, { waitMs: 10_000 });
  return requireMenu(r.slug, captured, extractMenuFromJson(captured.map((c) => c.body)), html);
}

// ---------------------------------------------------------------- ChowNow

function addressMatches(text: string, r: Restaurant): boolean {
  const street = r.platformConfig?.addressMatch ?? r.address;
  const norm = (s: string) => s.toLowerCase().replace(/\bstreet\b/g, "st").replace(/[^a-z0-9]/g, "");
  return norm(text).includes(norm(street));
}

/** Finds the ChowNow location id whose address matches the restaurant. */
function chownowLocationId(captured: Captured[], r: Restaurant): string | undefined {
  if (r.platformConfig?.locationId) return r.platformConfig.locationId;
  let found: string | undefined;
  const visit = (v: unknown) => {
    if (found || !v || typeof v !== "object") return;
    if (Array.isArray(v)) return v.forEach(visit);
    const o = v as Record<string, unknown>;
    if ((typeof o.id === "string" || typeof o.id === "number") && o.address && addressMatches(JSON.stringify(o.address), r)) {
      found = String(o.id);
      return;
    }
    Object.values(o).forEach(visit);
  };
  captured.forEach((c) => visit(c.body));
  return found;
}

const CHOWNOW = "https://order.chownow.com/order";
const CHOWNOW_API = /chownow\.com\/api\//;

export async function scrapeChowNow(r: Restaurant): Promise<ScrapeResult> {
  const company = r.platformConfig?.companyId ?? r.orderUrl.match(/\/order\/(\d+)/)?.[1];
  if (!company) throw new Error("chownow needs platformConfig.companyId");
  let locationId = r.platformConfig?.locationId ?? r.orderUrl.match(/\/locations\/(\d+)/)?.[1];
  let captured: Captured[] = [];
  let html: string | undefined;
  if (!locationId) {
    const locationsPage = await captureJson(`${CHOWNOW}/${company}/locations`, CHOWNOW_API);
    captured = locationsPage.captured;
    html = locationsPage.html;
    // Single-location companies redirect straight to the menu.
    locationId = locationsPage.finalUrl.match(/\/locations\/(\d+)/)?.[1] ?? chownowLocationId(captured, r);
    if (!locationId) {
      dumpDebug(r.slug, captured, html);
      throw new Error(`No ChowNow location matching "${r.address}"; set platformConfig.locationId`);
    }
  }
  const menuPage = await captureJson(`${CHOWNOW}/${company}/locations/${locationId}`, CHOWNOW_API);
  captured = [...captured, ...menuPage.captured];
  const menus = menuPage.captured.filter((c) => /menu/i.test(c.url));
  return requireMenu(
    r.slug,
    captured,
    extractMenuFromJson((menus.length ? menus : menuPage.captured).map((c) => c.body)),
    menuPage.html,
  );
}

// ---------------------------------------------------------------- DoorDash Storefront (order.online)

async function pickStore(page: Page, r: Restaurant) {
  if (/\/store\//.test(page.url())) return;
  // Business pages list several stores; open the one at this restaurant's address.
  const match = r.platformConfig?.storeMatch ?? r.address;
  const links = page.locator("a[href*='/store/']");
  const count = await links.count();
  for (let i = 0; i < count; i++) {
    const text = (await links.nth(i).innerText().catch(() => "")) ?? "";
    if (addressMatches(text, { ...r, platformConfig: { addressMatch: match } }) || count === 1) {
      await links.nth(i).click();
      await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
      return;
    }
  }
}

export async function scrapeDoorDash(r: Restaurant): Promise<ScrapeResult> {
  const { captured, finalUrl, html } = await captureJson(r.orderUrl, /./, {
    waitMs: 10_000,
    interact: (page) => pickStore(page, r),
  });
  if (!/\/store\//.test(finalUrl)) {
    dumpDebug(r.slug, captured, html);
    throw new Error(`Couldn't find the ${r.address} store on ${r.orderUrl}`);
  }
  return requireMenu(r.slug, captured, extractMenuFromJson(captured.map((c) => c.body)), html);
}

// ---------------------------------------------------------------- any other ordering site

/** Ordering sites without a dedicated adapter: capture all JSON and embedded page data. */
export async function scrapeWeb(r: Restaurant): Promise<ScrapeResult> {
  const { captured, html } = await captureJson(r.orderUrl, /./, { waitMs: 10_000 });
  return requireMenu(r.slug, captured, extractMenuFromJson(captured.map((c) => c.body)), html);
}
