"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine } from "@/lib/types";

export interface CartEntry extends CartLine {
  // Snapshot for display only; the server re-prices everything from current menus.
  display: { name: string; restaurantName: string; options: string[]; unitPrice: number };
}

interface CartState {
  ready: boolean;
  entries: CartEntry[];
  count: number;
  add: (entry: Omit<CartEntry, "key">) => void;
  setQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartState | null>(null);
const STORAGE_KEY = "jpmd-cart-v1";

function load(): CartEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(entries: CartEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable (private mode etc.): the cart just won't persist.
  }
}

function sameSelection(a: CartLine, b: Omit<CartLine, "key">) {
  return (
    a.restaurant === b.restaurant &&
    a.itemId === b.itemId &&
    (a.notes ?? "") === (b.notes ?? "") &&
    [...a.optionIds].sort().join("|") === [...b.optionIds].sort().join("|")
  );
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<CartEntry[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setEntries(load());
    setReady(true);
  }, []);

  const update = useCallback((fn: (prev: CartEntry[]) => CartEntry[]) => {
    setEntries((prev) => {
      const next = fn(prev);
      save(next);
      return next;
    });
  }, []);

  const value = useMemo<CartState>(
    () => ({
      ready,
      entries,
      count: entries.reduce((n, e) => n + e.quantity, 0),
      add: (entry) =>
        update((prev) => {
          const existing = prev.find((e) => sameSelection(e, entry));
          if (existing) {
            return prev.map((e) =>
              e === existing ? { ...e, quantity: Math.min(50, e.quantity + entry.quantity) } : e,
            );
          }
          return [...prev, { ...entry, key: crypto.randomUUID() }];
        }),
      setQuantity: (key, quantity) =>
        update((prev) =>
          quantity <= 0
            ? prev.filter((e) => e.key !== key)
            : prev.map((e) => (e.key === key ? { ...e, quantity: Math.min(50, quantity) } : e)),
        ),
      remove: (key) => update((prev) => prev.filter((e) => e.key !== key)),
      clear: () => update(() => []),
    }),
    [entries, ready, update],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

/** The fields the server needs, without the display snapshot. */
export function toCartLines(entries: CartEntry[]): CartLine[] {
  return entries.map(({ key, restaurant, itemId, quantity, optionIds, notes }) => ({
    key,
    restaurant,
    itemId,
    quantity,
    optionIds,
    notes,
  }));
}
