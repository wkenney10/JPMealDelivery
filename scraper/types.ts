import type { MenuCategory } from "../src/lib/types";

export interface ScrapeResult {
  categories: MenuCategory[];
  /** false when the ordering site shows the restaurant isn't open at dinner time. */
  dinnerAvailable?: boolean;
  /** Pickup schedule from the ordering site, when it publishes one. */
  closedDays?: number[];
  lastPickup?: string;
}
