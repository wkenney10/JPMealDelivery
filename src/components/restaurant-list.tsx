"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

interface Card {
  slug: string;
  name: string;
  cuisine: string;
  address: string;
  itemCount: number;
}

export function RestaurantList({ restaurants }: { restaurants: Card[] }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? restaurants.filter((r) => `${r.name} ${r.cuisine}`.toLowerCase().includes(q)) : restaurants;
  }, [query, restaurants]);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-xl font-semibold">Restaurants ({restaurants.length})</h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or cuisine"
          className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm sm:w-72"
        />
      </div>
      {shown.length === 0 ? (
        <p className="text-muted">
          {restaurants.length === 0 ? "No menus are loaded yet. Run the menu scraper to populate them." : "No matches."}
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => (
            <li key={r.slug}>
              <Link
                href={`/r/${r.slug}`}
                className="block h-full rounded-xl border border-line bg-card p-4 transition hover:border-brand hover:shadow-sm"
              >
                <div className="font-semibold">{r.name}</div>
                <div className="text-sm text-brand">{r.cuisine}</div>
                <div className="mt-2 text-xs text-muted">
                  {r.address} · {r.itemCount} items
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
