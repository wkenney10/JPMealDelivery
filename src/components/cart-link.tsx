"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/client";
import { useCart } from "./cart-context";

export function CartLink() {
  const { count, entries } = useCart();
  const { t } = useI18n();
  const restaurants = new Set(entries.map((e) => e.restaurant)).size;
  return (
    <Link href="/cart" className="group flex items-baseline gap-2 text-sm">
      <span className="smallcaps font-semibold group-hover:text-brand">{t("header.yourOrder")}</span>
      <span className="numerals font-serif text-base">{count === 0 ? "—" : t("header.items", { count })}</span>
      {restaurants > 1 && (
        <span className="hidden text-xs text-muted italic sm:inline">{t("header.fromRestaurants", { count: restaurants })}</span>
      )}
    </Link>
  );
}
