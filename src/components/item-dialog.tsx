"use client";

import { useEffect, useState } from "react";
import { formatMoney, priceItem } from "@/lib/pricing";
import type { MenuItem, MenuOptionGroup } from "@/lib/types";
import { useCart } from "./cart-context";

function groupHint(g: MenuOptionGroup): string {
  if (g.min === 1 && g.max === 1) return "Required · choose 1";
  if (g.min > 0 && g.max > 0) return g.min === g.max ? `Required · choose ${g.min}` : `Choose ${g.min}–${g.max}`;
  if (g.min > 0) return `Required · choose at least ${g.min}`;
  if (g.max > 0) return `Optional · up to ${g.max}`;
  return "Optional";
}

export function ItemDialog({
  item,
  restaurant,
  onClose,
  onAdded,
}: {
  item: MenuItem;
  restaurant: { slug: string; name: string };
  onClose: () => void;
  onAdded: (name: string) => void;
}) {
  const { add } = useCart();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const optionIds = [...chosen];
  const priced = priceItem(item, optionIds);
  const unitPrice =
    "error" in priced
      ? item.price +
        (item.optionGroups ?? []).flatMap((g) => g.options).filter((o) => chosen.has(o.id)).reduce((s, o) => s + o.price, 0)
      : priced.unitPrice;

  function toggle(group: MenuOptionGroup, optionId: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      const single = group.max === 1;
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        if (single) group.options.forEach((o) => next.delete(o.id));
        const count = group.options.filter((o) => next.has(o.id)).length;
        if (group.max > 0 && count >= group.max) return prev;
        next.add(optionId);
      }
      return next;
    });
  }

  function submit() {
    if ("error" in priced) {
      setShowErrors(true);
      return;
    }
    add({
      restaurant: restaurant.slug,
      itemId: item.id,
      quantity,
      optionIds,
      notes: notes.trim() || undefined,
      display: { name: item.name, restaurantName: restaurant.name, options: priced.options, unitPrice: priced.unitPrice },
    });
    onAdded(item.name);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl bg-card sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-semibold">{item.name}</h2>
            <button onClick={onClose} aria-label="Close" className="text-2xl leading-none text-muted hover:text-ink">
              ×
            </button>
          </div>
          {item.description && <p className="mt-2 text-sm text-muted">{item.description}</p>}

          {(item.optionGroups ?? []).map((g) => {
            const count = g.options.filter((o) => chosen.has(o.id)).length;
            const invalid = showErrors && count < g.min;
            return (
              <fieldset key={g.id} className="mt-5">
                <legend className="flex w-full items-baseline justify-between gap-2">
                  <span className="font-medium">{g.name}</span>
                  <span className={`text-xs ${invalid ? "font-semibold text-accent" : "text-muted"}`}>{groupHint(g)}</span>
                </legend>
                <div className="mt-2 divide-y divide-line rounded-lg border border-line">
                  {g.options.map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                      <input
                        type={g.max === 1 ? "radio" : "checkbox"}
                        name={g.id}
                        checked={chosen.has(o.id)}
                        onChange={() => toggle(g, o.id)}
                        className="accent-brand"
                      />
                      <span className="flex-1">{o.name}</span>
                      {o.price !== 0 && (
                        <span className="text-muted">
                          {o.price > 0 ? "+" : "−"}
                          {formatMoney(Math.abs(o.price))}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}

          <label className="mt-5 block text-sm font-medium">
            Special instructions
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="e.g. no onions (the restaurant may not be able to accommodate every request)"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-normal"
            />
          </label>
        </div>

        <div className="flex items-center gap-3 border-t border-line p-4">
          <div className="flex items-center rounded-full border border-line">
            <button className="px-3 py-1 text-lg" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease">
              −
            </button>
            <span className="w-6 text-center">{quantity}</span>
            <button className="px-3 py-1 text-lg" onClick={() => setQuantity((q) => Math.min(50, q + 1))} aria-label="Increase">
              +
            </button>
          </div>
          <button
            onClick={submit}
            className="flex-1 rounded-full bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-dark"
          >
            Add to cart · {formatMoney(unitPrice * quantity)}
          </button>
        </div>
        {showErrors && "error" in priced && <p className="px-4 pb-3 text-sm text-accent">{priced.error}</p>}
      </div>
    </div>
  );
}
