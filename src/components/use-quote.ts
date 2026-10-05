"use client";

import { useEffect, useState } from "react";
import type { Quote } from "@/lib/pricing";
import { toCartLines, type CartEntry } from "./cart-context";

/** Server-side price check of the cart against the current menus. */
export function useQuote(entries: CartEntry[], ready: boolean) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
        if (e.name !== "AbortError") setError("Couldn't check prices. Please refresh.");
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [body, ready]);

  return { quote, setQuote, loading, error };
}
