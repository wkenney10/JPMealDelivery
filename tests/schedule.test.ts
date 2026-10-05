import { describe, expect, it } from "vitest";
import { addDays, allSlots, localNow, orderableDates, slotsFor, validateDelivery, weekday } from "../src/lib/schedule";

// 2026-10-05 is a Monday; Boston is on EDT (UTC-4).
const at = (local: string) => new Date(`${local}-04:00`);

describe("slots", () => {
  it("offers eight 30-minute slots from 5 to 9 PM", () => {
    const slots = allSlots();
    expect(slots.map((s) => s.id)).toEqual(["17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30"]);
    expect(slots[0].label).toBe("5:00–5:30 PM");
    expect(slots.at(-1)!.label).toBe("8:30–9:00 PM");
  });
});

describe("order cutoff", () => {
  it("uses Boston local time", () => {
    expect(localNow(new Date("2026-10-05T19:59:00Z"))).toEqual({ date: "2026-10-05", minutes: 15 * 60 + 59 });
    expect(localNow(new Date("2026-10-06T02:00:00Z")).date).toBe("2026-10-05");
  });

  it("allows tonight before 4 PM, plus six days ahead", () => {
    const dates = orderableDates(at("2026-10-05T15:59"));
    expect(dates[0]).toBe("2026-10-05");
    expect(dates).toHaveLength(7);
    expect(dates.at(-1)).toBe("2026-10-11");
  });

  it("closes tonight at 4 PM", () => {
    const dates = orderableDates(at("2026-10-05T16:00"));
    expect(dates[0]).toBe("2026-10-06");
    expect(validateDelivery(at("2026-10-05T16:01"), "2026-10-05", "18:00", [])).toMatch(/closed at 4:00 PM/);
    expect(validateDelivery(at("2026-10-05T15:30"), "2026-10-05", "18:00", [])).toBeNull();
  });

  it("rejects past dates, far-future dates and unknown slots", () => {
    const now = at("2026-10-05T10:00");
    expect(validateDelivery(now, "2026-10-04", "18:00", [])).not.toBeNull();
    expect(validateDelivery(now, "2026-10-20", "18:00", [])).not.toBeNull();
    expect(validateDelivery(now, "2026-10-06", "21:00", [])).not.toBeNull();
    expect(validateDelivery(now, "not-a-date", "18:00", [])).not.toBeNull();
  });
});

describe("restaurant availability", () => {
  const mondayClosed = { slug: "x", name: "Closed Mondays", closedDays: [1] };
  const early = { slug: "y", name: "Early Closer", lastPickup: "19:00" };

  it("handles weekdays", () => {
    expect(weekday("2026-10-05")).toBe(1);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("drops days a restaurant is closed and slots after its last pickup", () => {
    expect(slotsFor("2026-10-05", [mondayClosed])).toHaveLength(0);
    expect(slotsFor("2026-10-06", [mondayClosed])).toHaveLength(8);
    expect(slotsFor("2026-10-06", [early]).map((s) => s.id).at(-1)).toBe("19:00");
    const now = at("2026-10-05T09:00");
    expect(validateDelivery(now, "2026-10-05", "18:00", [mondayClosed])).toMatch(/Closed Mondays/);
    expect(validateDelivery(now, "2026-10-06", "20:00", [early])).toMatch(/Early Closer/);
  });
});
