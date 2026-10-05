import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { logoCandidatesFromHtml, toInk } from "../scraper/logos";

// Builds a test image from a character map: '.' transparent, 'k' black, 'w' white, 'y' yellow, 'g' green.
async function image(rows: string[], scale = 8): Promise<Buffer> {
  const colors: Record<string, number[]> = { ".": [0, 0, 0, 0], k: [0, 0, 0, 255], w: [255, 255, 255, 255], y: [250, 200, 0, 255], g: [20, 140, 60, 255] };
  const h = rows.length;
  const w = rows[0].length;
  const raw = Buffer.alloc(w * h * 4);
  rows.forEach((row, y) => [...row].forEach((ch, x) => raw.set(colors[ch], (y * w + x) * 4)));
  return sharp(raw, { raw: { width: w, height: h, channels: 4 } }).resize(w * scale, h * scale, { kernel: "nearest" }).png().toBuffer();
}

async function alphaAt(png: Buffer, fx: number, fy: number): Promise<number> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const x = Math.floor(fx * (info.width - 1));
  const y = Math.floor(fy * (info.height - 1));
  return data[(y * info.width + x) * 4 + 3];
}

describe("toInk", () => {
  it("keeps enclosed white as paper but prints white strokes that touch the outside", async () => {
    const src = await image([
      "..........",
      ".kkkkk.ww.",
      ".kwwwk.ww.",
      ".kwwwk.ww.",
      ".kkkkk.ww.",
      "..........",
    ]);
    const out = await toInk(src);
    expect(out).toBeDefined();
    expect(await alphaAt(out!.png, 0.05, 0.5)).toBeGreaterThan(200); // black frame
    expect(await alphaAt(out!.png, 0.3, 0.5)).toBe(0); // white enclosed by the frame
    expect(await alphaAt(out!.png, 0.95, 0.5)).toBeGreaterThan(200); // free-standing white stroke
  });

  it("turns a coloured badge into a stamp with knocked-out lettering", async () => {
    const src = await image([
      "wwwwwwwwww",
      "wyyyyyyyyw",
      "wyggyyggyw",
      "wyggyyggyw",
      "wyyyyyyyyw",
      "wwwwwwwwww",
    ]);
    const out = await toInk(src);
    expect(out).toBeDefined();
    expect(await alphaAt(out!.png, 0.02, 0.02)).toBeGreaterThan(200); // yellow badge is ink
    expect(await alphaAt(out!.png, 0.2, 0.5)).toBe(0); // green lettering knocked out
  });

  it("rejects a blank image", async () => {
    expect(await toInk(await image(["www", "www"]))).toBeUndefined();
  });
});

describe("logoCandidatesFromHtml", () => {
  it("prefers header logos and resolves relative URLs", () => {
    const html = `<html><body>
      <img src="/hero.jpg" alt="Dinner">
      <header><a href="/"><img src="/img/brand-mark.png" class="site-logo"></a></header>
      <footer><img src="/favicon.ico" alt="logo"></footer>
      <link rel="apple-touch-icon" href="/touch.png"></body></html>`;
    expect(logoCandidatesFromHtml(html, "https://example.com/")).toEqual([
      "https://example.com/img/brand-mark.png",
      "https://example.com/touch.png",
    ]);
  });
});
