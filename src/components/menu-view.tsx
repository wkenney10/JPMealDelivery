"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/pricing";
import type { MenuCategory, MenuItem } from "@/lib/types";
import { useCart } from "./cart-context";
import { ItemDialog } from "./item-dialog";

function categoryId(i: number) {
  return `cat-${i}`;
}

export function MenuView({
  restaurant,
  categories,
}: {
  restaurant: { slug: string; name: string };
  categories: MenuCategory[];
}) {
  const { add } = useCart();
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const visible = categories.filter((c) => c.items.length);

  function added(name: string) {
    setFlash(`Added ${name}`);
    setTimeout(() => setFlash(null), 1800);
  }

  function quickAdd(item: MenuItem) {
    add({
      restaurant: restaurant.slug,
      itemId: item.id,
      quantity: 1,
      optionIds: [],
      display: { name: item.name, restaurantName: restaurant.name, options: [], unitPrice: item.price },
    });
    added(item.name);
  }

  return (
    <div>
      <nav className="sticky top-[57px] z-10 -mx-4 mb-4 flex gap-2 overflow-x-auto border-b border-line bg-paper px-4 py-2">
        {visible.map((c, i) => (
          <a
            key={c.name + i}
            href={`#${categoryId(i)}`}
            className="shrink-0 rounded-full border border-line bg-card px-3 py-1 text-sm hover:border-brand"
          >
            {c.name}
          </a>
        ))}
      </nav>

      <div className="space-y-8">
        {visible.map((c, i) => (
          <section key={c.name + i} id={categoryId(i)} className="scroll-mt-32">
            <h2 className="mb-3 text-lg font-semibold">{c.name}</h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {c.items.map((item) => {
                const hasOptions = !!item.optionGroups?.length;
                return (
                  <li key={item.id} className="flex gap-3 rounded-xl border border-line bg-card p-4">
                    <button className="flex-1 text-left" onClick={() => setSelected(item)}>
                      <div className="font-medium">{item.name}</div>
                      {item.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{item.description}</p>}
                      <div className="mt-2 text-sm font-semibold">
                        {hasOptions && item.optionGroups!.some((g) => g.options.some((o) => o.price > 0)) ? "from " : ""}
                        {formatMoney(item.price)}
                      </div>
                    </button>
                    <button
                      aria-label={`Add ${item.name}`}
                      onClick={() => (hasOptions ? setSelected(item) : quickAdd(item))}
                      className="h-9 w-9 shrink-0 self-center rounded-full bg-brand text-xl leading-none text-white hover:bg-brand-dark"
                    >
                      +
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {selected && (
        <ItemDialog
          item={selected}
          restaurant={restaurant}
          onClose={() => setSelected(null)}
          onAdded={(name) => {
            setSelected(null);
            added(name);
          }}
        />
      )}

      {flash && (
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg">
          {flash}
        </div>
      )}
    </div>
  );
}
