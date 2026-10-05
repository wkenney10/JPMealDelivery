import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuView } from "@/components/menu-view";
import { RestaurantMark } from "@/components/restaurant-mark";
import { getMenu, getRestaurant, logos } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RestaurantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = getRestaurant(slug);
  const menu = restaurant?.active ? getMenu(slug) : undefined;
  if (!restaurant || !menu || menu.dinnerAvailable === false) notFound();
  const logo = logos()[slug];

  return (
    <div>
      <Link href="/" className="smallcaps text-sm text-muted hover:text-brand">
        ← All restaurants
      </Link>
      <header className="mt-4 flex flex-col items-center text-center">
        <RestaurantMark name={restaurant.name} logo={logo} size="lg" />
        <h1 className={logo ? "smallcaps mt-5 font-serif text-base tracking-[0.16em]" : "sr-only"}>{restaurant.name}</h1>
        <p className="mt-1 font-serif italic text-muted">
          {restaurant.cuisine} · {restaurant.address}, Jamaica Plain
        </p>
        <p className="mt-3 max-w-md text-xs text-muted">
          Prices are the restaurant&apos;s own online prices{menu.source === "scraped" ? ", checked daily" : ""}. We
          place your order with them and bring it to you.
        </p>
      </header>
      <MenuView restaurant={{ slug: restaurant.slug, name: restaurant.name }} categories={menu.categories} />
    </div>
  );
}
