import { DELIVERY_FEE_PER_RESTAURANT, MEALS_TAX_RATE } from "./config";
import type { CartLine, Menu, MenuItem, Restaurant } from "./types";

export interface PricedLine {
  key: string;
  itemId: string;
  name: string;
  options: string[]; // human-readable selected options
  optionIds: string[];
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  notes?: string;
}

export interface RestaurantQuote {
  restaurant: Pick<Restaurant, "slug" | "name" | "orderUrl">;
  lines: PricedLine[];
  subtotal: number;
  tax: number;
  serviceFee: number;
  deliveryFee: number;
  total: number;
}

export interface Quote {
  restaurants: RestaurantQuote[];
  subtotal: number;
  tax: number;
  serviceFee: number;
  deliveryFee: number;
  total: number;
  errors: string[]; // lines that could not be priced (item gone, bad options, ...)
}

export const MAX_QUANTITY = 50;

export function findItem(menu: Menu, itemId: string): MenuItem | undefined {
  for (const c of menu.categories) {
    const item = c.items.find((i) => i.id === itemId);
    if (item) return item;
  }
  return undefined;
}

/** Validates the selected options for an item and returns the unit price, or an error message. */
export function priceItem(
  item: MenuItem,
  optionIds: string[],
): { unitPrice: number; options: string[] } | { error: string } {
  const remaining = new Set(optionIds);
  if (remaining.size !== optionIds.length) return { error: `Duplicate option on ${item.name}.` };
  let unitPrice = item.price;
  const labels: string[] = [];
  for (const group of item.optionGroups ?? []) {
    const chosen = group.options.filter((o) => remaining.has(o.id));
    if (chosen.length < group.min) return { error: `Choose ${group.name.toLowerCase()} for ${item.name}.` };
    if (group.max > 0 && chosen.length > group.max) {
      return { error: `Too many choices for ${group.name.toLowerCase()} on ${item.name}.` };
    }
    for (const o of chosen) {
      remaining.delete(o.id);
      unitPrice += o.price;
      labels.push(o.name);
    }
  }
  if (remaining.size) return { error: `${item.name} has options that are no longer offered.` };
  return { unitPrice, options: labels };
}

export function serviceFeeFor(r: Pick<Restaurant, "fees">, subtotal: number): number {
  const pct = r.fees?.serviceFeePercent ?? 0;
  const flat = r.fees?.serviceFeeFlat ?? 0;
  return Math.round((subtotal * pct) / 100) + (subtotal > 0 ? flat : 0);
}

/**
 * Prices a cart against the current menus. Restaurant charges (food, meals tax,
 * any platform service fee) mirror a direct takeout order; on top of that we add
 * one flat delivery fee per restaurant.
 */
export function quoteCart(
  lines: CartLine[],
  getRestaurant: (slug: string) => Restaurant | undefined,
  getMenu: (slug: string) => Menu | undefined,
): Quote {
  const errors: string[] = [];
  const groups = new Map<string, RestaurantQuote>();

  for (const line of lines) {
    const restaurant = getRestaurant(line.restaurant);
    const menu = getMenu(line.restaurant);
    if (!restaurant || !restaurant.active || !menu) {
      errors.push(`A restaurant in your cart is no longer available.`);
      continue;
    }
    const item = findItem(menu, line.itemId);
    if (!item) {
      errors.push(`An item from ${restaurant.name} is no longer on the menu.`);
      continue;
    }
    const qty = Math.floor(line.quantity);
    if (!(qty >= 1 && qty <= MAX_QUANTITY)) {
      errors.push(`Invalid quantity for ${item.name}.`);
      continue;
    }
    const priced = priceItem(item, line.optionIds ?? []);
    if ("error" in priced) {
      errors.push(priced.error);
      continue;
    }
    let group = groups.get(restaurant.slug);
    if (!group) {
      group = {
        restaurant: { slug: restaurant.slug, name: restaurant.name, orderUrl: restaurant.orderUrl },
        lines: [],
        subtotal: 0,
        tax: 0,
        serviceFee: 0,
        deliveryFee: 0,
        total: 0,
      };
      groups.set(restaurant.slug, group);
    }
    group.lines.push({
      key: line.key,
      itemId: item.id,
      name: item.name,
      options: priced.options,
      optionIds: line.optionIds ?? [],
      quantity: qty,
      unitPrice: priced.unitPrice,
      lineTotal: priced.unitPrice * qty,
      notes: line.notes?.trim() || undefined,
    });
  }

  const restaurants = [...groups.values()];
  for (const g of restaurants) {
    const r = getRestaurant(g.restaurant.slug)!;
    g.subtotal = g.lines.reduce((s, l) => s + l.lineTotal, 0);
    g.tax = Math.round(g.subtotal * MEALS_TAX_RATE);
    g.serviceFee = serviceFeeFor(r, g.subtotal);
    g.deliveryFee = DELIVERY_FEE_PER_RESTAURANT;
    g.total = g.subtotal + g.tax + g.serviceFee + g.deliveryFee;
  }

  const sum = (f: (g: RestaurantQuote) => number) => restaurants.reduce((s, g) => s + f(g), 0);
  return {
    restaurants,
    subtotal: sum((g) => g.subtotal),
    tax: sum((g) => g.tax),
    serviceFee: sum((g) => g.serviceFee),
    deliveryFee: sum((g) => g.deliveryFee),
    total: sum((g) => g.total),
    errors,
  };
}

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
