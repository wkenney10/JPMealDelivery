import fs from "node:fs";
import path from "node:path";
import type { Menu, Restaurant } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

function readJson<T>(file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return undefined;
  }
}

export function allRestaurants(): Restaurant[] {
  const registry = readJson<{ restaurants: Restaurant[] }>(path.join(DATA_DIR, "restaurants.json"));
  return registry?.restaurants ?? [];
}

export function getRestaurant(slug: string): Restaurant | undefined {
  return allRestaurants().find((r) => r.slug === slug);
}

const SLUG_RE = /^[a-z0-9-]+$/;

/**
 * The menu customers order from: the latest successful scrape, or the
 * hand-maintained fallback in data/menus-manual when there is no scrape.
 */
export function getMenu(slug: string): Menu | undefined {
  if (!SLUG_RE.test(slug)) return undefined;
  const scraped = readJson<Menu>(path.join(DATA_DIR, "menus", `${slug}.json`));
  if (scraped && scraped.categories.some((c) => c.items.length)) return scraped;
  const manual = readJson<Menu>(path.join(DATA_DIR, "menus-manual", `${slug}.json`));
  if (manual && manual.categories.some((c) => c.items.length)) return manual;
  return undefined;
}

/** Restaurants customers can order from right now: active, menu loaded, open for dinner. */
export function orderableRestaurants(): { restaurant: Restaurant; menu: Menu }[] {
  return allRestaurants()
    .filter((r) => r.active)
    .map((restaurant) => ({ restaurant, menu: getMenu(restaurant.slug) }))
    .filter((x): x is { restaurant: Restaurant; menu: Menu } => !!x.menu && x.menu.dinnerAvailable !== false)
    .sort((a, b) => a.restaurant.name.localeCompare(b.restaurant.name));
}

export interface ScrapeReportEntry {
  slug: string;
  status: "ok" | "unchanged" | "failed" | "skipped";
  checkedAt: string;
  lastSuccessAt?: string;
  itemCount?: number;
  changes?: string[];
  error?: string;
}

export function scrapeReport(): Record<string, ScrapeReportEntry> {
  return readJson<{ restaurants: Record<string, ScrapeReportEntry> }>(path.join(DATA_DIR, "scrape-report.json"))
    ?.restaurants ?? {};
}
