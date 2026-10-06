import { en } from "./messages/en";
import { es } from "./messages/es";
import { DEFAULT_LOCALE, LOCALES, type Locale, type Messages, type MessageKey, type Translate, type Vars } from "./types";

export * from "./types";

const DICTIONARIES: Record<Locale, Messages> = { en, es };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Picks a locale from a saved choice, else the browser's Accept-Language header. */
export function resolveLocale(saved: string | undefined, acceptLanguage: string | null | undefined): Locale {
  if (isLocale(saved)) return saved;
  const preferred = (acceptLanguage ?? "")
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.slice(0, 2).toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q)
    .find((p) => isLocale(p.lang));
  return preferred ? (preferred.lang as Locale) : DEFAULT_LOCALE;
}

function lookup(messages: Messages, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => (node && typeof node === "object" ? (node as Record<string, unknown>)[part] : undefined), messages);
}

/** Returns t(key, vars) for a locale. Missing Spanish text falls back to English. */
export function translator(locale: Locale): Translate {
  const pluralRules = new Intl.PluralRules(locale);
  return (key: MessageKey, vars?: Vars) => {
    let entry = lookup(DICTIONARIES[locale], key) ?? lookup(en as Messages, key);
    if (entry && typeof entry === "object") {
      const forms = entry as Record<string, string>;
      const count = Number(vars?.count ?? 0);
      entry = forms[pluralRules.select(count)] ?? forms.other;
    }
    const text = typeof entry === "string" ? entry : key;
    return vars ? text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m)) : text;
  };
}

/** BCP 47 tag for date and number formatting. */
export function intlLocale(locale: Locale): string {
  return locale === "es" ? "es-US" : "en-US";
}
