import type { en } from "./messages/en";

export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "lang";

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

/** The shape every language's messages must have (same keys as English). */
export type Messages = Widen<typeof en>;

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = { [K in keyof T]: T[K] extends string ? K : T[K] extends { one: string } ? K : Join<K, Paths<T[K]>> }[keyof T];

/** A message key such as "cart.title". Keys with { one, other } take a `count`. */
export type MessageKey = Paths<Messages>;

export type Vars = Record<string, string | number>;
export type Translate = (key: MessageKey, vars?: Vars) => string;
