import type { MenuCategory, MenuItem, Restaurant } from "../../src/lib/types";
import type { ScrapeResult } from "../types";
import { cleanText, dollarsToCents, fetchText } from "../util";

interface SliceProduct {
  id: number;
  name: string;
  description?: string;
  basePrice?: string;
  productTypes?: { id: number; name: string; price: string }[];
}

interface SliceState {
  menus: { menus: Record<string, { value: { categories: { id: string; name: string; isDisplayed?: boolean; groupedProducts?: SliceProduct[] }[] } }> };
  shop: { schedules?: Record<string, { value?: { _pickup?: { from: string; to: string }[] } }> };
}

/** Pulls `window.__SLICE_REDUX_STATE__` out of the server-rendered menu page. */
export function parseSliceState(html: string): SliceState {
  const marker = "window.__SLICE_REDUX_STATE__=";
  const start = html.indexOf(marker);
  if (start < 0) throw new Error("Slice state not found in page");
  const jsonStart = html.indexOf("{", start);
  // Walk to the matching closing brace (the state is followed by more JS).
  let depth = 0;
  let inString = false;
  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return JSON.parse(html.slice(jsonStart, i + 1));
  }
  throw new Error("Unterminated Slice state");
}

function localMinutes(iso: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return Number(p.hour) * 60 + Number(p.minute);
}

/** True if any pickup window is open across the core dinner hour (5:30–6:30 PM). */
export function sliceServesDinner(windows: { from: string; to: string }[]): boolean {
  return windows.some((w) => {
    const from = localMinutes(w.from);
    const durationMin = (new Date(w.to).getTime() - new Date(w.from).getTime()) / 60_000;
    return from <= 17 * 60 + 30 && from + durationMin >= 18 * 60 + 30;
  });
}

export function sliceMenuFromState(state: SliceState): ScrapeResult {
  const [key] = Object.keys(state.menus.menus);
  if (!key) throw new Error("No menu in Slice state");
  const categories: MenuCategory[] = state.menus.menus[key].value.categories
    .filter((c) => c.isDisplayed !== false)
    .map((c) => ({
      name: c.name,
      items: (c.groupedProducts ?? []).map((p): MenuItem => {
        const types = (p.productTypes ?? []).map((t) => ({ ...t, cents: dollarsToCents(t.price) }));
        const base = types.length ? Math.min(...types.map((t) => t.cents)) : dollarsToCents(p.basePrice ?? "0");
        return {
          id: `slice-${p.id}`,
          name: p.name,
          description: cleanText(p.description),
          price: base,
          optionGroups:
            types.length > 1
              ? [
                  {
                    id: `slice-${p.id}-size`,
                    name: "Size",
                    min: 1,
                    max: 1,
                    options: types.map((t) => ({ id: `slice-type-${t.id}`, name: t.name, price: t.cents - base })),
                  },
                ]
              : undefined,
        };
      }),
    }));
  const windows = state.shop.schedules?.[key]?.value?._pickup;
  return { categories, dinnerAvailable: windows?.length ? sliceServesDinner(windows) : undefined };
}

export async function scrapeSlice(r: Restaurant): Promise<ScrapeResult> {
  return sliceMenuFromState(parseSliceState(await fetchText(r.orderUrl)));
}
