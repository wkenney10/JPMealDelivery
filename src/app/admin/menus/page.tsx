import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { STALE_MENU_DAYS } from "@/lib/config";
import { RestaurantMark } from "@/components/restaurant-mark";
import { allRestaurants, getMenu, logos, scrapeReport } from "@/lib/data";

export const dynamic = "force-dynamic";

function ago(iso?: string): string {
  if (!iso) return "never";
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  if (days < 1 / 24) return "just now";
  if (days < 1) return `${Math.round(days * 24)}h ago`;
  return `${Math.round(days)}d ago`;
}

export default async function MenuStatus() {
  await requireAdmin();
  const report = scrapeReport();
  const logoIndex = logos();
  const rows = allRestaurants().map((r) => {
    const menu = getMenu(r.slug);
    const entry = report[r.slug];
    // fetchedAt only moves when the menu content changes; the report tracks the last good check.
    const verifiedAt = menu?.source === "scraped" ? (entry?.lastSuccessAt ?? menu.fetchedAt) : menu?.fetchedAt;
    const stale = verifiedAt ? (Date.now() - new Date(verifiedAt).getTime()) / 86_400_000 > STALE_MENU_DAYS : false;
    return { r, menu, entry, stale, verifiedAt };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Menu status</h1>
        <Link href="/admin" className="text-brand underline">
          ← Orders
        </Link>
      </div>
      <p className="text-sm text-muted">
        Menus refresh daily via the &quot;Refresh menus&quot; GitHub Action (or <code>npm run scrape</code>). A failed scrape
        keeps the last good menu. Restaurants with no menu fall back to <code>data/menus-manual/&lt;slug&gt;.json</code>.
      </p>
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="p-3">Logo</th>
              <th className="p-3">Restaurant</th>
              <th className="p-3">Platform</th>
              <th className="p-3">Menu</th>
              <th className="p-3">Last check</th>
              <th className="p-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ r, menu, entry, stale, verifiedAt }) => (
              <tr key={r.slug} className={!r.active ? "opacity-50" : ""}>
                <td className="p-3">
                  <RestaurantMark name={r.name} logo={logoIndex[r.slug]} size="sm" />
                </td>
                <td className="p-3">
                  <div className="font-medium">{r.name}</div>
                  <a href={r.orderUrl} target="_blank" rel="noreferrer" className="text-xs text-brand underline">
                    ordering site ↗
                  </a>
                </td>
                <td className="p-3">{r.platform}</td>
                <td className="p-3">
                  {menu ? (
                    <>
                      {menu.categories.reduce((n, c) => n + c.items.length, 0)} items ({menu.source})
                      <div className={`text-xs ${stale ? "font-semibold text-accent" : "text-muted"}`}>
                        verified {ago(verifiedAt)}
                        {stale ? " · stale" : ""}
                      </div>
                      {menu.dinnerAvailable === false && <div className="text-xs text-accent">not open for dinner</div>}
                    </>
                  ) : (
                    <span className="font-semibold text-accent">none, hidden from customers</span>
                  )}
                </td>
                <td className="p-3">
                  {entry ? (
                    <>
                      <span className={entry.status === "failed" ? "font-semibold text-accent" : ""}>{entry.status}</span>
                      <div className="text-xs text-muted">{ago(entry.checkedAt)}</div>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="max-w-sm p-3 text-xs text-muted">
                  {entry?.error && <div className="text-accent">{entry.error}</div>}
                  {entry?.changes?.slice(0, 4).map((c, i) => <div key={i}>{c}</div>)}
                  {!r.feesVerified && <div>Online-ordering fees not yet verified.</div>}
                  {r.notes && <div>{r.notes}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
