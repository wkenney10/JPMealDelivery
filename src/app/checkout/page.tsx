import { CheckoutForm } from "@/components/checkout-form";
import { allRestaurants } from "@/lib/data";
import { allSlots, formatDate, localNow, orderableDates } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default function CheckoutPage() {
  const now = new Date();
  const today = localNow(now).date;
  return (
    <CheckoutForm
      dates={orderableDates(now).map((d) => ({ value: d, label: formatDate(d, today) }))}
      slots={allSlots()}
      schedules={allRestaurants().map(({ slug, name, closedDays, lastPickup }) => ({ slug, name, closedDays, lastPickup }))}
    />
  );
}
