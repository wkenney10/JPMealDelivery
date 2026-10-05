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
 * Opens `url`, records every JSON response whose URL matches `match`, and
 * returns them once the page has been quiet for a moment. `interact` can click
 * through location pickers etc.
 */
export async function captureJson(
  url: string,
  match: RegExp,
  opts: { waitMs?: number; interact?: (page: Page) => Promise<void> } = {},
): Promise<{ captured: Captured[]; finalUrl: string; title: string }> {
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
    return { captured, finalUrl: page.url(), title };
  } finally {
    await context.close();
  }
}
