import * as cheerio from "cheerio";
import type { MenuCategory, Restaurant } from "../../src/lib/types";
import type { ScrapeResult } from "../types";
import { cleanText, dollarsToCents, fetchText } from "../util";

/** Clover Online Ordering server-renders the full menu at /menu/all. */
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
  const url = r.orderUrl.includes("/menu/") ? r.orderUrl : `${r.orderUrl.replace(/\/$/, "")}/menu/all`;
  return parseCloverMenu(await fetchText(url));
}
