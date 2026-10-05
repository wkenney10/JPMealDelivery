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

const input = "field";

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
      <div className="py-20 text-center">
        <h1 className="font-display text-4xl">Your order is empty</h1>
        <Link href="/" className="btn mt-6">
          See the restaurants
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

  const heading = (n: string, title: string) => (
    <h2 className="flex items-baseline gap-3 border-b border-ink pb-1">
      <span className="font-display text-2xl text-brand">{n}</span>
      <span className="smallcaps font-semibold tracking-[0.12em]">{title}</span>
    </h2>
  );

  return (
    <form onSubmit={submit} className="grid gap-12 lg:grid-cols-[1fr_340px]">
      <div className="space-y-10">
        <h1 className="font-display text-4xl">Delivery &amp; details</h1>

        <section>
          {heading("I.", "When")}
          {dates.length === 0 ? (
            <p className="mt-3 font-serif italic text-muted">No delivery dates are open right now.</p>
          ) : (
            <>
              <label className="mt-4 block max-w-xs">
                <span className="label">Date</span>
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
              <div className="label mt-5">Time</div>
              {available.length === 0 ? (
                <p className="mt-1 font-serif italic text-brand">
                  Not every restaurant in your order is open that day. Try another date.
                </p>
              ) : (
                <div className="mt-2 grid grid-cols-2 border-t border-l border-ink sm:grid-cols-4">
                  {available.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setSlot(s.id)}
                      aria-pressed={slot === s.id}
                      className={`numerals border-r border-b border-ink px-2 py-2.5 font-serif ${
                        slot === s.id ? "bg-ink text-paper" : "hover:bg-brand-soft"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              <p className="mt-3 text-xs italic text-muted">Orders for an evening close at 4:00 PM that day.</p>
            </>
          )}
        </section>

        <section>
          {heading("II.", "Where")}
          <div className="mt-4 grid gap-5 sm:grid-cols-[1fr_140px]">
            <label>
              <span className="label">Street address</span>
              <input required value={form.street} onChange={set("street")} autoComplete="street-address" className={input} />
            </label>
            <label>
              <span className="label">Apt / unit</span>
              <input value={form.unit} onChange={set("unit")} className={input} />
            </label>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-[140px_1fr]">
            <label>
              <span className="label">ZIP code</span>
              <input
                required
                value={form.zip}
                onChange={set("zip")}
                inputMode="numeric"
                autoComplete="postal-code"
                className={`${input} numerals`}
              />
            </label>
            <div className="self-end pb-2 font-serif italic text-muted">Jamaica Plain, Boston</div>
          </div>
          {!zipOk && form.zip.length >= 5 && (
            <p className="mt-2 font-serif italic text-brand">We only deliver within Jamaica Plain (ZIP 02130) for now.</p>
          )}
          <label className="mt-5 block">
            <span className="label">Delivery instructions (optional)</span>
            <textarea value={form.notes} onChange={set("notes")} rows={2} maxLength={500} className={`${input} resize-none`} />
          </label>
        </section>

        <section>
          {heading("III.", "Who")}
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="label">Name</span>
              <input required value={form.name} onChange={set("name")} autoComplete="name" className={input} />
            </label>
            <label>
              <span className="label">Phone</span>
              <input required type="tel" value={form.phone} onChange={set("phone")} autoComplete="tel" className={input} />
            </label>
            <label>
              <span className="label">Email</span>
              <input required type="email" value={form.email} onChange={set("email")} autoComplete="email" className={input} />
            </label>
          </div>
        </section>
      </div>

      <aside className="h-fit border border-ink bg-card p-6 shadow-[5px_5px_0_var(--color-ink)] lg:sticky lg:top-24">
        <h2 className="smallcaps text-center font-semibold tracking-[0.14em]">Guest check</h2>
        {quote ? (
          <div className="mt-4">
            <ul className="mb-4 space-y-1 border-b border-line pb-3 text-sm">
              {quote.restaurants.map((g) => (
                <li key={g.restaurant.slug} className="flex items-baseline font-serif italic">
                  <span>{g.restaurant.name}</span>
                  <span className="leader" />
                  <span className="numerals not-italic">{formatMoney(g.total)}</span>
                </li>
              ))}
            </ul>
            <QuoteSummary quote={quote} />
          </div>
        ) : (
          <p className="mt-4 font-serif italic text-muted">Totting up…</p>
        )}
        {quote?.errors.length ? (
          <p className="mt-3 text-sm italic text-brand">
            {quote.errors[0]}{" "}
            <Link href="/cart" className="underline">
              Review order
            </Link>
          </p>
        ) : null}
        {error && <p className="mt-3 border-l-2 border-brand pl-3 text-sm italic text-brand">{error}</p>}
        <button
          type="submit"
          disabled={submitting || !quote || quote.errors.length > 0 || dates.length === 0}
          className="btn btn-primary mt-6 w-full"
        >
          {submitting ? "Placing order…" : "Place order"}
        </button>
        <p className="mt-3 text-center text-xs italic text-muted">
          No payment is taken online yet. We&apos;ll be in touch to arrange it.
        </p>
      </aside>
    </form>
  );
}
