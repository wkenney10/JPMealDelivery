import { describe, expect, it } from "vitest";
import { dinnerMenu } from "../src/lib/menu-filter";
import type { Menu, MenuCategory } from "../src/lib/types";

const menu = (categories: MenuCategory[]): Menu => ({
  restaurant: "x",
  source: "scraped",
  platform: "toast",
  sourceUrl: "",
  fetchedAt: "",
  categories,
});
const items = (...pairs: [string, number][]) => pairs.map(([name, price], i) => ({ id: `${name}-${price}-${i}`, name, price }));
const names = (m: Menu) => m.categories.flatMap((c) => c.items.map((i) => i.name));

describe("dinnerMenu", () => {
  it("drops alcohol, catering and breakfast sections", () => {
    const m = dinnerMenu(
      menu([
        { name: "Tacos", items: items(["Al Pastor", 450]) },
        { name: "Draft Beers", items: items(["Sam Adams", 700]) },
        { name: "COCKTAILS", items: items(["Paloma", 1200]) },
        { name: "Catering", items: items(["Taco Tray", 9000]) },
        { name: "Desayuno/ Breakfast", items: items(["Huevos", 900]) },
        { name: "Seltzers", items: items(["White Claw", 700]) },
        { name: "Party Size Pizza", items: items(["Cheese Party Pizza", 2500]) },
        { name: "Wellness Shots", items: items(["Wheatgrass 1oz", 400]) },
      ]),
    );
    expect(m.categories.map((c) => c.name)).toEqual(["Tacos", "Party Size Pizza", "Wellness Shots"]);
  });

  it("drops alcoholic items but keeps food and soft drinks that share the words", () => {
    const m = dinnerMenu(
      menu([
        {
          name: "Beverages",
          items: items(
            ["Ginger Ale", 250],
            ["Root Beer", 250],
            ["House Red Wine", 900],
            ["Modelo Especial", 600],
            ["Frozen Margarita", 1100],
            ["Virgin Mojito", 600],
            ["Cola Champagne", 250],
            ["Coke", 250],
          ),
        },
        {
          name: "Mains",
          items: items(
            ["Beer-Battered Fish & Chips", 1800],
            ["Margarita Pizza", 1400],
            ["Red Wine Braised Short Rib", 2600],
            ["Sake Nigiri", 700],
            ["Rum Cake", 800],
            ["Vodka Parm", 1700],
            ["Bourbon Chicken Sandwich", 1300],
            ["Heineken", 600],
          ),
        },
      ]),
    );
    expect(names(m)).toEqual([
      "Ginger Ale",
      "Root Beer",
      "Virgin Mojito",
      "Cola Champagne",
      "Coke",
      "Beer-Battered Fish & Chips",
      "Margarita Pizza",
      "Red Wine Braised Short Rib",
      "Sake Nigiri",
      "Rum Cake",
      "Vodka Parm",
      "Bourbon Chicken Sandwich",
    ]);
  });

  it("drops a repeated, marked-up copy of the menu", () => {
    const m = dinnerMenu(
      menu([
        { name: "Burritos", items: items(["Al Pastor Burrito", 1099], ["Carnitas Burrito", 1099], ["Birria Burrito", 1299]) },
        { name: "Sides", items: items(["Rice", 300]) },
        { name: "Burritos", items: items(["Al Pastor Burrito", 1460], ["Carnitas Burrito", 1460], ["Birria Burrito", 1699]) },
        { name: "Sides", items: items(["Rice", 400]) },
      ]),
    );
    expect(m.categories.flatMap((c) => c.items.map((i) => i.price))).toEqual([1099, 1099, 1299, 300]);
  });

  it("keeps a repeated menu at the same prices, merged without duplicates", () => {
    const m = dinnerMenu(
      menu([
        { name: "Mains", items: items(["Fish & Chips", 1800]) },
        { name: "Dessert", items: items(["Sticky Toffee", 900]) },
        { name: "Mains", items: items(["Fish & Chips", 1800], ["Shepherd's Pie", 2000]) },
      ]),
    );
    expect(m.categories.map((c) => [c.name, c.items.map((i) => i.name)])).toEqual([
      ["Mains", ["Fish & Chips", "Shepherd's Pie"]],
      ["Dessert", ["Sticky Toffee"]],
    ]);
  });
});

describe("per-restaurant hiding", () => {
  it("hides named sections and items", () => {
    const m = dinnerMenu(
      menu([
        { name: "Coffee Drinks", items: items(["Morning Screw", 1400]) },
        { name: "Appetizer", items: items(["Wings", 1400], ["Secret Shot Special", 900]) },
      ]),
      { hideSections: ["coffee drinks"], hideItems: ["Secret Shot Special"] },
    );
    expect(names(m)).toEqual(["Wings"]);
  });
});
