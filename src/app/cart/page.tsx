"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-context";
import { QuoteSummary } from "@/components/quote-summary";
import { useQuote } from "@/components/use-quote";
import { DELIVERY_FEE_PER_RESTAURANT } from "@/lib/config";
import { formatMoney } from "@/lib/pricing";

export default function CartPage() {
  const { ready, entries, setQuantity, remove } = useCart();
  const { quote, error } = useQuote(entries, ready);

  if (!ready) return null;
  if (!entries.length) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-2xl font-semibold">Your cart is empty</h1>
        <Link href="/" className="mt-4 inline-block text-brand underline">
          Browse restaurants
        </Link>
      </div>
    );
  }

  const byRestaurant = new Map<string, typeof entries>();
  for (const e of entries) byRestaurant.set(e.restaurant, [...(byRestaurant.get(e.restaurant) ?? []), e]);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Your cart</h1>
        {[...byRestaurant.entries()].map(([slug, items]) => {
          const group = quote?.restaurants.find((g) => g.restaurant.slug === slug);
          return (
            <section key={slug} className="rounded-xl border border-line bg-card p-4">
              <div className="flex items-baseline justify-between">
                <Link href={`/r/${slug}`} className="font-semibold hover:text-brand">
                  {items[0].display.restaurantName}
                </Link>
                <span className="text-xs text-muted">+ {formatMoney(DELIVERY_FEE_PER_RESTAURANT)} delivery</span>
              </div>
              <ul className="mt-3 divide-y divide-line">
                {items.map((e) => {
                  const priced = group?.lines.find((l) => l.key === e.key);
                  return (
                    <li key={e.key} className="flex items-start gap-3 py-3">
                      <div className="flex-1">
                        <div className="font-medium">{e.display.name}</div>
                        {e.display.options.length > 0 && (
                          <div className="text-sm text-muted">{e.display.options.join(", ")}</div>
                        )}
                        {e.notes && <div className="text-sm italic text-muted">“{e.notes}”</div>}
                        <button onClick={() => remove(e.key)} className="mt-1 text-xs text-muted underline">
                          Remove
                        </button>
                      </div>
                      <select
                        aria-label="Quantity"
                        value={e.quantity}
                        onChange={(ev) => setQuantity(e.key, Number(ev.target.value))}
                        className="rounded-md border border-line bg-card px-2 py-1 text-sm"
                      >
                        {Array.from({ length: Math.max(10, e.quantity) }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <div className="w-20 text-right text-sm font-medium">
                        {formatMoney(priced?.lineTotal ?? e.display.unitPrice * e.quantity)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <aside className="h-fit space-y-4 rounded-xl border border-line bg-card p-5 lg:sticky lg:top-20">
        <h2 className="font-semibold">Order summary</h2>
        {error && <p className="text-sm text-accent">{error}</p>}
        {quote?.errors.map((msg, i) => (
          <p key={i} className="rounded-md bg-orange-50 p-2 text-sm text-accent">
            {msg} Please remove it to continue.
          </p>
        ))}
        {quote ? <QuoteSummary quote={quote} /> : <p className="text-sm text-muted">Checking prices…</p>}
        <Link
          href="/checkout"
          aria-disabled={!quote || quote.errors.length > 0}
          className={`block rounded-full px-4 py-2.5 text-center font-semibold text-white ${
            !quote || quote.errors.length ? "pointer-events-none bg-muted/50" : "bg-brand hover:bg-brand-dark"
          }`}
        >
          Choose delivery time
        </Link>
      </aside>
    </div>
  );
}
