import type { MenuCategory, MenuItem, MenuOptionGroup, Restaurant } from "../../src/lib/types";
import type { ScrapeResult } from "../types";
import { cleanText, dollarsToCents, fetchJson } from "../util";

// Square Online (editmysite.com) storefront API, as used by the public order page.
const API = "https://cdn5.editmysite.com/app/store/api/v28/editor";

interface SqCategory {
  id: string;
  name: string;
  product_counts?: { direct?: number };
  children?: SqCategory[] | { data?: SqCategory[] };
}

interface SqProduct {
  id: string;
  name: string;
  short_description?: string;
  visibility?: string;
  categoryIds?: string[];
  badges?: { out_of_stock?: boolean };
  price: { low_subunits: number; high_subunits: number };
}

interface SqModifierSet {
  id: string;
  name: string;
  min_selected_modifiers?: number | null;
  max_selected_modifiers?: number | null;
  hidden_from_customer?: boolean;
  choices: { id: string; name: string; price: number; hidden?: boolean }[];
}

interface SqVariation {
  id: string;
  name?: string;
  price?: { regular_subunits?: number; low_subunits?: number; subunits?: number } | number;
}

function children(c: SqCategory): SqCategory[] {
  return Array.isArray(c.children) ? c.children : (c.children?.data ?? []);
}

/** Leaf categories in display order. */
function leafCategories(tree: SqCategory[]): SqCategory[] {
  return tree.flatMap((c) => (children(c).length ? leafCategories(children(c)) : [c]));
}

function variationCents(v: SqVariation): number | undefined {
  if (typeof v.price === "number") return dollarsToCents(v.price);
  return v.price?.regular_subunits ?? v.price?.low_subunits ?? v.price?.subunits;
}

export async function scrapeSquare(r: Restaurant): Promise<ScrapeResult> {
  const { userId, siteId, locationId } = r.platformConfig ?? {};
  if (!userId || !siteId || !locationId) throw new Error("square needs platformConfig userId, siteId, locationId");
  const base = `${API}/users/${userId}/sites/${siteId}/store-locations/${locationId}`;

  const cats = await fetchJson<{ data: SqCategory[] }>(
    `${base}/categories?max_depth=3&nested=1&product_counts_fulfillments[]=pickup`,
  );
  const all: SqProduct[] = [];
  for (let page = 1; page <= 20; page++) {
    // The API caps per_page at 200.
    const res = await fetchJson<{ data: SqProduct[]; meta?: { pagination?: { total_pages?: number } } }>(
      `${base}/products?page=${page}&per_page=200&fulfillments[]=pickup`,
    );
    all.push(...res.data);
    if (page >= (res.meta?.pagination?.total_pages ?? 1)) break;
  }
  const products = all.filter((p) => p.visibility !== "hidden" && !p.badges?.out_of_stock);

  // Modifiers and variations only come with the per-product endpoint.
  const details = new Map<string, { modifiers: SqModifierSet[]; variations: SqVariation[] }>();
  const queue = [...products];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let p = queue.shift(); p; p = queue.shift()) {
        const d = await fetchJson<{ data: { modifiers?: { data?: SqModifierSet[] }; variations?: { data?: SqVariation[] } } }>(
          `${base}/products/${p.id}?include=variations,modifiers`,
        );
        details.set(p.id, { modifiers: d.data.modifiers?.data ?? [], variations: d.data.variations?.data ?? [] });
      }
    }),
  );

  const toItem = (p: SqProduct): MenuItem => {
    const detail = details.get(p.id);
    const groups: MenuOptionGroup[] = [];
    let price = p.price.low_subunits;
    const variations = (detail?.variations ?? []).filter((v) => variationCents(v) !== undefined);
    if (variations.length > 1) {
      price = Math.min(...variations.map((v) => variationCents(v)!));
      groups.push({
        id: `${p.id}:variation`,
        name: "Choose one",
        min: 1,
        max: 1,
        options: variations.map((v) => ({ id: v.id, name: v.name ?? "Option", price: variationCents(v)! - price })),
      });
    }
    for (const m of detail?.modifiers ?? []) {
      if (m.hidden_from_customer) continue;
      groups.push({
        id: `${p.id}:${m.id}`,
        name: m.name,
        // Some shops label a group "(Optional)" but leave Square's minimum at 1.
        min: /optional/i.test(m.name) ? 0 : Math.max(0, m.min_selected_modifiers ?? 0),
        max: Math.max(0, m.max_selected_modifiers ?? 0),
        options: m.choices.filter((c) => !c.hidden).map((c) => ({ id: c.id, name: c.name, price: dollarsToCents(c.price) })),
      });
    }
    return {
      id: p.id,
      name: p.name,
      description: cleanText(p.short_description),
      price,
      optionGroups: groups.length ? groups : undefined,
    };
  };

  const categories: MenuCategory[] = leafCategories(cats.data).map((c) => ({
    name: c.name.replace(/^\d+\.\s*/, ""),
    items: products.filter((p) => p.categoryIds?.includes(c.id)).map(toItem),
  }));
  const placed = new Set(categories.flatMap((c) => c.items.map((i) => i.id)));
  const other = products.filter((p) => !placed.has(p.id));
  if (other.length) categories.push({ name: "More", items: other.map(toItem) });
  return { categories };
}
