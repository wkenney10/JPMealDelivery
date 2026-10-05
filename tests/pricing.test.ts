import { describe, expect, it } from "vitest";
import { priceItem, quoteCart } from "../src/lib/pricing";
import type { CartLine, Menu, Restaurant } from "../src/lib/types";

const restaurant = (slug: string, extra: Partial<Restaurant> = {}): Restaurant => ({
  slug,
  name: slug.toUpperCase(),
  cuisine: "Test",
  address: "1 Centre St",
  zip: "02130",
  orderUrl: `https://example.com/${slug}`,
  platform: "manual",
  active: true,
  ...extra,
});

const menu = (slug: string): Menu => ({
  restaurant: slug,
  source: "manual",
  platform: "manual",
  sourceUrl: "",
  fetchedAt: "2026-10-01T00:00:00Z",
  categories: [
    {
      name: "Mains",
      items: [
        { id: "burrito", name: "Burrito", price: 1200 },
        {
          id: "pizza",
          name: "Pizza",
          price: 1199,
          optionGroups: [
            {
              id: "size",
              name: "Size",
              min: 1,
              max: 1,
              options: [
                { id: "small", name: "Small", price: 0 },
                { id: "large", name: "Large", price: 480 },
              ],
            },
            {
              id: "toppings",
              name: "Toppings",
              min: 0,
              max: 2,
              options: [
                { id: "pep", name: "Pepperoni", price: 150 },
                { id: "mush", name: "Mushroom", price: 100 },
                { id: "olive", name: "Olive", price: 100 },
              ],
            },
          ],
        },
      ],
    },
  ],
});

const restaurants: Record<string, Restaurant> = {
  a: restaurant("a"),
  b: restaurant("b"),
  c: restaurant("c", { fees: { serviceFeePercent: 3, serviceFeeFlat: 50 } }),
  closed: restaurant("closed", { active: false }),
};
const getRestaurant = (s: string) => restaurants[s];
const getMenu = (s: string) => (restaurants[s] ? menu(s) : undefined);

const line = (restaurantSlug: string, itemId: string, quantity = 1, optionIds: string[] = []): CartLine => ({
  key: `${restaurantSlug}-${itemId}-${optionIds.join(",")}`,
  restaurant: restaurantSlug,
  itemId,
  quantity,
  optionIds,
});

describe("delivery fee", () => {
  it("charges $5 for a single-restaurant order", () => {
    const q = quoteCart([line("a", "burrito", 2)], getRestaurant, getMenu);
    expect(q.deliveryFee).toBe(500);
    expect(q.restaurants).toHaveLength(1);
  });

  it("charges $5 per restaurant: 2 restaurants = $10, 3 = $15", () => {
    const two = quoteCart([line("a", "burrito"), line("b", "burrito"), line("a", "pizza", 1, ["small"])], getRestaurant, getMenu);
    expect(two.deliveryFee).toBe(1000);
    const three = quoteCart([line("a", "burrito"), line("b", "burrito"), line("c", "burrito")], getRestaurant, getMenu);
    expect(three.deliveryFee).toBe(1500);
  });
});

describe("restaurant charges", () => {
  it("adds 7% MA meals tax per restaurant, rounded to the cent", () => {
    const q = quoteCart([line("a", "pizza", 1, ["small"])], getRestaurant, getMenu);
    expect(q.subtotal).toBe(1199);
    expect(q.tax).toBe(84); // 83.93
    expect(q.total).toBe(1199 + 84 + 500);
  });

  it("adds the restaurant's own online-ordering service fee", () => {
    const q = quoteCart([line("c", "burrito", 2)], getRestaurant, getMenu);
    expect(q.serviceFee).toBe(Math.round(2400 * 0.03) + 50);
    expect(q.total).toBe(2400 + 168 + 122 + 500);
  });

  it("sums totals across restaurants", () => {
    const q = quoteCart([line("a", "burrito"), line("b", "pizza", 2, ["large", "pep"])], getRestaurant, getMenu);
    const b = q.restaurants.find((g) => g.restaurant.slug === "b")!;
    expect(b.subtotal).toBe(2 * (1199 + 480 + 150));
    expect(q.total).toBe(q.restaurants.reduce((s, g) => s + g.total, 0));
  });
});

describe("validation", () => {
  it("requires required options", () => {
    const item = menu("a").categories[0].items[1];
    expect(priceItem(item, [])).toHaveProperty("error");
    expect(priceItem(item, ["small", "large"])).toHaveProperty("error");
    expect(priceItem(item, ["small", "pep", "mush", "olive"])).toHaveProperty("error");
    expect(priceItem(item, ["large", "mush"])).toEqual({ unitPrice: 1199 + 480 + 100, options: ["Large", "Mushroom"] });
  });

  it("rejects options that don't belong to the item", () => {
    expect(priceItem(menu("a").categories[0].items[0], ["large"])).toHaveProperty("error");
  });

  it("reports removed items and inactive restaurants instead of pricing them", () => {
    const q = quoteCart([line("a", "gone"), line("closed", "burrito"), line("a", "burrito")], getRestaurant, getMenu);
    expect(q.errors).toHaveLength(2);
    expect(q.restaurants).toHaveLength(1);
  });

  it("rejects bad quantities", () => {
    expect(quoteCart([line("a", "burrito", 0)], getRestaurant, getMenu).errors).toHaveLength(1);
    expect(quoteCart([line("a", "burrito", 51)], getRestaurant, getMenu).errors).toHaveLength(1);
  });
});
