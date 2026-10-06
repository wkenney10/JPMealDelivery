"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { formatMoney } from "@/lib/pricing";
import type { MenuCategory, MenuItem } from "@/lib/types";
import { useCart } from "./cart-context";
import { ItemDialog } from "./item-dialog";

function categoryId(i: number) {
  return `cat-${i}`;
}

function hasUpcharges(item: MenuItem) {
  return !!item.optionGroups?.some((g) => g.options.some((o) => o.price > 0));
}

export function MenuView({
  restaurant,
  categories,
}: {
  restaurant: { slug: string; name: string };
  categories: MenuCategory[];
}) {
  const { add } = useCart();
  const { t } = useI18n();
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const visible = categories.filter((c) => c.items.length);

  function added(name: string) {
    setFlash(t("menu.added", { name }));
    setTimeout(() => setFlash(null), 2000);
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
      <nav className="sticky top-[62px] z-10 -mx-4 mt-8 border-y border-ink bg-paper px-4 sm:-mx-6 sm:px-6">
        <div className="flex gap-1 overflow-x-auto py-2 text-sm whitespace-nowrap">
          {visible.map((c, i) => (
            <a key={c.name + i} href={`#${categoryId(i)}`} className="smallcaps px-1.5 font-semibold hover:text-brand">
              {c.name}
              {i < visible.length - 1 && <span className="ml-2.5 text-muted">·</span>}
            </a>
          ))}
        </div>
      </nav>

      <div className="mt-10 space-y-14">
        {visible.map((c, i) => (
          <section key={c.name + i} id={categoryId(i)} className="scroll-mt-32">
            <h2 className="ruled-heading smallcaps font-serif text-[0.95rem] tracking-[0.16em]">{c.name}</h2>
            <ul className="mt-6 grid grid-cols-1 gap-x-14 gap-y-5 md:grid-cols-2">
              {c.items.map((item) => {
                const options = !!item.optionGroups?.length;
                return (
                  <li key={item.id} className="group">
                    <div className="flex items-baseline">
                      <button
                        onClick={() => setSelected(item)}
                        className="text-left font-serif text-[1.08rem] leading-snug group-hover:text-brand"
                      >
                        {item.name}
                      </button>
                      <span className="leader" />
                      <span className="numerals shrink-0 font-serif">
                        {hasUpcharges(item) && <span className="mr-1 text-xs italic text-muted">{t("menu.from")}</span>}
                        {formatMoney(item.price)}
                      </span>
                      <button
                        aria-label={t("menu.addItem", { name: item.name })}
                        onClick={() => (options ? setSelected(item) : quickAdd(item))}
                        className="smallcaps ml-3 shrink-0 border border-ink px-1.5 text-[0.65rem] font-semibold leading-5 hover:bg-ink hover:text-paper"
                      >
                        {t("menu.add")}
                      </button>
                    </div>
                    {item.description && (
                      <p className="mt-0.5 line-clamp-2 pr-14 font-serif text-sm italic leading-snug text-muted">
                        {item.description}
                      </p>
                    )}
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
        <div className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 border border-ink bg-card px-4 py-2 font-serif text-sm italic shadow-[3px_3px_0_var(--color-ink)]">
          {flash}
        </div>
      )}
    </div>
  );
}
