import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { ORDER_STATUSES, RESTAURANT_ORDER_STATUSES, STATUS_LABELS } from "@/lib/orders";
import { formatMoney } from "@/lib/pricing";
import { addDays, formatDate, isValidDateString, localNow, slotLabel } from "@/lib/schedule";
import { logoutAction, setOrderStatus, updateRestaurantOrder } from "./actions";

export const dynamic = "force-dynamic";

const select = "rounded-md border border-line bg-card px-2 py-1 text-sm";
const save = "rounded-md bg-brand px-2 py-1 text-xs font-semibold text-white hover:bg-brand-dark";

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireAdmin();
  const today = localNow(new Date()).date;
  const requested = (await searchParams).date;
  const date = requested && isValidDateString(requested) ? requested : today;

  const orders = await prisma.order.findMany({
    where: { deliveryDate: date },
    include: { restaurantOrders: { include: { items: true } } },
    orderBy: [{ deliverySlot: "asc" }, { createdAt: "asc" }],
  });
  const active = orders.filter((o) => o.status !== "cancelled");
  const toPlace = active.flatMap((o) => o.restaurantOrders).filter((r) => r.status === "to_place").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Orders · {formatDate(date, today)}</h1>
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/admin?date=${addDays(date, -1)}`} className="rounded-md border border-line px-2 py-1">
            ← Prev
          </Link>
          <Link href="/admin" className="rounded-md border border-line px-2 py-1">
            Today
          </Link>
          <Link href={`/admin?date=${addDays(date, 1)}`} className="rounded-md border border-line px-2 py-1">
            Next →
          </Link>
          <Link href="/admin/menus" className="ml-2 text-brand underline">
            Menu status
          </Link>
          <form action={logoutAction}>
            <button className="text-muted underline">Log out</button>
          </form>
        </div>
      </div>

      <p className="text-sm text-muted">
        {active.length} order{active.length === 1 ? "" : "s"} · {toPlace} restaurant order{toPlace === 1 ? "" : "s"} still
        to place · {formatMoney(active.reduce((s, o) => s + o.deliveryFee, 0))} delivery fees
      </p>

      {orders.length === 0 && <p className="text-muted">No orders for this date.</p>}

      {orders.map((o) => (
        <article
          key={o.id}
          className={`rounded-xl border bg-card p-5 ${o.status === "cancelled" ? "border-line opacity-60" : "border-line"}`}
        >
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-brand">{slotLabel(o.deliverySlot)}</div>
              <h2 className="text-lg font-semibold">
                {o.customerName} <span className="text-sm font-normal text-muted">#{o.code}</span>
              </h2>
              <div className="text-sm">
                {o.street}
                {o.unit ? `, ${o.unit}` : ""} · {o.zip} · {o.phone} · {o.email}
              </div>
              {o.deliveryNotes && <div className="mt-1 text-sm italic text-muted">“{o.deliveryNotes}”</div>}
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold">{formatMoney(o.total)}</div>
              <form action={setOrderStatus} className="mt-1 flex items-center gap-1">
                <input type="hidden" name="id" value={o.id} />
                <select name="status" defaultValue={o.status} className={select}>
                  {ORDER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <button className={save}>Save</button>
              </form>
            </div>
          </header>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {o.restaurantOrders.map((ro) => (
              <section key={ro.id} className="rounded-lg border border-line p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{ro.restaurantName}</h3>
                  <a href={ro.orderUrl} target="_blank" rel="noreferrer" className="text-xs text-brand underline">
                    Open ordering site ↗
                  </a>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {ro.items.map((it) => {
                    const options = JSON.parse(it.options) as string[];
                    return (
                      <li key={it.id}>
                        <span className="font-medium">{it.quantity} ×</span> {it.name}
                        {options.length > 0 && <span className="text-muted"> ({options.join(", ")})</span>}
                        {it.notes && <span className="italic text-muted"> — “{it.notes}”</span>}
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-2 text-xs text-muted">
                  Expect to pay restaurant ≈ {formatMoney(ro.subtotal + ro.tax + ro.serviceFee)} (food{" "}
                  {formatMoney(ro.subtotal)} + tax {formatMoney(ro.tax)}
                  {ro.serviceFee ? ` + fees ${formatMoney(ro.serviceFee)}` : ""})
                </div>
                <form action={updateRestaurantOrder} className="mt-2 flex flex-wrap items-center gap-1">
                  <input type="hidden" name="id" value={ro.id} />
                  <select name="status" defaultValue={ro.status} className={select}>
                    {RESTAURANT_ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </option>
                    ))}
                  </select>
                  <input
                    name="confirmation"
                    defaultValue={ro.confirmation ?? ""}
                    placeholder="Restaurant order #"
                    className="w-36 rounded-md border border-line px-2 py-1 text-sm"
                  />
                  <button className={save}>Save</button>
                </form>
              </section>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
