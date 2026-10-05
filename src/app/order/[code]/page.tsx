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
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl bg-brand-soft p-6">
        <p className="text-sm font-medium text-brand">Order {order.code}</p>
        <h1 className="mt-1 text-2xl font-bold">
          {order.status === "cancelled" ? "This order was cancelled." : "Thanks! Your order is in."}
        </h1>
        <p className="mt-2">
          Delivery {formatDate(order.deliveryDate)}, {slotLabel(order.deliverySlot)} to {order.street}
          {order.unit ? `, ${order.unit}` : ""}.
        </p>
        <p className="mt-1 text-sm text-muted">Status: {STATUS_LABELS[order.status] ?? order.status}</p>
        <p className="mt-3 text-sm text-muted">
          Save this page to check on your order. We&apos;ll text {order.phone} if anything comes up.
        </p>
      </div>

      {order.restaurantOrders.map((ro) => (
        <section key={ro.id} className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-semibold">{ro.restaurantName}</h2>
          <ul className="mt-2 divide-y divide-line text-sm">
            {ro.items.map((it) => {
              const options = JSON.parse(it.options) as string[];
              return (
                <li key={it.id} className="flex justify-between gap-4 py-2">
                  <div>
                    {it.quantity} × {it.name}
                    {options.length > 0 && <div className="text-muted">{options.join(", ")}</div>}
                    {it.notes && <div className="italic text-muted">“{it.notes}”</div>}
                  </div>
                  <div>{formatMoney(it.lineTotal)}</div>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 space-y-0.5 border-t border-line pt-2 text-sm text-muted">
            <div className="flex justify-between">
              <span>Tax{ro.serviceFee > 0 ? " & restaurant fees" : ""}</span>
              <span>{formatMoney(ro.tax + ro.serviceFee)}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery</span>
              <span>{formatMoney(ro.deliveryFee)}</span>
            </div>
          </div>
        </section>
      ))}

      <div className="flex justify-between rounded-xl border border-line bg-card p-5 text-lg font-semibold">
        <span>Total</span>
        <span>{formatMoney(order.total)}</span>
      </div>

      <Link href="/" className="inline-block text-brand underline">
        Back to restaurants
      </Link>
    </div>
  );
}
