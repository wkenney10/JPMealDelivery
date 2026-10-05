import type { Browser, Page } from "playwright";
import { USER_AGENT } from "./util";

let browserPromise: Promise<Browser> | undefined;

/**
 * Shared Chromium instance. Bot protection (Cloudflare) on some ordering sites
 * rejects headless browsers, so CI runs headed under xvfb (HEADED=1).
 */
export function getBrowser(): Promise<Browser> {
  browserPromise ??= import("playwright").then(({ chromium }) =>
    chromium.launch({
      headless: process.env.HEADED !== "1",
      args: ["--disable-blink-features=AutomationControlled"],
    }),
  );
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) await (await browserPromise).close();
  browserPromise = undefined;
}

export interface Captured {
  url: string;
  body: unknown;
}

/**
 * JSON the page carries inline: <script type="application/json">, __NEXT_DATA__,
 * and window.__SOMETHING_STATE__-style globals. Many storefronts server-render
 * the menu this way instead of fetching it.
 */
async function embeddedJson(page: Page): Promise<Captured[]> {
  const found = await page.evaluate(() => {
    const out: { url: string; body: unknown }[] = [];
    document.querySelectorAll<HTMLScriptElement>('script[type="application/json"], script[type="application/ld+json"], script#__NEXT_DATA__').forEach((s, i) => {
      try {
        out.push({ url: `embedded:script:${s.id || i}`, body: JSON.parse(s.textContent ?? "") });
      } catch {
        // Not JSON.
      }
    });
    for (const key of Object.keys(window)) {
      if (!/^__[A-Z0-9_]+__$|STATE|APOLLO|INITIAL|PRELOAD/i.test(key)) continue;
      try {
        const value = (window as unknown as Record<string, unknown>)[key];
        if (value && typeof value === "object") out.push({ url: `embedded:window.${key}`, body: JSON.parse(JSON.stringify(value)) });
      } catch {
        // Circular or not serializable.
      }
    }
    return out;
  });
  return found;
}

/** Scrolls to the bottom in steps so lazy-loaded menu sections render. */
async function scrollThrough(page: Page) {
  for (let i = 0; i < 15; i++) {
    const done = await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
      return window.scrollY + window.innerHeight >= document.body.scrollHeight - 10;
    });
    await page.waitForTimeout(400);
    if (done) break;
  }
}

/**
 * Opens `url` and returns every JSON payload it sees: API responses whose URL
 * matches `match`, plus JSON embedded in the final page. `interact` can click
 * through location pickers etc.
 */
export async function captureJson(
  url: string,
  match: RegExp,
  opts: { waitMs?: number; interact?: (page: Page) => Promise<void> } = {},
): Promise<{ captured: Captured[]; finalUrl: string; title: string; html: string }> {
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent: USER_AGENT, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const captured: Captured[] = [];
  page.on("response", async (res) => {
    const ct = res.headers()["content-type"] ?? "";
    if (!match.test(res.url()) || !ct.includes("json")) return;
    try {
      captured.push({ url: res.url(), body: await res.json() });
    } catch {
      // Body unavailable (redirect, aborted request).
    }
  });
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
    if (opts.interact) await opts.interact(page);
    await page.waitForTimeout(opts.waitMs ?? 5_000);
    const title = await page.title();
    if (/just a moment|attention required|security verification/i.test(title)) {
      throw new Error(`Blocked by bot protection at ${page.url()}`);
    }
    await scrollThrough(page);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    captured.push(...(await embeddedJson(page)));
    return { captured, finalUrl: page.url(), title, html: await page.content() };
  } finally {
    await context.close();
  }
}
