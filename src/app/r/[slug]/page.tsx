import Link from "next/link";
import { notFound } from "next/navigation";
import { MenuView } from "@/components/menu-view";
import { getMenu, getRestaurant } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RestaurantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const restaurant = getRestaurant(slug);
  const menu = restaurant?.active ? getMenu(slug) : undefined;
  if (!restaurant || !menu || menu.dinnerAvailable === false) notFound();

  return (
    <div>
      <Link href="/" className="text-sm text-muted hover:text-brand">
        ← All restaurants
      </Link>
      <div className="mt-3 mb-6">
        <h1 className="text-3xl font-bold tracking-tight">{restaurant.name}</h1>
        <p className="mt-1 text-muted">
          {restaurant.cuisine} · {restaurant.address}, Jamaica Plain
        </p>
        <p className="mt-1 text-xs text-muted">
          Same prices as the restaurant&apos;s own online ordering
          {menu.source === "scraped" ? ", checked daily" : ""}. We place your order there for you.
        </p>
      </div>
      <MenuView restaurant={{ slug: restaurant.slug, name: restaurant.name }} categories={menu.categories} />
    </div>
  );
}
