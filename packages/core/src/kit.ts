import { createHash } from "node:crypto";
import { type Format, FPS } from "@yt/templates/constants";
import type { RenderInput } from "@yt/templates/schema";
import {
  buildTimeline,
  chapterLines,
  chapterMarks,
  forFormat,
  SHORT_MAX_SECONDS,
  type Timeline,
  timestamp,
} from "@yt/templates/timeline";
import type { Channel } from "./config";
import { collectLogos } from "./logos";
import { formatSlot, nextSlot, TIME_ZONE } from "./time";

/**
 * The upload kit: everything YouTube Studio's upload form asks for, in the order it asks
 * (Details → Video elements → Checks → Visibility), plus the files to paste or attach.
 */

/** YouTube rejects descriptions over 5,000 bytes and comments over 10,000 characters. */
export const DESCRIPTION_MAX_BYTES = 5000;
export const COMMENT_MAX_CHARS = 10000;
/** Tags may total 500 characters; YouTube counts the commas and the quotes around tags with spaces. */
export const TAGS_MAX_CHARS = 500;
/** Videos longer than this need a phone-verified channel. */
export const UNVERIFIED_MAX_SECONDS = 15 * 60;

/** YouTube doesn't allow < or > in descriptions. */
const youtubeText = (lines: string[]) => `${lines.join("\n").replace(/[<>]/g, "").trim()}\n`;

function hashtagLine(input: RenderInput): string[] {
  const tags = input.plan.upload?.hashtags ?? [];
  return tags.length ? ["", tags.join(" ")] : [];
}

/**
 * Text for the YouTube description: the summary, chapter timestamps from the long video (when
 * YouTube would accept them), the plan's sources and hashtags. Sources that would push the
 * description past YouTube's limit move to `comment`, for the pinned comment.
 */
export function describeVideo(
  input: RenderInput,
  credits: string[] = [],
): {
  text: string;
  chapters: string[] | null;
  comment: string | null;
} {
  const timeline = buildTimeline(forFormat(input, "long"));
  const chapters = chapterLines(
    chapterMarks(timeline),
    Math.floor(timeline.durationInFrames / FPS),
  );
  // Summary, key figures, the comment question, chapters, then where the figures come from.
  const upload = input.plan.upload;
  const head = [input.plan.summary ?? input.plan.title, ""];
  if (upload?.keyFigures) head.push(upload.keyFigures, "");
  if (upload?.keyFigures && upload.question) head.push(upload.question, "");
  if (chapters) head.push("Chapters", ...chapters, "");
  if (upload?.figuresAsOf) head.push(upload.figuresAsOf, "");
  const tail = hashtagLine(input);
  const sources = (input.plan.sources ?? []).map((s) => `${s.label}: ${s.url}`);
  const sourceBlock = sources.length ? ["Sources", ...sources] : [];
  // Free-licence photos need a credit line; the description is where viewers look for it.
  const creditBlock = credits.length
    ? [...(sources.length ? [""] : []), "Photo credits", ...credits]
    : [];
  if (!sources.length && !credits.length)
    return { text: youtubeText([...head, ...tail]), chapters, comment: null };

  const fits = (t: string) => Buffer.byteLength(t) <= DESCRIPTION_MAX_BYTES;
  const full = youtubeText([...head, ...sourceBlock, ...creditBlock, ...tail]);
  if (fits(full)) return { text: full, chapters, comment: null };
  const creditsKept = youtubeText([
    ...head,
    "Sources: see the pinned comment.",
    ...(credits.length ? ["", "Photo credits", ...credits] : []),
    ...tail,
  ]);
  if (sources.length && fits(creditsKept))
    return { text: creditsKept, chapters, comment: youtubeText(sourceBlock) };
  return {
    text: youtubeText([...head, "Sources and photo credits: see the pinned comment.", ...tail]),
    chapters,
    comment: youtubeText([...sourceBlock, ...creditBlock]),
  };
}

/**
 * Identifies what a rendered video shows: the scenes, voice, theme and logos of one format, but not
 * the upload details (titles, summary, sources), which can change without a re-render.
 */
export function videoKey(input: RenderInput, format: Format): string {
  const own = forFormat(input, format);
  const { upload: _upload, summary: _summary, sources: _sources, ...plan } = own.plan;
  const used = new Set(collectLogos(plan.scenes));
  const logos = Object.fromEntries(
    Object.entries(own.logos ?? {}).filter(([slug]) => used.has(slug)),
  );
  // Shorts have no channel badge, so renaming the channel doesn't change them.
  const channelName = format === "short" ? null : own.channelName;
  return createHash("sha1")
    .update(JSON.stringify({ ...own, plan, logos, channelName }))
    .digest("hex");
}

/** One caption line, in frames. */
export interface Cue {
  start: number;
  end: number;
  text: string;
}

/**
 * Caption lines from the narration's word timings: up to `maxChars` per line, breaking at the
 * end of sentences and at pauses. Each line stays up a moment after its last word.
 */
export function captionCues(timeline: Timeline, maxChars = 42): Cue[] {
  const cues: Cue[] = [];
  for (const scene of timeline.scenes) {
    let words: { text: string; start: number; end: number }[] = [];
    const flush = () => {
      const first = words[0];
      const last = words[words.length - 1];
      if (first && last) {
        cues.push({ start: first.start, end: last.end, text: words.map((w) => w.text).join(" ") });
      }
      words = [];
    };
    for (const w of scene.words) {
      const prev = words[words.length - 1];
      const length = [...words, w].map((x) => x.text).join(" ").length;
      if (prev && (length > maxChars || w.start - prev.end > 15)) flush();
      words.push(w);
      if (/[.?!]["”']?$/.test(w.text)) flush();
    }
    flush();
  }
  return cues.map((cue, i) => {
    const next = cues[i + 1];
    const hold = cue.end + 8;
    return { ...cue, end: next ? Math.max(cue.start + 1, Math.min(hold, next.start)) : hold };
  });
}

function srtTime(frames: number): string {
  const ms = Math.round((frames / FPS) * 1000);
  const two = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor(ms / 60_000) % 60;
  const s = Math.floor(ms / 1000) % 60;
  return `${two(h)}:${two(m)}:${two(s)},${String(ms % 1000).padStart(3, "0")}`;
}

/** SubRip captions, the format YouTube's "Upload file → With timing" takes. */
export function toSrt(cues: Cue[]): string {
  return cues
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text}\n`)
    .join("\n");
}

/** Length of the tag list as YouTube counts it. */
export function tagsLength(tags: string[]): number {
  if (!tags.length) return 0;
  return tags.reduce((n, t) => n + t.length + (t.includes(" ") ? 2 : 0), 0) + tags.length - 1;
}

export type CheckStatus = "pass" | "fail" | "warn";
export interface Check {
  status: CheckStatus;
  text: string;
}

/** State of a rendered file, worked out by the caller (who can see the disk). */
export type RenderState = "ok" | "missing" | "stale";

export interface KitOptions {
  input: RenderInput;
  channel: Channel;
  /** Per format: is the .mp4 there and newer than plan.json and channel.yaml? */
  renders: Partial<Record<Format, RenderState>>;
  /** Thumbnail files and their sizes, or null when they weren't rendered this time. */
  thumbnails: { file: string; bytes: number }[] | null;
  now: Date;
  /** Publish slots from the channel's schedule (schedule.ts). Without them, the next free day is used. */
  slots?: { long: Date; short: Date | null };
  /** One credit line per Commons photo (photos.ts photoCreditLines). */
  photoCredits?: string[];
}

export interface Kit {
  markdown: string;
  description: string;
  /** Pinned comment: the question, then any sources that didn't fit. Null on kids' channels. */
  comment: string | null;
  shortDescription: string | null;
  captions: string;
  checks: Check[];
}

const THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;

/** The channel's Short length range in seconds, never past YouTube's 3-minute limit. */
export function shortRange(channel: Channel): [number, number] {
  const max = Math.min(channel.youtube.short_max_seconds, SHORT_MAX_SECONDS);
  return [Math.min(channel.youtube.short_min_seconds, max), max];
}

function languageName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function cityOf(timeZone: string): string {
  return (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
}

function seconds(timeline: Timeline): number {
  return Math.round(timeline.durationInFrames / FPS);
}

/** Builds the kit. Pure: the caller reads the disk and writes the files. */
export function buildKit(opts: KitOptions): Kit {
  const { input, channel } = opts;
  const plan = input.plan;
  const upload = plan.upload;
  const kids = channel.made_for_kids;
  const yt = channel.youtube;

  const longInput = forFormat(input, "long");
  const longTimeline = buildTimeline(longInput);
  const longSeconds = seconds(longTimeline);
  const makesShorts = channel.formats.includes("shorts");
  const shortSeconds = makesShorts ? seconds(buildTimeline(forFormat(input, "short"))) : 0;

  const {
    text: description,
    chapters,
    comment: overflow,
  } = describeVideo(input, opts.photoCredits ?? []);
  const parts = kids
    ? []
    : [upload?.question, overflow?.trim()].filter((p): p is string => Boolean(p));
  const pinned = parts.length ? youtubeText(parts.flatMap((p, i) => (i ? ["", p] : [p]))) : null;

  const titles = upload?.titles ?? [plan.title];
  const tags = [...(upload?.tags ?? []), ...yt.tags.filter((t) => !upload?.tags?.includes(t))];
  const endscreen = longInput.plan.scenes.find((s) => s.template === "endscreen");
  const endFrom = longTimeline.scenes.find((s) => s.scene.template === "endscreen")?.from;

  const slot = opts.slots?.long ?? nextSlot(opts.now, yt.publish);
  const shortSlot = opts.slots?.short ?? new Date(slot.getTime() + 86_400_000);
  const when = (d: Date) =>
    `${formatSlot(d, TIME_ZONE)} Gulf time (${formatSlot(d, yt.publish.timezone)} in ${cityOf(yt.publish.timezone)})`;

  // ---- checks -------------------------------------------------------------------------------
  const checks: Check[] = [];
  const add = (status: CheckStatus, text: string) => checks.push({ status, text });

  if (/working title/i.test(channel.name)) {
    add(
      "fail",
      `channel.yaml still has a working title ("${channel.name}"). The video badge shows it.`,
    );
  } else add("pass", `Channel name: ${channel.name}`);

  for (const format of ["long", "short"] as const) {
    if (format === "short" && !makesShorts) continue;
    const state = opts.renders[format];
    if (state === "missing") add("fail", `${format}.mp4 isn't rendered yet.`);
    else if (state === "stale")
      add("fail", `${format}.mp4 is older than plan.json or channel.yaml. Render it again.`);
    else if (state === "ok") add("pass", `${format}.mp4 is up to date.`);
  }

  if (!upload) {
    add(
      "fail",
      "plan.json has no upload section, so there are no thumbnails, extra titles or tags.",
    );
  }
  for (const t of titles) {
    if (t.length > 100) add("fail", `Title over 100 characters: "${t}"`);
  }
  if (titles.every((t) => t.length <= 100))
    add("pass", `${titles.length} title(s), all within 100 characters.`);

  const bytes = Buffer.byteLength(description);
  add(
    bytes <= DESCRIPTION_MAX_BYTES ? "pass" : "fail",
    `Description: ${bytes} of ${DESCRIPTION_MAX_BYTES} bytes.`,
  );
  if (pinned) {
    add(
      pinned.length <= COMMENT_MAX_CHARS ? "pass" : "fail",
      `Pinned comment: ${pinned.length} of ${COMMENT_MAX_CHARS} characters.`,
    );
  }
  const tagChars = tagsLength(tags);
  add(
    tagChars <= TAGS_MAX_CHARS ? "pass" : "fail",
    `Tags: ${tags.length} tags, ${tagChars} of ${TAGS_MAX_CHARS} characters.`,
  );

  if (chapters) add("pass", `${chapters.length} chapters in the description.`);
  else if (plan.scenes.some((s) => s.template === "chapter"))
    add(
      "warn",
      "Chapters don't meet YouTube's rules (3 or more, each 10 seconds or longer), so none are listed.",
    );

  if (opts.thumbnails === null) add("warn", "Thumbnails weren't rendered this time.");
  else {
    for (const t of opts.thumbnails) {
      if (t.bytes > THUMBNAIL_MAX_BYTES) add("fail", `${t.file} is over YouTube's 2 MB limit.`);
    }
    if (opts.thumbnails.every((t) => t.bytes <= THUMBNAIL_MAX_BYTES))
      add("pass", `${opts.thumbnails.length} thumbnail(s), each under 2 MB.`);
  }

  if (longSeconds > UNVERIFIED_MAX_SECONDS && !yt.verified) {
    add(
      "fail",
      `The long video is ${timestamp(longSeconds)}, and YouTube abandons uploads over 15:00 from unverified channels. Verify at youtube.com/verify, then set youtube.verified: true in channel.yaml.`,
    );
  }
  if (makesShorts) {
    const [min, max] = shortRange(channel);
    add(
      shortSeconds >= min && shortSeconds <= max ? "pass" : "fail",
      `Short: ${shortSeconds} seconds (the channel's range is ${min}–${max}).`,
    );
  }
  if (JSON.stringify(plan).includes("[CHECK]")) {
    add("fail", "plan.json still has [CHECK] marks. Confirm those facts first.");
  }
  if (!kids) {
    if (endscreen)
      add("pass", `End screen scene from ${timestamp(Math.floor((endFrom ?? 0) / FPS))}.`);
    else add("warn", "No end screen scene, so YouTube's end screen will cover the last scene.");
  }

  // ---- markdown -----------------------------------------------------------------------------
  const icon: Record<CheckStatus, string> = { pass: "✔", fail: "✖", warn: "!" };
  const md: string[] = [];
  const row = (field: string, value: string) =>
    md.push(`| ${field} | ${value.replace(/\|/g, "\\|")} |`);
  const table = () => md.push("| Field | Set it to |", "| --- | --- |");

  md.push(
    `# Upload kit: ${titles[0]}`,
    "",
    `${channel.name} · long video ${timestamp(longSeconds)}${makesShorts ? ` · Short ${timestamp(shortSeconds)}` : ""} · made ${formatSlot(opts.now, TIME_ZONE)} Gulf time`,
    "",
    "Files are in this `upload/` folder. The videos are one folder up.",
    "",
    "## Checks before you start",
    "",
    ...checks.map((c) => `- ${icon[c.status]} ${c.text}`),
    "",
  );
  if (checks.some((c) => c.status === "fail")) {
    md.push("Fix every ✖ before uploading. A video file can't be replaced after upload.", "");
  }

  md.push("## Long video: `long.mp4`", "", "### 1. Details", "");
  table();
  row("Title", titles[0] as string);
  row("Description", `Paste \`description.txt\`${chapters ? " (it has the chapters)" : ""}`);
  row(
    "Thumbnail",
    upload ? "Upload `thumbnail-1.jpg`" : "Pick a frame (this plan has no thumbnails)",
  );
  const extraThumbs = (upload?.thumbnails ?? [])
    .slice(1)
    .map((_, i) => `\`thumbnail-${i + 2}.jpg\``);
  if (extraThumbs.length) {
    row(
      "Test & compare",
      `Next to the thumbnail, choose Test & compare and add ${extraThumbs.join(" and ")}. YouTube shows each to part of the audience and keeps the one with the most watch time. If the option isn't there yet, the channel needs advanced features first.`,
    );
  }
  if (titles.length > 1) {
    row(
      "Other titles",
      `${titles
        .slice(1)
        .map((t) => `"${t}"`)
        .join(
          " · ",
        )}. Use one if Test & compare offers titles, or swap the title after a week if click-through is low.`,
    );
  }
  row("Playlists", upload?.playlist ? `${upload.playlist} (create it the first time)` : "None");
  row(
    "Audience",
    kids
      ? "Yes, it's made for kids. Comments, end screens and cards turn off automatically."
      : "No, it's not made for kids",
  );
  row("Age restriction", "No");
  md.push("", "Then click **Show more**:", "");
  table();
  row("Paid promotion", "Leave unticked");
  row(
    "Altered content",
    "No. The video is fully animated, which YouTube counts as not realistic. Answer Yes only for realistic AI-made people, places or events.",
  );
  row(
    "Automatic chapters",
    chapters ? "Leave on. The chapters in the description take priority." : "Leave on",
  );
  row("Featured places, Automatic concepts", "Leave as they are");
  row("Tags", tags.length ? tags.join(", ") : "None");
  row(
    "Language and captions certification",
    `Video language: ${languageName(channel.language)} · Caption certification: None of these`,
  );
  row("Title and description language", languageName(channel.language));
  row("Recording date and location", "Leave empty");
  row(
    "License",
    "Standard YouTube License · Allow embedding: on · Publish to subscriptions feed: on",
  );
  row(
    "Shorts remixing",
    kids ? "Not available for kids' videos" : "Allow video and audio remixing",
  );
  row("Category", yt.category);
  row(
    "Comments and ratings",
    kids
      ? "Off (automatic for kids' videos)"
      : "On · Hold potentially inappropriate comments for review · Sort by Top · Show like count: on",
  );

  md.push("", "### 2. Video elements", "");
  table();
  row(
    "Subtitles",
    "Add → Upload file → With timing → `captions.srt`. The words are the narration, timed to the voice.",
  );
  if (kids) {
    row("End screen, Cards", "Skip. YouTube doesn't show them on videos made for kids.");
  } else {
    const start = endFrom !== undefined ? ` (from ${timestamp(Math.floor(endFrom / FPS))})` : "";
    if (endscreen && endscreen.template === "endscreen" && endscreen.props.video !== false) {
      row(
        "End screen",
        `Add → template "1 video, 1 subscribe". Drag the video onto the dashed box on the left and Subscribe onto the circle on the right. Video: Best for viewer. Run both for the last 20 seconds${start}.`,
      );
    } else if (endscreen) {
      row(
        "End screen",
        `Add → Element → Subscribe. Drag it onto the circle in the middle and run it for the last 20 seconds${start}. On the next video, use the "1 video, 1 subscribe" template.`,
      );
    } else {
      row(
        "End screen",
        "Add Subscribe and a video (Best for viewer) for the last 20 seconds, where they cover the least.",
      );
    }
    row(
      "Cards",
      "Add a Video card where a chapter mentions another of your videos. Skip it if there's none yet.",
    );
  }

  md.push(
    "",
    "### 3. Checks",
    "",
    "YouTube checks copyright here, and ad suitability once the channel is monetised. Everything in the video is the channel's own or licensed for this use:",
    "",
    "- Narration: Kokoro text-to-speech (Apache 2.0 licence)",
    "- Animation, characters and sound effects: made by this engine",
    "- Emoji: Microsoft Fluent Emoji (MIT licence)",
    `- Font: ${input.theme.font} (Google Fonts, Open Font License)`,
  );
  if (Object.keys(input.logos ?? {}).length) {
    md.push("- Logos: trademarks of their owners, shown for commentary");
  }
  if (input.music)
    md.push(`- Music: \`${input.music}\`. Check that its licence allows monetised YouTube use.`);
  md.push("", "No claim is expected. If one appears, don't publish. Note what it names.", "");

  md.push("### 4. Visibility", "");
  table();
  row("Visibility", `Schedule → ${when(slot)}`);
  row(
    "Why then",
    `The channel publishes on ${yt.publish.days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(", ")} at ${yt.publish.time} ${cityOf(yt.publish.timezone)} time (channel.yaml). The video stays private until then, while YouTube finishes HD processing.`,
  );
  md.push("");

  md.push("### After it's public", "");
  if (pinned) {
    md.push("- Post `pinned-comment.txt` as a comment, then pin it (⋮ → Pin).");
  }
  if (!kids)
    md.push("- Reply to comments in the first hour. Early replies help the video's reach.");
  md.push(
    "- After 48 hours, look at Analytics → Reach (impressions click-through rate) and Engagement (audience retention). Note where viewers drop off.",
    "",
  );

  if (makesShorts) {
    const shortTitle = upload?.short?.title ?? titles[0];
    md.push("## Short: `short.mp4`", "", "Upload it after the long video is scheduled.", "");
    table();
    row("Title", shortTitle as string);
    row("Description", "Paste `short-description.txt`");
    row("Thumbnail", "YouTube picks a frame. To choose one, use the YouTube app.");
    row("Audience, Altered content, Tags, Category", "Same as the long video");
    row(
      "Related video",
      kids
        ? "Not available for kids' videos"
        : "Pick the long video. Viewers can tap through to it from the Short.",
    );
    row("Visibility", `Schedule → ${when(shortSlot)}`);
    md.push("");
  }

  const shortDescription = makesShorts
    ? youtubeText([upload?.short?.description ?? plan.summary ?? plan.title, ...hashtagLine(input)])
    : null;

  return {
    markdown: `${md.join("\n").trim()}\n`,
    description,
    comment: pinned,
    shortDescription,
    captions: toSrt(captionCues(longTimeline)),
    checks,
  };
}
