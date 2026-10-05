import type { MenuCategory, MenuItem, MenuOptionGroup } from "../src/lib/types";

export const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36";

export async function fetchText(url: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/json,*/*", ...init.headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.text();
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
  throw lastError;
}

export async function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  return JSON.parse(await fetchText(url, init)) as T;
}

export function dollarsToCents(value: number | string): number {
  const n = typeof value === "string" ? Number(value.replace(/[$,\s]/g, "")) : value;
  if (!Number.isFinite(n)) throw new Error(`Bad price: ${value}`);
  return Math.round(n * 100);
}

export function cleanText(s: unknown): string | undefined {
  if (typeof s !== "string") return undefined;
  const t = s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return t || undefined;
}

/** Drops empty categories, duplicate item ids, and option groups with no options. */
export function tidyCategories(categories: MenuCategory[]): MenuCategory[] {
  const seen = new Set<string>();
  const out: MenuCategory[] = [];
  for (const c of categories) {
    const items: MenuItem[] = [];
    for (const item of c.items) {
      if (!item.name || seen.has(item.id) || !Number.isFinite(item.price) || item.price < 0) continue;
      seen.add(item.id);
      const groups: MenuOptionGroup[] = (item.optionGroups ?? [])
        .map((g) => ({ ...g, options: g.options.filter((o) => o.name && Number.isFinite(o.price)) }))
        .filter((g) => g.options.length > 0)
        .map((g) => ({ ...g, min: Math.min(g.min, g.options.length) }));
      items.push({ ...item, optionGroups: groups.length ? groups : undefined });
    }
    if (items.length) out.push({ name: c.name.trim(), items });
  }
  return out;
}
