"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo } from "react";
import { LOCALE_COOKIE, LOCALES, translator, type Locale, type Translate } from "./index";

const I18nContext = createContext<{ locale: Locale; t: Translate } | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  const value = useMemo(() => ({ locale, t: translator(locale) }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

/** EN | ES switch. Saves the choice in a cookie and re-renders the page. */
export function LanguageToggle() {
  const { locale, t } = useI18n();
  const router = useRouter();

  function choose(next: Locale) {
    if (next === locale) return;
    try {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    } catch {
      // Cookies blocked: the switch still works for this page view after refresh fails silently.
    }
    router.refresh();
  }

  return (
    <div role="group" aria-label={t("header.language")} className="flex items-center text-xs font-semibold tracking-[0.1em]">
      {LOCALES.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span className="mx-1.5 text-muted">|</span>}
          <button
            type="button"
            lang={l}
            aria-pressed={l === locale}
            onClick={() => choose(l)}
            className={l === locale ? "text-ink underline decoration-brand decoration-2 underline-offset-4" : "text-muted hover:text-ink"}
          >
            {l.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}
