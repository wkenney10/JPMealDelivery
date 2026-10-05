import { DELIVERY_FEE_PER_RESTAURANT } from "@/lib/config";
import { formatMoney, type Quote } from "@/lib/pricing";

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "font-semibold" : "text-muted"}`}>
      <span>{label}</span>
      <span className={strong ? "" : "text-ink"}>{formatMoney(value)}</span>
    </div>
  );
}

export function QuoteSummary({ quote }: { quote: Quote }) {
  const n = quote.restaurants.length;
  return (
    <div className="space-y-1.5 text-sm">
      <Row label="Food (restaurant menu prices)" value={quote.subtotal} />
      <Row label="MA meals tax (7%)" value={quote.tax} />
      {quote.serviceFee > 0 && <Row label="Restaurant online-ordering fees" value={quote.serviceFee} />}
      <Row label={`Delivery (${formatMoney(DELIVERY_FEE_PER_RESTAURANT)} × ${n} restaurant${n === 1 ? "" : "s"})`} value={quote.deliveryFee} />
      <div className="border-t border-line pt-2">
        <Row label="Total" value={quote.total} strong />
      </div>
    </div>
  );
}
