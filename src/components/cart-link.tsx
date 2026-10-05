"use client";

import Link from "next/link";
import { useCart } from "./cart-context";

export function CartLink() {
  const { count, entries } = useCart();
  const restaurants = new Set(entries.map((e) => e.restaurant)).size;
  return (
    <Link
      href="/cart"
      className="flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
    >
      Cart
      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{count}</span>
      {restaurants > 1 && <span className="hidden text-xs text-white/80 sm:inline">{restaurants} restaurants</span>}
    </Link>
  );
}
