import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveLocale, translator } from "../src/i18n";
import { flatten } from "../src/i18n/flatten";
import { en } from "../src/i18n/messages/en";
import { es } from "../src/i18n/messages/es";

const enFlat = flatten(en);
const esFlat = flatten(es);
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("Spanish translations", () => {
  it("cover every English key and nothing else", () => {
    expect(Object.keys(esFlat).sort()).toEqual(Object.keys(enFlat).sort());
  });

  it("use the same {placeholders} as the English", () => {
    const mismatched = Object.keys(enFlat).filter(
      (k) => k in esFlat && placeholders(enFlat[k]).join() !== placeholders(esFlat[k]).join(),
    );
    expect(mismatched).toEqual([]);
  });

  it("are up to date with the English they translate", () => {
    // If this fails, English copy changed: update es.ts to match, then run `npm run i18n:sync`.
    const source = JSON.parse(
      fs.readFileSync(path.join(__dirname, "../src/i18n/messages/es.source.json"), "utf8"),
    ) as Record<string, string>;
    const stale = Object.keys(enFlat)
      .filter((k) => source[k] !== enFlat[k])
      .map((k) => `${k}: English is now "${enFlat[k]}" (Spanish was written for "${source[k] ?? "(new key)"}")`);
    expect(stale).toEqual([]);
  });
});

describe("translator", () => {
  it("fills placeholders and picks plural forms", () => {
    expect(translator("es")("header.items", { count: 1 })).toBe("1 artículo");
    expect(translator("es")("header.items", { count: 4 })).toBe("4 artículos");
    expect(translator("en")("home.deliveryText", { fee: "$5" })).toBe("$5 per restaurant, flat. 02130 only");
  });

  it("chooses a language from the saved choice, then the browser", () => {
    expect(resolveLocale("es", "en-US")).toBe("es");
    expect(resolveLocale(undefined, "es-419,es;q=0.9,en;q=0.8")).toBe("es");
    expect(resolveLocale(undefined, "en-US,en;q=0.9,es;q=0.5")).toBe("en");
    expect(resolveLocale(undefined, "fr-FR")).toBe("en");
    expect(resolveLocale("de", null)).toBe("en");
  });
});
