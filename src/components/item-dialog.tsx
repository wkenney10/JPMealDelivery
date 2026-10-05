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
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/45 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={item.name}
        className="flex max-h-[90vh] w-full max-w-lg flex-col border border-ink bg-card shadow-[6px_6px_0_var(--color-ink)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-y-auto px-6 pt-5 pb-6">
          <div className="flex justify-end">
            <button onClick={onClose} aria-label="Close" className="smallcaps text-sm text-muted hover:text-ink">
              Close ✕
            </button>
          </div>
          <h2 className="text-center font-display text-3xl leading-tight">{item.name}</h2>
          {item.description && (
            <p className="mt-2 text-center font-serif italic leading-snug text-muted">{item.description}</p>
          )}
          <p className="numerals mt-2 text-center font-serif">{formatMoney(item.price)}</p>

          {(item.optionGroups ?? []).map((g) => {
            const count = g.options.filter((o) => chosen.has(o.id)).length;
            const invalid = showErrors && count < g.min;
            return (
              <fieldset key={g.id} className="mt-6">
                <legend className="flex w-full items-baseline justify-between gap-2 border-b border-ink pb-1">
                  <span className="smallcaps font-semibold">{g.name}</span>
                  <span className={`text-xs italic ${invalid ? "font-semibold text-brand" : "text-muted"}`}>{groupHint(g)}</span>
                </legend>
                <div className="divide-y divide-line">
                  {g.options.map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-baseline gap-3 py-2 font-serif">
                      <input
                        type={g.max === 1 ? "radio" : "checkbox"}
                        name={g.id}
                        checked={chosen.has(o.id)}
                        onChange={() => toggle(g, o.id)}
                        className="translate-y-0.5 accent-ink"
                      />
                      <span>{o.name}</span>
                      {o.price !== 0 && (
                        <>
                          <span className="leader" />
                          <span className="numerals text-sm">
                            {o.price > 0 ? "+" : "−"}
                            {formatMoney(Math.abs(o.price))}
                          </span>
                        </>
                      )}
                    </label>
                  ))}
                </div>
              </fieldset>
            );
          })}

          <label className="mt-6 block">
            <span className="label">Special instructions</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 300))}
              rows={2}
              placeholder="No onions, extra napkins… (the kitchen will do its best)"
              className="field resize-none text-base placeholder:text-muted/70 placeholder:italic"
            />
          </label>
        </div>

        <div className="flex items-center gap-3 border-t border-ink px-6 py-4">
          <div className="flex items-center border border-ink">
            <button className="px-3 py-1 text-lg leading-none" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Decrease">
              −
            </button>
            <span className="numerals w-7 text-center font-serif">{quantity}</span>
            <button className="px-3 py-1 text-lg leading-none" onClick={() => setQuantity((q) => Math.min(50, q + 1))} aria-label="Increase">
              +
            </button>
          </div>
          <button onClick={submit} className="btn btn-primary flex-1">
            Add to order <span className="numerals font-serif normal-case tracking-normal">{formatMoney(unitPrice * quantity)}</span>
          </button>
        </div>
        {showErrors && "error" in priced && <p className="px-6 pb-3 text-sm italic text-brand">{priced.error}</p>}
      </div>
    </div>
  );
}
