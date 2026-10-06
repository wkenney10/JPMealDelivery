import { CheckoutForm } from "@/components/checkout-form";
import { getLocale } from "@/i18n/server";
import { allRestaurants } from "@/lib/data";
import { allSlots, formatDate, localNow, orderableDates } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const locale = await getLocale();
  const now = new Date();
  const today = localNow(now).date;
  return (
    <CheckoutForm
      dates={orderableDates(now).map((d) => ({ value: d, label: formatDate(d, today, locale) }))}
      slots={allSlots(locale)}
      schedules={allRestaurants().map(({ slug, name, closedDays, lastPickup }) => ({ slug, name, closedDays, lastPickup }))}
    />
  );
}
