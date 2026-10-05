import { RestaurantList } from "@/components/restaurant-list";
import { DELIVERY_FEE_PER_RESTAURANT, ORDER_CUTOFF_MINUTES } from "@/lib/config";
import { allRestaurants, logos, orderableRestaurants } from "@/lib/data";
import { formatMoney } from "@/lib/pricing";
import { localNow } from "@/lib/schedule";

export const dynamic = "force-dynamic";

function closesIn(minutesNow: number): string {
  const left = ORDER_CUTOFF_MINUTES - minutesNow;
  const h = Math.floor(left / 60);
  const m = left % 60;
  return h > 0 ? `${h} hr ${m} min` : `${m} min`;
}

export default function Home() {
  const open = orderableRestaurants();
  const openSlugs = new Set(open.map((o) => o.restaurant.slug));
  const pending = allRestaurants().filter((r) => r.active && !openSlugs.has(r.slug));
  const { minutes } = localNow(new Date());
  const beforeCutoff = minutes < ORDER_CUTOFF_MINUTES;
  const logoIndex = logos();
  const fee = formatMoney(DELIVERY_FEE_PER_RESTAURANT).replace(".00", "");

  return (
    <div>
      <section className="text-center">
        <p className="smallcaps text-sm text-muted">Dinner delivery in Jamaica Plain</p>
        <h1 className="mt-2 font-display text-4xl leading-tight sm:text-6xl">Actually Local Delivery</h1>
        <p className="mt-5 inline-block border-y border-ink px-4 py-1.5 text-sm">
          {beforeCutoff ? (
            <>
              <span className="smallcaps font-semibold">Now taking orders for tonight</span>
              <span className="mx-2 text-muted">·</span>
              <span className="text-muted">closes in {closesIn(minutes)}</span>
            </>
          ) : (
            <span className="smallcaps font-semibold">Tonight is closed · now taking orders for tomorrow</span>
          )}
        </p>
      </section>

      <dl className="mx-auto mt-8 grid max-w-4xl border-y border-ink text-center sm:grid-cols-3 sm:divide-x sm:divide-ink">
        <div className="px-4 py-3">
          <dt className="smallcaps text-xs text-muted">Food</dt>
          <dd className="font-serif">Exactly the restaurant&apos;s own prices</dd>
        </div>
        <div className="border-t border-ink px-4 py-3 sm:border-t-0">
          <dt className="smallcaps text-xs text-muted">Delivery</dt>
          <dd className="font-serif">{fee} per restaurant, flat. 02130 only</dd>
        </div>
        <div className="border-t border-ink px-4 py-3 sm:border-t-0">
          <dt className="smallcaps text-xs text-muted">Restaurants</dt>
          <dd className="font-serif">Pay no commission or fees</dd>
        </div>
      </dl>

      <RestaurantList
        restaurants={open.map(({ restaurant, menu }) => ({
          slug: restaurant.slug,
          name: restaurant.name,
          cuisine: restaurant.cuisine,
          address: restaurant.address,
          itemCount: menu.categories.reduce((n, c) => n + c.items.length, 0),
          logo: logoIndex[restaurant.slug],
        }))}
      />

      {pending.length > 0 && (
        <section className="mx-auto mt-14 max-w-3xl text-center">
          <h2 className="ruled-heading smallcaps text-sm font-semibold">Coming to the menu</h2>
          <p className="mt-3 font-serif italic leading-relaxed text-muted">
            {pending.map((r) => r.name).join(" · ")}
          </p>
        </section>
      )}
    </div>
  );
}
