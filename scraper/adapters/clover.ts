import * as cheerio from "cheerio";
import type { MenuCategory, MenuItem, Restaurant } from "../../src/lib/types";
import type { ScrapeResult } from "../types";
import { cleanText, dollarsToCents, fetchJson, fetchText } from "../util";

// Clover's online ordering pages load the menu from this public JSON service.
const OLO = "https://www.clover.com/oloservice/v1/merchants";
const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

interface OloMerchant {
  merchantUuid: string;
  services?: { type: string; enabled?: boolean; hours?: Record<string, { start: string; end: string }[]> }[];
}

interface OloMenu {
  categories: Record<string, { id: string; name: string; sortOrder?: number; items: string[] }>;
  modifierGroups: Record<string, { id: string; name: string; minRequired?: number; maxAllowed?: number }>;
  modifiers: { id: string; name: string; price: number; groupId: string; sortOrder?: number; available?: boolean }[];
  items: {
    id: string;
    name: string;
    description?: string;
    price: number; // cents
    modifierGroupIds?: string[];
    available?: boolean;
    isAgeRestricted?: boolean; // alcohol
  }[];
}

/** "1630" -> minutes after midnight */
const hhmm = (t: string) => Math.floor(Number(t) / 100) * 60 + (Number(t) % 100);
const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * Turns Clover's weekly pickup hours into our schedule: days with no pickup
 * across the dinner hour are closed, and the earliest evening closing time
 * sets the last delivery slot (30 minutes before close, on a half hour).
 */
export function cloverSchedule(merchant: OloMerchant): Pick<ScrapeResult, "dinnerAvailable" | "closedDays" | "lastPickup"> {
  const pickup = merchant.services?.find((s) => s.type === "PICKUP" && s.enabled !== false);
  if (!pickup?.hours) return {};
  const closedDays: number[] = [];
  let earliestClose = Infinity;
  DAYS.forEach((day, i) => {
    const windows = (pickup.hours?.[day] ?? []).map((w) => ({ start: hhmm(w.start), end: hhmm(w.end) }));
    // Open for dinner if pickup runs from at least 5:30 PM to 6:30 PM.
    const dinner = windows.filter((w) => w.start <= 17 * 60 + 30 && w.end >= 18 * 60 + 30);
    if (!dinner.length) closedDays.push(i);
    else earliestClose = Math.min(earliestClose, Math.max(...dinner.map((w) => w.end)));
  });
  if (closedDays.length === 7) return { dinnerAvailable: false };
  const last = Math.floor((earliestClose - 30) / 30) * 30;
  return {
    dinnerAvailable: true,
    closedDays: closedDays.length ? closedDays : undefined,
    lastPickup: last < 20 * 60 + 30 ? clock(last) : undefined, // 8:30 PM is already our last slot
  };
}

export function parseCloverOlo(menu: OloMenu): MenuCategory[] {
  const items = new Map(menu.items.map((i) => [i.id, i]));
  const toItem = (id: string): MenuItem[] => {
    const item = items.get(id);
    if (!item || item.available === false || item.isAgeRestricted) return [];
    const optionGroups = (item.modifierGroupIds ?? []).flatMap((gid) => {
      const group = menu.modifierGroups[gid];
      if (!group) return [];
      const options = menu.modifiers
        .filter((m) => m.groupId === gid && m.available !== false)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
        .map((m) => ({ id: m.id, name: m.name.trim(), price: m.price }));
      const max = group.maxAllowed ?? 0;
      return [{ id: `${id}:${gid}`, name: group.name.trim(), min: group.minRequired ?? 0, max: max > 1000 ? 0 : max, options }];
    });
    return [
      {
        id,
        name: item.name.trim(),
        description: cleanText(item.description),
        price: item.price,
        optionGroups: optionGroups.length ? optionGroups : undefined,
      },
    ];
  };
  return Object.values(menu.categories)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((c) => ({ name: c.name.trim(), items: c.items.flatMap(toItem) }));
}

/** The merchant slug from clover.com/online-ordering/<slug> or <slug>.cloveronline.com. */
export function cloverSlug(orderUrl: string): string | undefined {
  const url = new URL(orderUrl);
  const path = url.pathname.match(/\/online-ordering\/([^/?#]+)/);
  if (path) return path[1];
  const host = url.hostname.match(/^([^.]+)\.cloveronline\.com$/);
  return host?.[1];
}

/** Older Clover sites server-render the menu at /menu/all; used if the JSON service fails. */
export function parseCloverMenu(html: string): ScrapeResult {
  const $ = cheerio.load(html);
  const categories: MenuCategory[] = [];
  $("h2[id$='-header']").each((_, h) => {
    const name = $(h).text().trim();
    const list = $(h).nextAll("ol, ul").first();
    const items = list
      .find("a[id^='item-card-']")
      .toArray()
      .flatMap((a) => {
        const card = $(a);
        const itemName = card.find("[data-testid='item-name']").first().text().trim() || card.text().trim();
        const priceText = card.find("[data-testid='product-price']").first().text().trim();
        if (!itemName || !/\$\d/.test(priceText)) return [];
        return [
          {
            id: (card.attr("id") ?? itemName).replace(/^item-card-/, ""),
            name: itemName,
            description: cleanText(card.find("[data-testid='product-description']").first().text()),
            price: dollarsToCents(priceText),
          },
        ];
      });
    if (name && items.length) categories.push({ name: name.charAt(0) + name.slice(1).toLowerCase(), items });
  });
  return { categories };
}

export async function scrapeClover(r: Restaurant): Promise<ScrapeResult> {
  const slug = cloverSlug(r.orderUrl);
  if (slug) {
    try {
      const merchant = await fetchJson<OloMerchant>(`${OLO}/${slug}?slug=true`);
      const menu = await fetchJson<OloMenu>(`${OLO}/${merchant.merchantUuid}/menu?orderType=PICKUP`);
      return { categories: parseCloverOlo(menu), ...cloverSchedule(merchant) };
    } catch (e) {
      if (!r.orderUrl.includes("cloveronline.com")) throw e;
    }
  }
  const url = r.orderUrl.includes("/menu/") ? r.orderUrl : `${r.orderUrl.replace(/\/$/, "")}/menu/all`;
  return parseCloverMenu(await fetchText(url));
}
