import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseMenuAppCategories } from "../scraper/adapters/browser-platforms";
import { parseCloverMenu } from "../scraper/adapters/clover";
import { parseSliceState, sliceMenuFromState, sliceServesDinner } from "../scraper/adapters/slice";
import { diffMenus } from "../scraper/diff";
import { extractMenuFromJson } from "../scraper/extract";
import { tidyCategories } from "../scraper/util";

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");

describe("slice", () => {
  it("parses categories, items and sizes from the embedded state", () => {
    const { categories } = sliceMenuFromState(parseSliceState(fixture("slice-menu.html")));
    expect(categories.map((c) => c.name)).toEqual(["Home Style Pizza", "Gourmet Pizza"]);
    const cheese = categories[0].items[0];
    expect(cheese).toMatchObject({ name: "Cheese Pizza", price: 1199 });
    expect(cheese.optionGroups?.[0]).toMatchObject({ name: "Size", min: 1, max: 1 });
    expect(cheese.optionGroups?.[0].options.map((o) => [o.name, o.price])).toEqual([
      ["Small 10''", 0],
      ["Large 16''", 480],
    ]);
  });

  it("detects dinner service from pickup windows", () => {
    // 11:00 AM – 9:40 PM EDT
    expect(sliceServesDinner([{ from: "2026-10-05T15:00:00Z", to: "2026-10-06T01:40:00Z" }])).toBe(true);
    // 7:00 AM – 3:00 PM EDT
    expect(sliceServesDinner([{ from: "2026-10-05T11:00:00Z", to: "2026-10-05T19:00:00Z" }])).toBe(false);
  });
});

describe("clover", () => {
  it("parses the server-rendered menu", () => {
    const { categories } = parseCloverMenu(fixture("clover-menu.html"));
    expect(categories[0].name).toBe("Breakfast specials");
    expect(categories[0].items[0]).toMatchObject({ name: "Venezuelan Pancakes", price: 1000 });
    expect(categories.flatMap((c) => c.items).every((i) => i.price > 0)).toBe(true);
  });
});

describe("menu.app", () => {
  it("keeps visible, in-stock products with cent prices", () => {
    const cats = parseMenuAppCategories({
      data: {
        categories: [
          {
            name: "Bowls",
            products: [
              { id: "1", name: "Dal", price: 1545, in_stock: true, show_in_menu: true, state: 1 },
              { id: "2", name: "Sold out", price: 1200, in_stock: false },
            ],
          },
        ],
      },
    });
    expect(cats).toEqual([{ name: "Bowls", items: [{ id: "1", name: "Dal", description: undefined, price: 1545 }] }]);
  });
});

describe("generic JSON extraction", () => {
  it("handles Toast-style menus (dollar floats, nested groups)", () => {
    const toastLike = {
      data: {
        menusV3: {
          menus: [
            {
              name: "Dinner",
              groups: [
                {
                  name: "Tacos",
                  items: [
                    { guid: "t1", name: "Al Pastor", price: 4.5, description: "<b>Pork</b> &amp; pineapple" },
                    { guid: "t2", name: "Pescado", price: 5 },
                  ],
                },
                { name: "Platos", items: [{ guid: "p1", name: "Mole", price: 18.75 }] },
              ],
            },
          ],
        },
      },
    };
    const cats = extractMenuFromJson([toastLike]);
    expect(cats.map((c) => c.name).sort()).toEqual(["Platos", "Tacos"]);
    const tacos = cats.find((c) => c.name === "Tacos")!;
    expect(tacos.items.map((i) => i.price)).toEqual([450, 500]);
    expect(tacos.items[0].description).toBe("Pork & pineapple");
  });

  it("handles ChowNow-style menus with modifier categories", () => {
    const chownowLike = {
      menu_categories: [
        {
          name: "Pizza",
          items: [
            {
              id: 9,
              name: "Cheese",
              price: 12,
              modifier_categories: [
                { id: 3, name: "Size", min_qty: 1, max_qty: 1, modifiers: [{ id: 30, name: "Large", price: 4 }] },
              ],
            },
            { id: 10, name: "Veggie", price: 14.5 },
          ],
        },
      ],
    };
    const [pizza] = extractMenuFromJson([chownowLike]);
    expect(pizza.items[0]).toMatchObject({ id: "9", price: 1200 });
    expect(pizza.items[0].optionGroups?.[0]).toMatchObject({ name: "Size", min: 1, max: 1 });
    expect(pizza.items[0].optionGroups?.[0].options[0].price).toBe(400);
  });

  it("handles DoorDash-style display price strings and cent amounts", () => {
    const ddLike = {
      data: {
        storepageFeed: {
          itemLists: [
            {
              name: "Noodles",
              items: [
                { id: "a", name: "Pho", displayPrice: "$15.95" },
                { id: "b", name: "Pad Thai", displayPrice: "$14.50" },
              ],
            },
          ],
        },
      },
    };
    expect(extractMenuFromJson([ddLike])[0].items.map((i) => i.price)).toEqual([1595, 1450]);
    const centsLike = { categories: [{ name: "Bowls", items: [{ id: 1, name: "A", price: 1295 }, { id: 2, name: "B", price: 1150 }] }] };
    expect(extractMenuFromJson([centsLike])[0].items.map((i) => i.price)).toEqual([1295, 1150]);
  });
});

describe("tidy + diff", () => {
  it("drops duplicates and empty categories", () => {
    const item = { id: "x", name: "X", price: 100 };
    expect(tidyCategories([{ name: "A", items: [item] }, { name: "B", items: [item] }, { name: "C", items: [] }])).toEqual([
      { name: "A", items: [{ ...item, optionGroups: undefined }] },
    ]);
  });

  it("describes price changes, additions and removals", () => {
    const before = [{ name: "A", items: [{ id: "1", name: "Taco", price: 400 }, { id: "2", name: "Soup", price: 600 }] }];
    const after = [{ name: "A", items: [{ id: "1", name: "Taco", price: 450 }, { id: "3", name: "Salad", price: 900 }] }];
    expect(diffMenus(before, after)).toEqual(["Taco: $4.00 → $4.50", "Added Salad ($9.00)", "Removed Soup"]);
  });
});

describe("Next.js flight payloads (DoorDash Storefront)", () => {
  it("decodes JSON rows and $$-escaped prices into a menu", async () => {
    const { parseFlight } = await import("../scraper/browser");
    const row = {
      itemLists: [
        { __typename: "MenuPageItemList", id: "popular-items", name: "Most Ordered", items: [{ id: "1", name: "Pepperoni Pizza - Large", displayPrice: "$$21.00" }] },
        {
          __typename: "MenuPageItemList",
          id: "105288367",
          name: "PIZZAS WITH MEAT",
          items: [
            { id: "1", name: "Pepperoni Pizza - Large", displayPrice: "$$21.00" },
            { id: "2", name: "Meatball Pizza - Small", displayPrice: "$$14.50" },
          ],
        },
      ],
    };
    // A text row ("T<hex byte length>,") is followed by the next row with no newline.
    const textRow = "héllo [](x)";
    const text = `0:{"P":null}\n7e:I[428342,["a.js"],"default"]\n88:T${Buffer.byteLength(textRow).toString(16)},${textRow}9a:${JSON.stringify(row)}\n`;
    const rows = parseFlight(text);
    expect(rows.map((r) => r.url)).toEqual(["embedded:flight:0", "embedded:flight:9a"]);
    const cats = tidyCategories(extractMenuFromJson(rows.map((r) => r.body)));
    expect(cats).toHaveLength(1);
    expect(cats[0].name).toBe("PIZZAS WITH MEAT");
    expect(cats[0].items.map((i) => i.price)).toEqual([2100, 1450]);
  });
});
