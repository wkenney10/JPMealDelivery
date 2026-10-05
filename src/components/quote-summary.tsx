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
  const n = quote.restaurants.length;
  return (
    <div className="space-y-1.5">
      <Line label="Food, at menu prices" value={quote.subtotal} />
      <Line label="Mass. meals tax, 7%" value={quote.tax} />
      {quote.serviceFee > 0 && <Line label="Restaurant ordering fees" value={quote.serviceFee} />}
      <Line label={`Delivery, ${n} × ${formatMoney(DELIVERY_FEE_PER_RESTAURANT)}`} value={quote.deliveryFee} />
      <div className="rule-double mt-3 pt-2">
        <Line label="Total" value={quote.total} strong />
      </div>
    </div>
  );
}
