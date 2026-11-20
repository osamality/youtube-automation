import { describe, expect, it } from "vitest";
import { type Booking, planSlots } from "../src/schedule";
import { formatSlot } from "../src/time";

/** Tuesday 10/11/2026, 12:00 in Dubai. */
const NOW = new Date("2026-11-10T08:00:00Z");
const PUBLISH = { days: ["tue", "thu", "sat"], time: "15:00", timezone: "America/New_York" };
const BOOKED: Booking[] = [
  { video: "nvidia", format: "long", at: "2026-11-10T01:30:00.000Z" },
  { video: "nvidia", format: "short", at: "2026-11-11T20:00:00.000Z" },
  { video: "intel", format: "long", at: "2026-11-12T20:00:00.000Z" },
  { video: "intel", format: "short", at: "2026-11-13T20:00:00.000Z" },
];
const gulf = (d: Date | null) => (d ? formatSlot(d, "Asia/Dubai") : null);

describe("planSlots", () => {
  it("puts a new video on the next publishing day after the last booked long video", () => {
    const slots = planSlots({
      bookings: BOOKED,
      video: "tsmc",
      now: NOW,
      publish: PUBLISH,
      shorts: true,
    });
    expect(gulf(slots.long)).toBe("Sun 15/11/2026, 00:00");
    expect(gulf(slots.short)).toBe("Mon 16/11/2026, 00:00");
    expect(slots.bookings).toHaveLength(6);
  });

  it("keeps a video's own future booking", () => {
    const slots = planSlots({
      bookings: BOOKED,
      video: "intel",
      now: NOW,
      publish: PUBLISH,
      shorts: true,
    });
    expect(gulf(slots.long)).toBe("Fri 13/11/2026, 00:00");
    expect(gulf(slots.short)).toBe("Sat 14/11/2026, 00:00");
    expect(slots.bookings).toHaveLength(4);
  });

  it("keeps the bookings of a video that is already public", () => {
    const slots = planSlots({
      bookings: BOOKED,
      video: "nvidia",
      now: NOW,
      publish: PUBLISH,
      shorts: true,
    });
    expect(slots.long.toISOString()).toBe("2026-11-10T01:30:00.000Z");
    expect(gulf(slots.short)).toBe("Thu 12/11/2026, 00:00");
    expect(slots.bookings).toHaveLength(4);
  });

  it("moves a Short to the next free day", () => {
    const busy: Booking[] = [
      ...BOOKED,
      { video: "extra", format: "short", at: "2026-11-15T20:00:00.000Z" },
    ];
    const slots = planSlots({
      bookings: busy,
      video: "tsmc",
      now: NOW,
      publish: PUBLISH,
      shorts: true,
    });
    expect(gulf(slots.short)).toBe("Tue 17/11/2026, 00:00");
  });
});
