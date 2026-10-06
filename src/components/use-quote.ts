"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/client";
import type { Quote } from "@/lib/pricing";
import { toCartLines, type CartEntry } from "./cart-context";

/** Server-side price check of the cart against the current menus. */
export function useQuote(entries: CartEntry[], ready: boolean) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { locale, t } = useI18n();
  const body = JSON.stringify({ lines: toCartLines(entries) });

  useEffect(() => {
    if (!ready) return;
    const ctrl = new AbortController();
    setLoading(true);
    fetch("/api/quote", { method: "POST", headers: { "content-type": "application/json" }, body, signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("quote failed"))))
      .then((q: Quote) => {
        setQuote(q);
        setError(null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(t("cart.checkPricesFailed"));
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
    // locale: the server words its messages in the visitor's language.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body, ready, locale]);

  return { quote, setQuote, loading, error };
}
