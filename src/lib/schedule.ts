import {
  DAYS_AHEAD,
  DELIVERY_END_MINUTES,
  DELIVERY_START_MINUTES,
  ORDER_CUTOFF_MINUTES,
  SLOT_LENGTH_MINUTES,
  TIMEZONE,
} from "./config";
import type { Restaurant } from "./types";

export interface Slot {
  id: string; // "17:30"
  start: number; // minutes after midnight
  label: string; // "5:30–6:00 PM"
}

type ScheduleRestaurant = Pick<Restaurant, "slug" | "name" | "closedDays" | "lastPickup">;

/** Current date (YYYY-MM-DD) and minutes-after-midnight in Jamaica Plain. */
export function localNow(now: Date): { date: string; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function toUtcDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(date: string, days: number): string {
  const t = toUtcDate(date);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

export function weekday(date: string): number {
  return toUtcDate(date).getUTCDay();
}

export function isValidDateString(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && toUtcDate(date).toISOString().slice(0, 10) === date;
}

function clock(minutes: number, withPeriod: boolean): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const base = `${h12}:${String(m).padStart(2, "0")}`;
  return withPeriod ? `${base} ${h24 < 12 ? "AM" : "PM"}` : base;
}

export function allSlots(): Slot[] {
  const slots: Slot[] = [];
  for (let s = DELIVERY_START_MINUTES; s + SLOT_LENGTH_MINUTES <= DELIVERY_END_MINUTES; s += SLOT_LENGTH_MINUTES) {
    const id = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    slots.push({ id, start: s, label: `${clock(s, false)}–${clock(s + SLOT_LENGTH_MINUTES, true)}` });
  }
  return slots;
}

export function slotLabel(slotId: string): string {
  return allSlots().find((s) => s.id === slotId)?.label ?? slotId;
}

export function formatDate(date: string, today?: string): string {
  const label = toUtcDate(date).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (today && date === today) return `Today (${label})`;
  if (today && date === addDays(today, 1)) return `Tomorrow (${label})`;
  return label;
}

/** Delivery dates still open for ordering, earliest first. */
export function orderableDates(now: Date): string[] {
  const { date: today, minutes } = localNow(now);
  const dates: string[] = [];
  for (let i = minutes < ORDER_CUTOFF_MINUTES ? 0 : 1; i <= DAYS_AHEAD; i++) {
    dates.push(addDays(today, i));
  }
  return dates;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function restaurantServes(r: ScheduleRestaurant, date: string, slot: Slot): boolean {
  if (r.closedDays?.includes(weekday(date))) return false;
  if (r.lastPickup && slot.start > toMinutes(r.lastPickup)) return false;
  return true;
}

/** Slots on `date` that every restaurant in the order can serve. */
export function slotsFor(date: string, restaurants: ScheduleRestaurant[]): Slot[] {
  return allSlots().filter((slot) => restaurants.every((r) => restaurantServes(r, date, slot)));
}

/** Returns an error message, or null when the delivery choice is acceptable. */
export function validateDelivery(
  now: Date,
  date: string,
  slotId: string,
  restaurants: ScheduleRestaurant[],
): string | null {
  if (!isValidDateString(date)) return "Choose a delivery date.";
  if (!orderableDates(now).includes(date)) {
    return localNow(now).date === date
      ? "Orders for tonight closed at 4:00 PM. Please choose another day."
      : "That delivery date isn't available.";
  }
  const slot = allSlots().find((s) => s.id === slotId);
  if (!slot) return "Choose a delivery time.";
  const closed = restaurants.filter((r) => !restaurantServes(r, date, slot));
  if (closed.length) {
    return `${closed.map((r) => r.name).join(", ")} can't fill orders for ${formatDate(date)} at ${slot.label}.`;
  }
  return null;
}
