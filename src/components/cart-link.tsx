"use client";

import Link from "next/link";
import { useCart } from "./cart-context";

export function CartLink() {
  const { count, entries } = useCart();
  const restaurants = new Set(entries.map((e) => e.restaurant)).size;
  return (
    <Link href="/cart" className="group flex items-baseline gap-2 text-sm">
      <span className="smallcaps font-semibold group-hover:text-brand">Your order</span>
      <span className="numerals font-serif text-base">
        {count === 0 ? "—" : `${count} item${count === 1 ? "" : "s"}`}
      </span>
      {restaurants > 1 && <span className="hidden text-xs text-muted italic sm:inline">from {restaurants} restaurants</span>}
    </Link>
  );
}
