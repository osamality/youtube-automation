import fs from "node:fs";
import path from "node:path";
import { paths } from "./paths";
import { nextSlot, TIME_ZONE, zonedParts } from "./time";

/**
 * Publish slots already taken on a channel, kept in data/<channel>/schedule.json so each new
 * upload kit picks the next free slot instead of one that clashes with a video already planned.
 */

export interface Booking {
  /** Video folder, relative to the repo root. */
  video: string;
  format: "long" | "short";
  /** ISO time the video goes public. */
  at: string;
}

export function scheduleFile(channelId: string): string {
  return path.join(paths.data(), channelId, "schedule.json");
}

export function readSchedule(channelId: string): Booking[] {
  const file = scheduleFile(channelId);
  if (!fs.existsSync(file)) return [];
  return (JSON.parse(fs.readFileSync(file, "utf8")) as { bookings: Booking[] }).bookings;
}

export function writeSchedule(channelId: string, bookings: Booking[]): void {
  const file = scheduleFile(channelId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sorted = [...bookings].sort((a, b) => a.at.localeCompare(b.at));
  fs.writeFileSync(file, `${JSON.stringify({ bookings: sorted }, null, 2)}\n`);
}

const DAY = 86_400_000;
const gulfDay = (d: Date) => {
  const p = zonedParts(d, TIME_ZONE);
  return `${p.year}-${p.month}-${p.day}`;
};

/**
 * Slots for one video. The video's own bookings are kept, past ones too: a past booking means the
 * video is already public, so rebuilding its kit must not move it. Otherwise the long video takes
 * the channel's next publishing day after every other booked long video, and its Short the day
 * after, moved on a day at a time while another Short is booked for that Gulf day.
 */
export function planSlots(opts: {
  bookings: Booking[];
  video: string;
  now: Date;
  publish: { days: readonly string[]; time: string; timezone: string };
  shorts: boolean;
}): { long: Date; short: Date | null; bookings: Booking[] } {
  const own = opts.bookings.filter((b) => b.video === opts.video);
  const others = opts.bookings.filter((b) => b.video !== opts.video);
  const ownLong = own.find((b) => b.format === "long");
  const ownShort = own.find((b) => b.format === "short");

  let long: Date;
  if (ownLong) {
    long = new Date(ownLong.at);
  } else {
    const lastLong = Math.max(
      0,
      ...others.filter((b) => b.format === "long").map((b) => new Date(b.at).getTime()),
    );
    const earliest = Math.max(opts.now.getTime() + 12 * 3_600_000, lastLong + 60_000);
    long = nextSlot(new Date(earliest), opts.publish, 0);
  }

  let short: Date | null = null;
  if (opts.shorts) {
    if (ownShort && new Date(ownShort.at) > long) {
      short = new Date(ownShort.at);
    } else {
      const taken = new Set(
        others.filter((b) => b.format === "short").map((b) => gulfDay(new Date(b.at))),
      );
      short = new Date(long.getTime() + DAY);
      while (taken.has(gulfDay(short))) short = new Date(short.getTime() + DAY);
    }
  }

  const bookings: Booking[] = [
    ...others,
    { video: opts.video, format: "long", at: long.toISOString() },
    ...(short ? [{ video: opts.video, format: "short" as const, at: short.toISOString() }] : []),
  ];
  return { long, short, bookings };
}
