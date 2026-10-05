import type { Menu, MenuCategory, MenuItem } from "./types";

/**
 * Sections we can't sell for dinner delivery:
 * - alcohol (delivering it needs a Massachusetts license we don't have)
 * - catering / party trays (need advance notice)
 * - breakfast and brunch (usually not served at dinner time)
 * - bag fees, gift cards, merchandise
 */
const EXCLUDED_CATEGORY =
  /\b(beers?|wines?|cocktails?|drafts?|spirits|liquor|bloody marys?|martinis?|margaritas?|cordials?|rum|scotch|whiske?y|bourbon|vodka|tequila|tequilia|(?<!(wellness|juice|health|espresso) )shots|sangria|mimosas?|soju|cosmopol\w*|happy hour|bar menu|catering|event platters?|party (trays?|platters?|packs?)|taquisa|breakfast|desayuno|brunch|gift cards?|retail|merch\w*|bags?)\b|^(hard )?seltzers?$/i;

/**
 * Alcoholic items inside otherwise fine sections. Spirit and wine words also
 * name food ("Vodka Parm", "Bourbon Chicken", "Wine-Braised Short Rib"), so
 * they only count inside drink sections; brand names count anywhere.
 */
const DRINK_SECTION = /\b(drinks?|beverages?|bebidas?|refrescos?|bar|specials?)\b/i;
const ALCOHOL_BRAND =
  /\b(guinness|heineken|corona (extra|light|premier)|modelo|budweiser|bud light|stella artois|sam adams|narragansett|allagash|white claw|truly|high noon|twisted tea|baileys|kahlua|jameson|hennessy|hennessey)\b/i;
const ALCOHOL_WORD = new RegExp(
  [
    String.raw`\b(ipa|lager|pilsner|stout|pinot|cabernet|chardonnay|sauvignon|merlot|malbec|riesling|prosecco|mimosa|sangria|bloody mary|mojito|negroni|whiske?y|vodka|tequila|bourbon|mezcal|gin|hard seltzer|hard cider|irish coffee|soju|pitcher)\b`,
    String.raw`(?<!ginger )\bale\b`,
    String.raw`(?<!(root|ginger) )\bbeers?\b`,
    String.raw`\bwines?\b`,
    String.raw`\bmargaritas?\b`,
    String.raw`\bmartinis?\b`,
    String.raw`\brum\b`,
  ].join("|"),
  "i",
);
const NON_ALCOHOLIC = /\b(virgin|virgen|non[- ]?alcoholic|alcohol[- ]free|mocktails?|zero[- ]proof|cola[- ]champagne)\b/i;

function isAlcoholicItem(item: MenuItem, section: MenuCategory): boolean {
  if (NON_ALCOHOLIC.test(item.name)) return false;
  return ALCOHOL_BRAND.test(item.name) || (DRINK_SECTION.test(section.name) && ALCOHOL_WORD.test(item.name));
}

const isExcludedCategory = (c: MenuCategory) => EXCLUDED_CATEGORY.test(c.name);

/**
 * Toast restaurants sometimes publish a second copy of their menu at higher
 * prices (for delivery apps), and the scrape picks up both. Copies show up as
 * a run of categories whose names repeat ones seen earlier. A copy is dropped
 * when its shared items cost consistently more than in the earlier menu.
 */
function dropMarkedUpCopies(categories: MenuCategory[]): MenuCategory[] {
  // Split the flat category list into menus wherever a category name repeats.
  const menus: MenuCategory[][] = [];
  let seen = new Set<string>();
  for (const c of categories) {
    const key = c.name.trim().toLowerCase();
    if (!menus.length || seen.has(key)) {
      menus.push([]);
      seen = new Set();
    }
    seen.add(key);
    menus[menus.length - 1].push(c);
  }
  if (menus.length < 2) return categories;

  const baseline = new Map<string, number>();
  const kept: MenuCategory[][] = [];
  for (const menu of menus) {
    const ratios: number[] = [];
    for (const item of menu.flatMap((c) => c.items)) {
      const base = baseline.get(item.name.toLowerCase());
      if (base && item.price > 0) ratios.push(item.price / base);
    }
    ratios.sort((a, b) => a - b);
    const median = ratios.length ? ratios[Math.floor(ratios.length / 2)] : 1;
    if (ratios.length >= 3 && median >= 1.1) continue; // a marked-up copy
    kept.push(menu);
    for (const item of menu.flatMap((c) => c.items)) {
      const key = item.name.toLowerCase();
      if (!baseline.has(key)) baseline.set(key, item.price);
    }
  }
  return kept.flat();
}

/** Merges sections with the same name and drops exact duplicate items. */
function mergeAndDedupe(categories: MenuCategory[]): MenuCategory[] {
  const byName = new Map<string, MenuCategory>();
  const seenItems = new Set<string>();
  for (const c of categories) {
    const key = c.name.trim().toLowerCase();
    const target = byName.get(key) ?? { name: c.name.trim(), items: [] };
    byName.set(key, target);
    for (const item of c.items) {
      const id = `${item.name.trim().toLowerCase()}|${item.price}`;
      if (seenItems.has(id)) continue;
      seenItems.add(id);
      target.items.push(item);
    }
  }
  return [...byName.values()].filter((c) => c.items.length);
}

/** The part of a scraped menu we can actually sell for dinner delivery. */
export function dinnerMenu(menu: Menu, hide: { hideSections?: string[]; hideItems?: string[] } = {}): Menu {
  const hiddenSections = new Set((hide.hideSections ?? []).map((n) => n.trim().toLowerCase()));
  const hiddenItems = new Set((hide.hideItems ?? []).map((n) => n.trim().toLowerCase()));
  let categories = dropMarkedUpCopies(menu.categories);
  categories = categories
    .filter((c) => !isExcludedCategory(c) && !hiddenSections.has(c.name.trim().toLowerCase()))
    .map((c) => ({
      ...c,
      items: c.items.filter((i) => !isAlcoholicItem(i, c) && !hiddenItems.has(i.name.trim().toLowerCase())),
    }));
  return { ...menu, categories: mergeAndDedupe(categories) };
}
