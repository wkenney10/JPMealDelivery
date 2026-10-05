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
      <div className="py-20 text-center">
        <h1 className="font-display text-4xl">Your order is empty</h1>
        <p className="mt-3 font-serif italic text-muted">Choose a restaurant to start.</p>
        <Link href="/" className="btn mt-6">
          See the restaurants
        </Link>
      </div>
    );
  }

  const byRestaurant = new Map<string, typeof entries>();
  for (const e of entries) byRestaurant.set(e.restaurant, [...(byRestaurant.get(e.restaurant) ?? []), e]);

  return (
    <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
      <div>
        <h1 className="font-display text-4xl">Your order</h1>
        <div className="mt-6 space-y-10">
          {[...byRestaurant.entries()].map(([slug, items]) => {
            const group = quote?.restaurants.find((g) => g.restaurant.slug === slug);
            return (
              <section key={slug}>
                <div className="flex items-baseline justify-between border-b border-ink pb-1">
                  <Link href={`/r/${slug}`} className="smallcaps font-serif text-sm font-semibold tracking-[0.12em] hover:text-brand">
                    {items[0].display.restaurantName}
                  </Link>
                  <span className="text-xs italic text-muted">
                    delivery {formatMoney(DELIVERY_FEE_PER_RESTAURANT)}
                  </span>
                </div>
                <ul>
                  {items.map((e) => {
                    const priced = group?.lines.find((l) => l.key === e.key);
                    return (
                      <li key={e.key} className="flex items-start gap-4 border-b border-line py-3">
                        <select
                          aria-label="Quantity"
                          value={e.quantity}
                          onChange={(ev) => setQuantity(e.key, Number(ev.target.value))}
                          className="numerals border-b border-ink bg-transparent font-serif"
                        >
                          {Array.from({ length: Math.max(10, e.quantity) }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline font-serif">
                            <span>{e.display.name}</span>
                            <span className="leader" />
                            <span className="numerals">
                              {formatMoney(priced?.lineTotal ?? e.display.unitPrice * e.quantity)}
                            </span>
                          </div>
                          {e.display.options.length > 0 && (
                            <div className="text-sm text-muted italic">{e.display.options.join(", ")}</div>
                          )}
                          {e.notes && <div className="text-sm text-muted italic">“{e.notes}”</div>}
                          <button onClick={() => remove(e.key)} className="smallcaps mt-0.5 text-xs text-muted hover:text-brand">
                            Remove
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      </div>

      <aside className="h-fit border border-ink bg-card p-6 shadow-[5px_5px_0_var(--color-ink)] lg:sticky lg:top-24">
        <h2 className="smallcaps text-center font-semibold tracking-[0.14em]">Guest check</h2>
        <div className="mt-4">
          {error && <p className="text-sm italic text-brand">{error}</p>}
          {quote?.errors.map((msg, i) => (
            <p key={i} className="mb-3 border-l-2 border-brand pl-3 text-sm italic text-brand">
              {msg} Please remove it to continue.
            </p>
          ))}
          {quote ? <QuoteSummary quote={quote} /> : <p className="font-serif italic text-muted">Totting up…</p>}
        </div>
        <Link
          href="/checkout"
          aria-disabled={!quote || quote.errors.length > 0}
          className="btn btn-primary mt-6 w-full"
        >
          Choose a delivery time
        </Link>
      </aside>
    </div>
  );
}
