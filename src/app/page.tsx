import { RestaurantList } from "@/components/restaurant-list";
import { DELIVERY_FEE_PER_RESTAURANT, ORDER_CUTOFF_MINUTES } from "@/lib/config";
import { allRestaurants, orderableRestaurants } from "@/lib/data";
import { formatMoney } from "@/lib/pricing";
import { localNow } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export default function Home() {
  const open = orderableRestaurants();
  const openSlugs = new Set(open.map((o) => o.restaurant.slug));
  const pending = allRestaurants().filter((r) => r.active && !openSlugs.has(r.slug));
  const beforeCutoff = localNow(new Date()).minutes < ORDER_CUTOFF_MINUTES;

  return (
    <div className="space-y-8">
      <section className="rounded-2xl bg-brand px-6 py-8 text-white">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Dinner from your JP favorites.</h1>
        <p className="mt-3 max-w-2xl text-white/85">
          Order by 4 PM and choose a delivery time between 5 and 9 PM. You pay the restaurant&apos;s own menu prices
          and taxes, plus a flat {formatMoney(DELIVERY_FEE_PER_RESTAURANT)} delivery fee for each restaurant. Restaurants
          pay nothing.
        </p>
        <p className="mt-4 inline-block rounded-full bg-white/15 px-3 py-1 text-sm">
          {beforeCutoff ? "Ordering is open for tonight until 4:00 PM." : "Tonight's orders are closed. Pre-order for tomorrow or later."}
        </p>
      </section>

      <RestaurantList
        restaurants={open.map(({ restaurant, menu }) => ({
          slug: restaurant.slug,
          name: restaurant.name,
          cuisine: restaurant.cuisine,
          address: restaurant.address,
          itemCount: menu.categories.reduce((n, c) => n + c.items.length, 0),
        }))}
      />

      {pending.length > 0 && (
        <section className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-semibold">Coming soon</h2>
          <p className="mt-1 text-sm text-muted">
            These JP restaurants take online orders, but their menus haven&apos;t loaded yet.
          </p>
          <p className="mt-3 text-sm">{pending.map((r) => r.name).join(" · ")}</p>
        </section>
      )}
    </div>
  );
}
