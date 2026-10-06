import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, translator, type Locale, type Translate } from "./index";

/** The visitor's language: their saved choice, else their browser's preference. */
export async function getLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerList.get("accept-language"));
}

export async function getTranslator(): Promise<{ locale: Locale; t: Translate }> {
  const locale = await getLocale();
  return { locale, t: translator(locale) };
}
