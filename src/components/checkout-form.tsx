"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { isDeliverableZip } from "@/lib/address";
import { formatMoney } from "@/lib/pricing";
import { restaurantServes, type Slot } from "@/lib/schedule";
import type { Restaurant } from "@/lib/types";
import { toCartLines, useCart } from "./cart-context";
import { QuoteSummary } from "./quote-summary";
import { useQuote } from "./use-quote";

type Schedule = Pick<Restaurant, "slug" | "name" | "closedDays" | "lastPickup">;

const input = "mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 font-normal";

export function CheckoutForm({
  dates,
  slots,
  schedules,
}: {
  dates: { value: string; label: string }[];
  slots: Slot[];
  schedules: Schedule[];
}) {
  const router = useRouter();
  const { ready, entries, clear } = useCart();
  const { quote, setQuote } = useQuote(entries, ready);
  const [date, setDate] = useState(dates[0]?.value ?? "");
  const [slot, setSlot] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "", street: "", unit: "", zip: "02130", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inCart = useMemo(() => {
    const slugs = new Set(entries.map((e) => e.restaurant));
    return schedules.filter((s) => slugs.has(s.slug));
  }, [entries, schedules]);

  const available = useMemo(
    () => slots.filter((s) => date && inCart.every((r) => restaurantServes(r, date, s))),
    [slots, date, inCart],
  );

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

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const zipOk = isDeliverableZip(form.zip);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!quote) return;
    setError(null);
    if (!zipOk) return setError("We only deliver within Jamaica Plain (ZIP 02130) right now.");
    if (!slot) return setError("Choose a delivery time.");
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: toCartLines(entries),
          customer: { ...form, unit: form.unit || undefined, notes: form.notes || undefined },
          deliveryDate: date,
          deliverySlot: slot,
          expectedTotal: quote.total,
        }),
      });
      const result = await res.json();
      if (result.ok) {
        clear();
        router.push(`/order/${result.code}`);
        return;
      }
      if (result.quote) setQuote(result.quote);
      setError(result.error ?? "Couldn't place your order.");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Checkout</h1>

        <section className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-semibold">Delivery time</h2>
          {dates.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No delivery dates are open right now.</p>
          ) : (
            <>
              <label className="mt-3 block text-sm font-medium">
                Date
                <select
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setSlot("");
                  }}
                  className={input}
                >
                  {dates.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mt-4 text-sm font-medium">Time</div>
              {available.length === 0 ? (
                <p className="mt-1 text-sm text-accent">
                  Not every restaurant in your cart is open that day. Try another date.
                </p>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {available.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setSlot(s.id)}
                      className={`rounded-lg border px-2 py-2 text-sm ${
                        slot === s.id ? "border-brand bg-brand-soft font-semibold text-brand" : "border-line bg-card"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs text-muted">Orders for a given evening close at 4:00 PM that day.</p>
            </>
          )}
        </section>

        <section className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-semibold">Delivery address</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px]">
            <label className="text-sm font-medium">
              Street address
              <input required value={form.street} onChange={set("street")} autoComplete="street-address" className={input} />
            </label>
            <label className="text-sm font-medium">
              Apt / unit
              <input value={form.unit} onChange={set("unit")} className={input} />
            </label>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
            <label className="text-sm font-medium">
              ZIP code
              <input
                required
                value={form.zip}
                onChange={set("zip")}
                inputMode="numeric"
                autoComplete="postal-code"
                className={input}
              />
            </label>
            <div className="self-end pb-2 text-sm text-muted">Jamaica Plain, Boston, MA</div>
          </div>
          {!zipOk && form.zip.length >= 5 && (
            <p className="mt-2 text-sm text-accent">We only deliver within Jamaica Plain (ZIP 02130) for now.</p>
          )}
          <label className="mt-3 block text-sm font-medium">
            Delivery instructions (optional)
            <textarea value={form.notes} onChange={set("notes")} rows={2} maxLength={500} className={input} />
          </label>
        </section>

        <section className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-semibold">Contact</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium sm:col-span-2">
              Name
              <input required value={form.name} onChange={set("name")} autoComplete="name" className={input} />
            </label>
            <label className="text-sm font-medium">
              Phone
              <input required type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" className={input} />
            </label>
            <label className="text-sm font-medium">
              Email
              <input required type="email" value={form.email} onChange={set("email")} autoComplete="email" className={input} />
            </label>
          </div>
        </section>
      </div>

      <aside className="h-fit space-y-4 rounded-xl border border-line bg-card p-5 lg:sticky lg:top-20">
        <h2 className="font-semibold">Order summary</h2>
        {quote ? (
          <>
            <ul className="space-y-1 text-sm">
              {quote.restaurants.map((g) => (
                <li key={g.restaurant.slug} className="flex justify-between">
                  <span>{g.restaurant.name}</span>
                  <span>{formatMoney(g.total)}</span>
                </li>
              ))}
            </ul>
            <QuoteSummary quote={quote} />
          </>
        ) : (
          <p className="text-sm text-muted">Checking prices…</p>
        )}
        {quote?.errors.length ? (
          <p className="text-sm text-accent">
            {quote.errors[0]} <Link href="/cart" className="underline">Review cart</Link>
          </p>
        ) : null}
        {error && <p className="rounded-md bg-orange-50 p-2 text-sm text-accent">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !quote || quote.errors.length > 0 || dates.length === 0}
          className="w-full rounded-full bg-brand px-4 py-2.5 font-semibold text-white hover:bg-brand-dark disabled:bg-muted/50"
        >
          {submitting ? "Placing order…" : quote ? `Place order · ${formatMoney(quote.total)}` : "Place order"}
        </button>
        <p className="text-xs text-muted">No payment is collected online yet. We&apos;ll contact you to arrange payment.</p>
      </aside>
    </form>
  );
}
