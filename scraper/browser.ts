import type { Browser, Page } from "playwright";
import { USER_AGENT } from "./util";

let browserPromise: Promise<Browser> | undefined;

/**
 * Shared browser instance. Bot protection (Cloudflare) on some ordering sites
 * rejects headless browsers, so CI runs headed under xvfb (HEADED=1). Local runs
 * (npm run scrape:local) also prefer the installed Google Chrome, which passes
 * those checks far more often than the bundled Chromium.
 */
export function getBrowser(): Promise<Browser> {
  browserPromise ??= import("playwright").then(async ({ chromium }) => {
    const options = {
      headless: process.env.HEADED !== "1",
      args: ["--disable-blink-features=AutomationControlled"],
    };
    if (process.env.USE_CHROME === "1") {
      try {
        return await chromium.launch({ ...options, channel: "chrome" });
      } catch {
        console.warn("Google Chrome not found; using Playwright's Chromium instead.");
      }
    }
    return chromium.launch(options);
  });
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
    // Next.js App Router pages stream their data as self.__next_f chunks.
    const flight = (window as unknown as { __next_f?: unknown[][] }).__next_f;
    const text = (flight ?? []).map((c) => (typeof c[1] === "string" ? c[1] : "")).join("");
    return { out, text };
  });
  return [...found.out, ...parseFlight(found.text)];
}

/** React Server Components escape strings that start with "$" by doubling it. */
function unescapeFlight(v: unknown): unknown {
  if (typeof v === "string") return v.startsWith("$$") ? v.slice(1) : v;
  if (Array.isArray(v)) return v.map(unescapeFlight);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unescapeFlight(x)]));
  return v;
}

/**
 * Next.js App Router pages stream their data as self.__next_f.push([1, "..."])
 * inline scripts. The window copy is consumed during hydration, so read the HTML.
 */
export function flightFromHtml(html: string): string {
  let text = "";
  for (const m of html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)\s*<\/script>/g)) {
    try {
      const chunk = JSON.parse(m[1]);
      if (typeof chunk[1] === "string") text += chunk[1];
    } catch {
      // Not a data chunk.
    }
  }
  return text;
}

/**
 * Splits a Next.js flight payload into its JSON rows. Rows are "<hex id>:<json>\n",
 * except text rows "<hex id>:T<hex byte length>,<text>" which have no newline.
 */
export function parseFlight(text: string): Captured[] {
  const rows: Captured[] = [];
  const buf = Buffer.from(text, "utf8");
  let pos = 0;
  while (pos < buf.length) {
    const colon = buf.indexOf(":", pos);
    if (colon < 0) break;
    const id = buf.toString("utf8", pos, colon);
    if (!/^[0-9a-f]+$/.test(id)) {
      // Lost sync; resume at the next line.
      const nl = buf.indexOf("\n", pos);
      if (nl < 0) break;
      pos = nl + 1;
      continue;
    }
    if (buf[colon + 1] === 0x54 /* T */) {
      const comma = buf.indexOf(",", colon);
      const length = parseInt(buf.toString("utf8", colon + 2, comma), 16);
      pos = comma + 1 + (Number.isFinite(length) ? length : 0);
      continue;
    }
    let nl = buf.indexOf("\n", colon);
    if (nl < 0) nl = buf.length;
    const payload = buf.toString("utf8", colon + 1, nl);
    if (payload.startsWith("[") || payload.startsWith("{")) {
      try {
        rows.push({ url: `embedded:flight:${id}`, body: unescapeFlight(JSON.parse(payload)) });
      } catch {
        // Partial row.
      }
    }
    pos = nl + 1;
  }
  return rows;
}

function isChallenge(title: string): boolean {
  return /just a moment|attention required|security verification/i.test(title);
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
    let title = await page.title();
    if (isChallenge(title) && process.env.HEADED === "1" && process.env.USE_CHROME === "1") {
      // Interactive local run: give the person at the keyboard time to pass the check.
      console.log(`  Bot check on ${page.url()}. If a checkbox appears in the browser window, click it (waiting up to 2 min)...`);
      const deadline = Date.now() + 120_000;
      while (isChallenge(title) && Date.now() < deadline) {
        await page.waitForTimeout(2_000);
        title = await page.title().catch(() => title);
      }
      if (!isChallenge(title)) {
        await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
        if (opts.interact) await opts.interact(page);
        await page.waitForTimeout(opts.waitMs ?? 5_000);
      }
    }
    if (isChallenge(title)) throw new Error(`Blocked by bot protection at ${page.url()}`);
    await scrollThrough(page);
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
    const html = await page.content();
    captured.push(...(await embeddedJson(page)), ...parseFlight(flightFromHtml(html)));
    return { captured, finalUrl: page.url(), title, html };
  } finally {
    await context.close();
  }
}
