import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { STATUS_LABELS } from "@/lib/orders";
import { formatMoney } from "@/lib/pricing";
import { formatDate, slotLabel } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Z0-9]{6}$/.test(code)) notFound();
  const order = await prisma.order.findUnique({
    where: { code },
    include: { restaurantOrders: { include: { items: true } } },
  });
  if (!order) notFound();

  return (
    <div className="mx-auto max-w-xl">
      <article className="border border-ink bg-card px-6 py-8 shadow-[6px_6px_0_var(--color-ink)] sm:px-10">
        <header className="text-center">
          <p className="smallcaps text-sm text-muted">Order No.</p>
          <p className="font-display text-5xl tracking-[0.08em]">{order.code}</p>
          <p className="mt-3 font-serif text-lg">
            {order.status === "cancelled" ? "This order was cancelled." : "Thank you. Your order is in."}
          </p>
          <p className="mt-1 font-serif italic text-muted">
            {formatDate(order.deliveryDate)}, {slotLabel(order.deliverySlot)}
            <br />
            {order.street}
            {order.unit ? `, ${order.unit}` : ""}
          </p>
          <p className="smallcaps mt-3 inline-block border-y border-ink px-3 py-0.5 text-sm font-semibold">
            {STATUS_LABELS[order.status] ?? order.status}
          </p>
        </header>

        {order.restaurantOrders.map((ro) => (
          <section key={ro.id} className="mt-8">
            <h2 className="ruled-heading smallcaps font-serif font-semibold tracking-[0.12em]">{ro.restaurantName}</h2>
            <ul className="mt-3 space-y-1.5">
              {ro.items.map((it) => {
                const options = JSON.parse(it.options) as string[];
                return (
                  <li key={it.id} className="font-serif">
                    <div className="flex items-baseline">
                      <span className="numerals mr-2 text-muted">{it.quantity}×</span>
                      <span>{it.name}</span>
                      <span className="leader" />
                      <span className="numerals">{formatMoney(it.lineTotal)}</span>
                    </div>
                    {options.length > 0 && <div className="pl-6 text-sm italic text-muted">{options.join(", ")}</div>}
                    {it.notes && <div className="pl-6 text-sm italic text-muted">“{it.notes}”</div>}
                  </li>
                );
              })}
            </ul>
            <div className="mt-2 space-y-0.5 text-sm text-muted">
              <div className="flex items-baseline font-serif">
                <span>Tax{ro.serviceFee > 0 ? " & ordering fees" : ""}</span>
                <span className="leader" />
                <span className="numerals">{formatMoney(ro.tax + ro.serviceFee)}</span>
              </div>
              <div className="flex items-baseline font-serif">
                <span>Delivery</span>
                <span className="leader" />
                <span className="numerals">{formatMoney(ro.deliveryFee)}</span>
              </div>
            </div>
          </section>
        ))}

        <div className="rule-double mt-8 flex items-baseline pt-2 font-display text-2xl">
          <span>Total</span>
          <span className="leader" />
          <span className="numerals">{formatMoney(order.total)}</span>
        </div>

        <p className="mt-6 text-center text-sm italic text-muted">
          Keep this page to check on your order. We&apos;ll text {order.phone} if anything comes up.
        </p>
      </article>

      <p className="mt-8 text-center">
        <Link href="/" className="smallcaps text-sm font-semibold hover:text-brand">
          ← Back to the restaurants
        </Link>
      </p>
    </div>
  );
}
