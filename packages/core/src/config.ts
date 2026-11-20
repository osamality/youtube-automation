import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { paths } from "./paths";

export const CHANNEL_ID_PATTERN = /^[a-z0-9][a-z0-9-]{1,39}$/;
const CHANNEL_ID_RULE =
  "use 2–40 lowercase letters, digits or dashes, starting with a letter or digit";

export const FORMATS = ["long", "shorts"] as const;
export const VOICE_PROVIDERS = ["kokoro", "elevenlabs"] as const;

const text = () => z.string().trim().min(1, "must not be empty");
const languageCode = () => z.string().trim().min(2);

const VoiceSchema = z.strictObject({
  provider: z.enum(VOICE_PROVIDERS),
  id: text(),
  speed: z.number().min(0.5).max(2).default(1),
});

/** A strand of videos on one channel with its own narrator, e.g. the same subject for two audiences. */
const SeriesSchema = z.strictObject({
  id: z.string().regex(CHANNEL_ID_PATTERN, CHANNEL_ID_RULE),
  name: text(),
  /** Language the narrator speaks in this series. */
  narration: languageCode(),
  audience: text(),
  /** Replaces the channel voice for this series. */
  voice: VoiceSchema.optional(),
});

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** YouTube's upload categories that fit these channels. */
export const YOUTUBE_CATEGORIES = [
  "Education",
  "Science & Technology",
  "Entertainment",
  "Film & Animation",
  "Howto & Style",
  "News & Politics",
  "People & Blogs",
] as const;

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Upload defaults for every video on the channel (used by upload/UPLOAD.md). */
const YouTubeSchema = z
  .strictObject({
    category: z.enum(YOUTUBE_CATEGORIES).default("Education"),
    /** Phone-verified at youtube.com/verify. Unverified channels can't upload videos over 15 minutes. */
    verified: z.boolean().default(false),
    /** Added to every video's own tags. */
    tags: z.array(text()).max(10).default([]),
    /** Shorts must run between these lengths, in seconds (house rule: 20–40). */
    short_min_seconds: z.number().int().min(1).max(180).default(20),
    short_max_seconds: z.number().int().min(1).max(180).default(40),
    /** New videos go public on the next of these weekdays, at this time in this time zone. */
    publish: z
      .strictObject({
        days: z.array(z.enum(WEEKDAYS)).min(1).default(["tue", "wed", "thu"]),
        time: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "use HH:MM, e.g. 15:00")
          .default("15:00"),
        timezone: text()
          .refine(isTimeZone, "use a time zone name, e.g. America/New_York or Asia/Dubai")
          .default("America/New_York"),
      })
      .prefault({}),
  })
  .prefault({});

export const ChannelSchema = z.strictObject({
  id: z.string().regex(CHANNEL_ID_PATTERN, CHANNEL_ID_RULE),
  name: text(),
  /** Language the default narrator speaks. */
  language: languageCode(),
  audience: text(),
  tone: text(),
  /** Audience under 13. Uploads set YouTube's "made for kids" flag (COPPA). */
  made_for_kids: z.boolean().default(false),
  formats: z.array(z.enum(FORMATS)).min(1),
  voice: VoiceSchema,
  theme: z.strictObject({
    palette: text(),
    font: text(),
  }),
  mascot: text().optional(),
  /** Where the corner mascot shows: every scene, or only hook and tip scenes. */
  mascot_corner: z.enum(["always", "hooks"]).default("always"),
  /** Sound effects on/off and background music level. Music tracks live in assets/music/. */
  sound: z
    .strictObject({
      sfx: z.boolean().default(true),
      music_volume: z.number().min(0).max(1).default(0.15),
    })
    .prefault({}),
  templates: z.array(text()).min(1),
  series: z
    .array(SeriesSchema)
    .min(1)
    .optional()
    .refine((list) => !list || new Set(list.map((s) => s.id)).size === list.length, {
      message: "series ids must be unique",
    }),
  schedule: z.strictObject({
    long_per_week: z.number().int().min(0),
    shorts_per_day: z.number().int().min(0),
  }),
  youtube: YouTubeSchema,
  youtube_token: text().optional(),
});

export type Channel = z.infer<typeof ChannelSchema>;

export class ChannelConfigError extends Error {
  constructor(
    readonly channelId: string,
    readonly problems: string[],
  ) {
    super(
      `channels/${channelId}/channel.yaml is invalid:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
    this.name = "ChannelConfigError";
  }
}

export function channelExists(id: string): boolean {
  return fs.existsSync(paths.channelConfig(id));
}

/** Reads and validates channels/<id>/channel.yaml. Throws ChannelConfigError with every problem found. */
export function loadChannel(id: string): Channel {
  const file = paths.channelConfig(id);
  if (!fs.existsSync(file)) {
    throw new ChannelConfigError(id, ["file not found"]);
  }

  let raw: unknown;
  try {
    raw = parseYaml(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new ChannelConfigError(id, [`YAML syntax: ${(err as Error).message}`]);
  }

  const result = ChannelSchema.safeParse(raw);
  if (!result.success) {
    throw new ChannelConfigError(
      id,
      result.error.issues.map((i) => `${i.path.join(".") || "(file)"}: ${i.message}`),
    );
  }
  if (result.data.id !== id) {
    throw new ChannelConfigError(id, [
      `id: "${result.data.id}" must match the folder name "${id}"`,
    ]);
  }
  return result.data;
}

export type ChannelEntry =
  | { id: string; ok: true; channel: Channel }
  | { id: string; ok: false; error: string };

/** Every folder under channels/ (except _hidden and .dot folders), valid or not. */
export function listChannels(): ChannelEntry[] {
  const dir = paths.channels();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith(".") && !d.name.startsWith("_"))
    .map((d) => d.name)
    .sort()
    .map((id): ChannelEntry => {
      try {
        return { id, ok: true, channel: loadChannel(id) };
      } catch (err) {
        return { id, ok: false, error: (err as Error).message };
      }
    });
}

/** Loads a channel, with a helpful message when the id is unknown. */
export function requireChannel(id: string): Channel {
  if (!channelExists(id)) {
    const known = listChannels().map((c) => c.id);
    const hint = known.length
      ? `Known channels: ${known.join(", ")}`
      : 'Create one with: yt channel add <id> --name "<name>"';
    throw new Error(`No channel "${id}". ${hint}`);
  }
  return loadChannel(id);
}

const PLACEHOLDER_FILES = new Set([".yaml", ".md"]);

/** Copies the channel template to channels/<id>/ and fills in id and name. */
export function createChannel(id: string, name: string): Channel {
  if (!CHANNEL_ID_PATTERN.test(id)) {
    throw new Error(`Invalid channel id "${id}": ${CHANNEL_ID_RULE}.`);
  }
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Channel name must not be empty.");

  const target = paths.channel(id);
  if (fs.existsSync(target)) throw new Error(`channels/${id} already exists.`);

  fs.mkdirSync(paths.channels(), { recursive: true });
  fs.cpSync(paths.channelTemplate(), target, { recursive: true });

  try {
    for (const entry of fs.readdirSync(target, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !PLACEHOLDER_FILES.has(path.extname(entry.name))) continue;
      const file = path.join(entry.parentPath, entry.name);
      const filled = fs
        .readFileSync(file, "utf8")
        .replaceAll("__ID__", id)
        // JSON strings are valid YAML double-quoted strings, so names with quotes or colons stay safe.
        .replaceAll("__NAME__", file.endsWith(".yaml") ? JSON.stringify(cleanName) : cleanName);
      fs.writeFileSync(file, filled);
    }
    return loadChannel(id);
  } catch (err) {
    fs.rmSync(target, { recursive: true, force: true });
    throw err;
  }
}
