/** All dates shown to people are in Gulf Standard Time. Storage is UTC ISO-8601. */
export const TIME_ZONE = "Asia/Dubai";

export function nowIso(): string {
  return new Date().toISOString();
}

function gstParts(date: Date): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((p) => [p.type, p.value]));
}

/** "DD/MM/YYYY HH:mm" in GST. */
export function formatDateTime(iso: string): string {
  const p = gstParts(new Date(iso));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** "YYYY-MM-DD" in GST — for folder names, because it sorts correctly. */
export function folderDate(date: Date = new Date()): string {
  const p = gstParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function slugify(text: string, maxLength = 60): string {
  const slug = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/, "");
  return slug || "video";
}

/** Calendar date, time and weekday of `date` in `timeZone`. */
export function zonedParts(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; hour: number; minute: number; weekday: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: String(parts.weekday).slice(0, 3).toLowerCase(),
  };
}

/** The moment it is `hour:minute` on that calendar day in `timeZone`. */
export function zonedInstant(
  day: { year: number; month: number; day: number },
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const wanted = Date.UTC(day.year, day.month - 1, day.day, hour, minute);
  let guess = wanted;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess), timeZone);
    guess += wanted - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  }
  return new Date(guess);
}

/**
 * The first slot at least `leadHours` from now on one of `days`, at `time` (HH:MM) in `timeZone`.
 * Leaves time to upload and for YouTube to finish HD processing.
 */
export function nextSlot(
  now: Date,
  publish: { days: readonly string[]; time: string; timezone: string },
  leadHours = 12,
): Date {
  const [hour = 0, minute = 0] = publish.time.split(":").map(Number);
  const earliest = now.getTime() + leadHours * 3_600_000;
  for (let i = 0; i < 16; i++) {
    const day = zonedParts(new Date(now.getTime() + i * 86_400_000), publish.timezone);
    const at = zonedInstant(day, hour, minute, publish.timezone);
    const weekday = zonedParts(at, publish.timezone).weekday;
    if (at.getTime() >= earliest && publish.days.includes(weekday)) return at;
  }
  throw new Error(`no publish day in ${publish.days.join(", ")}`);
}

/** "Thu 12/11/2026, 00:00" in `timeZone`. */
export function formatSlot(date: Date, timeZone: string): string {
  const p = zonedParts(date, timeZone);
  const two = (n: number) => String(n).padStart(2, "0");
  const weekday = p.weekday.charAt(0).toUpperCase() + p.weekday.slice(1);
  return `${weekday} ${two(p.day)}/${two(p.month)}/${p.year}, ${two(p.hour)}:${two(p.minute)}`;
}
