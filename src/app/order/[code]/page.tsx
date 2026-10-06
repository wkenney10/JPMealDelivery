import Link from "next/link";
import { notFound } from "next/navigation";
import type { MessageKey } from "@/i18n";
import { getTranslator } from "@/i18n/server";
import { prisma } from "@/lib/db";
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
  const { locale, t } = await getTranslator();

  return (
    <div className="mx-auto max-w-xl">
      <article className="border border-ink bg-card px-6 py-8 shadow-[6px_6px_0_var(--color-ink)] sm:px-10">
        <header className="text-center">
          <p className="smallcaps text-sm text-muted">{t("order.number")}</p>
          <p className="font-display text-5xl tracking-[0.08em]">{order.code}</p>
          <p className="mt-3 font-serif text-lg">
            {order.status === "cancelled" ? t("order.cancelled") : t("order.thanks")}
          </p>
          <p className="mt-1 font-serif italic text-muted">
            {formatDate(order.deliveryDate, undefined, locale)}, {slotLabel(order.deliverySlot, locale)}
            <br />
            {order.street}
            {order.unit ? `, ${order.unit}` : ""}
          </p>
          <p className="smallcaps mt-3 inline-block border-y border-ink px-3 py-0.5 text-sm font-semibold">
            {t(`status.${order.status}` as MessageKey)}
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
                <span>{ro.serviceFee > 0 ? t("order.taxAndFees") : t("order.tax")}</span>
                <span className="leader" />
                <span className="numerals">{formatMoney(ro.tax + ro.serviceFee)}</span>
              </div>
              <div className="flex items-baseline font-serif">
                <span>{t("order.delivery")}</span>
                <span className="leader" />
                <span className="numerals">{formatMoney(ro.deliveryFee)}</span>
              </div>
            </div>
          </section>
        ))}

        <div className="rule-double mt-8 flex items-baseline pt-2 font-display text-2xl">
          <span>{t("order.total")}</span>
          <span className="leader" />
          <span className="numerals">{formatMoney(order.total)}</span>
        </div>

        <p className="mt-6 text-center text-sm italic text-muted">
          {t("order.keepPage", { phone: order.phone })}
        </p>
      </article>

      <p className="mt-8 text-center">
        <Link href="/" className="smallcaps text-sm font-semibold hover:text-brand">
          ← {t("order.back")}
        </Link>
      </p>
    </div>
  );
}
