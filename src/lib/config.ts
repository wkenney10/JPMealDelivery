export const BUSINESS_NAME = "JP Meal Delivery";

export const TIMEZONE = "America/New_York";

/** Flat delivery fee charged once per restaurant in an order. */
export const DELIVERY_FEE_PER_RESTAURANT = 500;

/** Massachusetts meals tax as charged in Boston: 6.25% state + 0.75% local option. */
export const MEALS_TAX_RATE = 0.07;

/** Orders for a given evening close at this local time on that day. */
export const ORDER_CUTOFF_MINUTES = 16 * 60;

export const DELIVERY_START_MINUTES = 17 * 60;
export const DELIVERY_END_MINUTES = 21 * 60;
export const SLOT_LENGTH_MINUTES = 30;

/** How many days after today customers can pre-order for. */
export const DAYS_AHEAD = 6;

export const DELIVERY_ZIPS = ["02130"];

/** A scraped menu older than this is flagged in the admin. */
export const STALE_MENU_DAYS = 8;
