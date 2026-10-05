// All money values are integer cents.

export type Platform =
  | "toast"
  | "slice"
  | "chownow"
  | "clover"
  | "doordash"
  | "square"
  | "menuapp"
  | "manual";

export interface Restaurant {
  slug: string;
  name: string;
  cuisine: string;
  address: string;
  zip: string;
  website?: string;
  orderUrl: string;
  platform: Platform;
  platformConfig?: Record<string, string>;
  fees?: {
    serviceFeePercent?: number;
    serviceFeeFlat?: number; // cents
  };
  feesVerified?: boolean;
  closedDays?: number[]; // 0 = Sunday
  lastPickup?: string; // "HH:MM", latest slot start the restaurant can serve
  active: boolean;
  notes?: string;
  /** Overrides for `npm run logos`. */
  logo?: {
    url?: string; // use this image instead of searching
    threshold?: number; // 0–1, higher drops more of a busy background
    invert?: boolean; // transparent logos drawn in white: treat light pixels as ink
    mode?: "ink" | "original"; // "original" keeps the logo's own colours
    disabled?: boolean; // always use the typographic house mark
  };
}

export interface MenuOption {
  id: string;
  name: string;
  price: number; // added to the item price
}

export interface MenuOptionGroup {
  id: string;
  name: string;
  min: number;
  max: number; // 0 = unlimited
  options: MenuOption[];
}

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  optionGroups?: MenuOptionGroup[];
}

export interface MenuCategory {
  name: string;
  items: MenuItem[];
}

export interface Menu {
  restaurant: string;
  source: "scraped" | "manual";
  platform: Platform;
  sourceUrl: string;
  fetchedAt: string; // ISO timestamp of the scrape (or manual edit)
  // Pickup hours seen on the ordering site, if the platform exposes them.
  dinnerAvailable?: boolean;
  categories: MenuCategory[];
}

export interface CartLine {
  key: string; // client-side identity for the line
  restaurant: string;
  itemId: string;
  quantity: number;
  optionIds: string[];
  notes?: string;
}
