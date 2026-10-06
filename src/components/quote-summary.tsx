"use client";

import { useI18n } from "@/i18n/client";
import { DELIVERY_FEE_PER_RESTAURANT } from "@/lib/config";
import { formatMoney, type Quote } from "@/lib/pricing";

function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex items-baseline ${strong ? "font-display text-2xl" : "font-serif"}`}>
      <span>{label}</span>
      <span className="leader" />
      <span className="numerals">{formatMoney(value)}</span>
    </div>
  );
}

export function QuoteSummary({ quote }: { quote: Quote }) {
  const { t } = useI18n();
  const n = quote.restaurants.length;
  return (
    <div className="space-y-1.5">
      <Line label={t("summary.food")} value={quote.subtotal} />
      <Line label={t("summary.tax")} value={quote.tax} />
      {quote.serviceFee > 0 && <Line label={t("summary.fees")} value={quote.serviceFee} />}
      <Line label={t("summary.delivery", { count: n, fee: formatMoney(DELIVERY_FEE_PER_RESTAURANT) })} value={quote.deliveryFee} />
      <div className="rule-double mt-3 pt-2">
        <Line label={t("summary.total")} value={quote.total} strong />
      </div>
    </div>
  );
}
