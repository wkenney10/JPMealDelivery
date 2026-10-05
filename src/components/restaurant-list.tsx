"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LogoInfo } from "@/lib/data";
import { RestaurantMark } from "./restaurant-mark";

interface Entry {
  slug: string;
  name: string;
  cuisine: string;
  address: string;
  itemCount: number;
  logo?: LogoInfo;
}

export function RestaurantList({ restaurants }: { restaurants: Entry[] }) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? restaurants.filter((r) => `${r.name} ${r.cuisine}`.toLowerCase().includes(q)) : restaurants;
  }, [query, restaurants]);

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
        <h2 className="font-display text-3xl">
          Bill of Fare <span className="numerals font-serif text-lg text-muted italic">— {restaurants.length} restaurants</span>
        </h2>
        <label className="w-full sm:w-72">
          <span className="sr-only">Find a restaurant</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a restaurant or cuisine…"
            className="field text-base italic placeholder:text-muted"
          />
        </label>
      </div>
      <div className="mt-3 border-t border-ink" />

      {shown.length === 0 ? (
        <p className="py-10 text-center font-serif italic text-muted">
          {restaurants.length === 0 ? "No menus are loaded yet." : "Nothing by that name."}
        </p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 md:gap-x-12">
          {shown.map((r) => (
            <li key={r.slug} className="border-b border-line">
              <Link href={`/r/${r.slug}`} className="group flex items-center gap-4 py-4 sm:gap-5">
                <span className="flex h-14 w-24 shrink-0 items-center justify-center text-ink transition-colors group-hover:text-brand sm:w-28">
                  <RestaurantMark name={r.name} logo={r.logo} size="sm" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline">
                    <span className="min-w-0 font-serif text-xl leading-tight group-hover:text-brand sm:truncate">{r.name}</span>
                    <span className="leader hidden sm:block" />
                    <span className="smallcaps hidden shrink-0 text-sm font-semibold text-brand sm:inline">Menu&nbsp;→</span>
                  </span>
                  <span className="block font-serif text-sm italic text-muted">{r.cuisine}</span>
                  <span className="smallcaps block text-xs text-muted">
                    {r.address} · {r.itemCount} dishes
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
