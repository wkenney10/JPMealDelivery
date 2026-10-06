import { RestaurantList } from "@/components/restaurant-list";
import { DELIVERY_FEE_PER_RESTAURANT, ORDER_CUTOFF_MINUTES } from "@/lib/config";
import type { Translate } from "@/i18n";
import { getTranslator } from "@/i18n/server";
import { allRestaurants, cuisineFor, logos, orderableRestaurants } from "@/lib/data";
import { formatMoney } from "@/lib/pricing";
import { localNow } from "@/lib/schedule";

export const dynamic = "force-dynamic";

function closesIn(minutesNow: number, t: Translate): string {
  const left = ORDER_CUTOFF_MINUTES - minutesNow;
  const h = Math.floor(left / 60);
  const m = left % 60;
  return h > 0 ? t("home.hoursMinutes", { h, m }) : t("home.minutes", { m });
}

export default async function Home() {
  const { locale, t } = await getTranslator();
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
        <p className="smallcaps text-sm text-muted">{t("home.kicker")}</p>
        <h1 className="mt-2 font-display text-4xl leading-tight sm:text-6xl">{t("home.title")}</h1>
        <p className="mt-5 inline-block border-y border-ink px-4 py-1.5 text-sm">
          {beforeCutoff ? (
            <>
              <span className="smallcaps font-semibold">{t("home.openTonight")}</span>
              <span className="mx-2 text-muted">·</span>
              <span className="text-muted">{t("home.closesIn", { time: closesIn(minutes, t) })}</span>
            </>
          ) : (
            <span className="smallcaps font-semibold">{t("home.closedTonight")}</span>
          )}
        </p>
      </section>

      <dl className="mx-auto mt-8 grid max-w-4xl border-y border-ink text-center sm:grid-cols-3 sm:divide-x sm:divide-ink">
        <div className="px-4 py-3">
          <dt className="smallcaps text-xs text-muted">{t("home.foodLabel")}</dt>
          <dd className="font-serif">{t("home.foodText")}</dd>
        </div>
        <div className="border-t border-ink px-4 py-3 sm:border-t-0">
          <dt className="smallcaps text-xs text-muted">{t("home.deliveryLabel")}</dt>
          <dd className="font-serif">{t("home.deliveryText", { fee })}</dd>
        </div>
        <div className="border-t border-ink px-4 py-3 sm:border-t-0">
          <dt className="smallcaps text-xs text-muted">{t("home.restaurantsLabel")}</dt>
          <dd className="font-serif">{t("home.restaurantsText")}</dd>
        </div>
      </dl>

      <RestaurantList
        restaurants={open.map(({ restaurant, menu }) => ({
          slug: restaurant.slug,
          name: restaurant.name,
          cuisine: cuisineFor(restaurant, locale),
          address: restaurant.address,
          itemCount: menu.categories.reduce((n, c) => n + c.items.length, 0),
          logo: logoIndex[restaurant.slug],
        }))}
      />

      {pending.length > 0 && (
        <section className="mx-auto mt-14 max-w-3xl text-center">
          <h2 className="ruled-heading smallcaps text-sm font-semibold">{t("home.comingSoon")}</h2>
          <p className="mt-3 font-serif italic leading-relaxed text-muted">
            {pending.map((r) => r.name).join(" · ")}
          </p>
        </section>
      )}
    </div>
  );
}
