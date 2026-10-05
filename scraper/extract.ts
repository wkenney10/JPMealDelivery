/**
 * Schema-agnostic menu extraction from captured JSON API responses.
 *
 * Toast, ChowNow and DoorDash Storefront all return menus as nested JSON with
 * roughly the same shape: named categories holding arrays of named items with a
 * price, sometimes with modifier groups. Rather than depend on each platform's
 * exact (undocumented, frequently changing) schema, we look for that shape.
 */
import type { MenuCategory, MenuItem, MenuOption, MenuOptionGroup } from "../src/lib/types";
import { cleanText } from "./util";

type Obj = Record<string, unknown>;

const NAME_KEYS = ["name", "displayName", "title", "label"];
const ITEM_ARRAY_KEYS = ["items", "menuItems", "products", "dishes", "itemList", "entities"];
const PRICE_KEYS = ["price", "basePrice", "unitPrice", "displayPrice", "amount", "priceMonetaryFields", "prices"];
const ID_KEYS = ["guid", "id", "itemGuid", "uuid", "itemId", "masterId"];
const DESC_KEYS = ["description", "desc", "displayDescription"];
const GROUP_KEYS = ["modifierGroups", "optionGroups", "modifier_categories", "modifiers", "optionLists", "options"];
const OPTION_ARRAY_KEYS = ["modifiers", "options", "items", "choices", "modifierOptions"];
const MIN_KEYS = ["minSelections", "min", "min_qty", "minSelected", "minNumOptions", "minimum"];
const MAX_KEYS = ["maxSelections", "max", "max_qty", "maxSelected", "maxNumOptions", "maximum"];

const isObj = (v: unknown): v is Obj => !!v && typeof v === "object" && !Array.isArray(v);

function first<T>(o: Obj, keys: string[], pick: (v: unknown) => T | undefined): T | undefined {
  for (const k of keys) {
    if (k in o) {
      const v = pick(o[k]);
      if (v !== undefined) return v;
    }
  }
  return undefined;
}

const asString = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const asId = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : undefined);
const asArray = (v: unknown) => (Array.isArray(v) ? v : undefined);
const asInt = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.floor(v) : undefined);

interface RawPrice {
  value: number;
  unit: "dollars" | "cents" | "unknown";
}

function readPrice(v: unknown, key = ""): RawPrice | undefined {
  if (typeof v === "number" && Number.isFinite(v)) {
    if (/cent|subunit|unitAmount/i.test(key)) return { value: v, unit: "cents" };
    return { value: v, unit: Number.isInteger(v) ? "unknown" : "dollars" };
  }
  if (typeof v === "string") {
    const m = v.match(/^\s*\+?\$?\s*(\d+(?:\.\d{1,2})?)\s*$/);
    if (m) return { value: Number(m[1]), unit: v.includes("$") || v.includes(".") ? "dollars" : "unknown" };
    return undefined;
  }
  if (isObj(v)) {
    for (const k of ["unitAmount", "amount", "value", "cents", "price", "displayString"]) {
      if (k in v) {
        const p = readPrice(v[k], k);
        if (p) return p;
      }
    }
  }
  if (Array.isArray(v) && v.length) return readPrice(v[0], key);
  return undefined;
}

function priceOf(o: Obj): RawPrice | undefined {
  for (const k of PRICE_KEYS) {
    if (k in o && o[k] !== null) {
      const p = readPrice(o[k], k);
      if (p) return p;
    }
  }
  return undefined;
}

interface RawItem {
  item: Omit<MenuItem, "price" | "optionGroups"> & { price: RawPrice };
  groups: { group: Omit<MenuOptionGroup, "options">; options: { option: Omit<MenuOption, "price">; price: RawPrice }[] }[];
}

function readGroups(o: Obj, itemId: string): RawItem["groups"] {
  const arr = first(o, GROUP_KEYS, asArray);
  if (!arr) return [];
  const groups: RawItem["groups"] = [];
  arr.forEach((g, gi) => {
    if (!isObj(g)) return;
    const name = first(g, NAME_KEYS, asString);
    const optionsRaw = first(g, OPTION_ARRAY_KEYS, asArray);
    if (!name || !optionsRaw) return;
    const options = optionsRaw.flatMap((opt, oi) => {
      if (!isObj(opt)) return [];
      const optName = first(opt, NAME_KEYS, asString);
      if (!optName) return [];
      const price = priceOf(opt) ?? { value: 0, unit: "unknown" as const };
      const id = first(opt, ID_KEYS, asId) ?? `${itemId}-g${gi}-o${oi}`;
      return [{ option: { id: `${id}`, name: optName }, price }];
    });
    if (!options.length) return;
    const groupId = first(g, ID_KEYS, asId) ?? `${itemId}-g${gi}`;
    groups.push({
      group: {
        id: `${itemId}:${groupId}`,
        name,
        min: first(g, MIN_KEYS, asInt) ?? 0,
        max: first(g, MAX_KEYS, asInt) ?? 0,
      },
      options,
    });
  });
  return groups;
}

function readItem(v: unknown, fallbackId: string): RawItem | undefined {
  if (!isObj(v)) return undefined;
  const name = first(v, NAME_KEYS, asString);
  const price = priceOf(v);
  if (!name || !price) return undefined;
  const id = first(v, ID_KEYS, asId) ?? fallbackId;
  return {
    item: { id, name, description: cleanText(first(v, DESC_KEYS, asString)), price },
    groups: readGroups(v, id),
  };
}

interface RawCategory {
  name: string;
  items: RawItem[];
}

/** Recursively finds every {name, items:[{name, price}]} structure. */
function findCategories(root: unknown): RawCategory[] {
  const found: RawCategory[] = [];
  const seen = new WeakSet<object>();
  const visit = (v: unknown, depth: number) => {
    if (depth > 40 || !v || typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) {
      v.forEach((x) => visit(x, depth + 1));
      return;
    }
    const o = v as Obj;
    const name = first(o, NAME_KEYS, asString);
    const arr = first(o, ITEM_ARRAY_KEYS, asArray);
    if (name && arr) {
      const items = arr.map((x, i) => readItem(x, `${name}-${i}`)).filter((x): x is RawItem => !!x);
      if (items.length && items.length >= arr.length / 2) found.push({ name, items });
    }
    for (const child of Object.values(o)) visit(child, depth + 1);
  };
  visit(root, 0);
  return found;
}

/**
 * Integer prices are ambiguous (12 dollars or 12 cents?). Menus priced in cents
 * have a median well above 100; menus in whole dollars rarely exceed 100.
 */
function centsResolver(prices: RawPrice[]): (p: RawPrice) => number {
  const unknown = prices.filter((p) => p.unit === "unknown" && p.value > 0).map((p) => p.value).sort((a, b) => a - b);
  const median = unknown.length ? unknown[Math.floor(unknown.length / 2)] : 0;
  const unknownIsCents = median >= 150;
  return (p) =>
    p.unit === "cents" || (p.unit === "unknown" && unknownIsCents) ? Math.round(p.value) : Math.round(p.value * 100);
}

export function extractMenuFromJson(payloads: unknown[]): MenuCategory[] {
  const categories = payloads.flatMap(findCategories);
  // Nested structures (menu > group > subgroup) are found at every level; keep
  // the innermost categories by dropping any whose items all appear elsewhere
  // in a smaller category with the same items.
  const byItemSet = new Map<string, RawCategory>();
  for (const c of categories) {
    const key = c.items.map((i) => i.item.id).sort().join("|");
    const existing = byItemSet.get(key);
    if (!existing || existing.name.length > c.name.length) byItemSet.set(key, c);
  }
  const unique = [...byItemSet.values()];
  const allPrices = unique.flatMap((c) => c.items.flatMap((i) => [i.item.price, ...i.groups.flatMap((g) => g.options.map((o) => o.price))]));
  const toCents = centsResolver(allPrices);

  return unique.map((c) => ({
    name: c.name,
    items: c.items.map(({ item, groups }) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: toCents(item.price),
      optionGroups: groups.map(({ group, options }) => ({
        ...group,
        options: options.map(({ option, price }) => ({ ...option, price: toCents(price) })),
      })),
    })),
  }));
}
