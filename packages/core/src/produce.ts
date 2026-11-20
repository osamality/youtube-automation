import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { FPS } from "@yt/templates/constants";
import { FONTS, PALETTES } from "@yt/templates/palettes";
import {
  formatIssues,
  Plan,
  type RenderInput,
  type SceneVoice,
  VoiceFile,
} from "@yt/templates/schema";
import { estimateWordTimings } from "@yt/templates/words";
import { pickMusic, prepareMedia } from "./assets";
import { ANALYSIS_RATE, decodeMono, loudnessEnvelope, voicedRange } from "./audio";
import type { Channel } from "./config";
import { collectLogos, resolveLogos } from "./logos";
import { relToRoot } from "./paths";
import { readPhotoIndex } from "./photos";
import { synthesize } from "./voice";

/** Files inside one video folder. */
export function videoFiles(folder: string) {
  return {
    plan: path.join(folder, "plan.json"),
    voice: path.join(folder, "voice.json"),
    /** Served to the renderer as its public folder. */
    media: path.join(folder, "media"),
    output: (format: string) => path.join(folder, `${format}.mp4`),
    stills: path.join(folder, "stills"),
    /** Finished chunks of a long render, kept until the final file is joined. */
    chunks: (format: string) => path.join(folder, ".chunks", format),
    /** Everything for the YouTube upload form: UPLOAD.md, description, thumbnails, captions. */
    upload: path.join(folder, "upload"),
    kit: path.join(folder, "upload", "UPLOAD.md"),
    description: path.join(folder, "upload", "description.txt"),
    /** The question and any sources that didn't fit in the description. */
    comment: path.join(folder, "upload", "pinned-comment.txt"),
    shortDescription: path.join(folder, "upload", "short-description.txt"),
    captions: path.join(folder, "upload", "captions.srt"),
    /** What each rendered .mp4 was made from (videoKey), to tell when it's out of date. */
    renderKey: (format: string) => path.join(folder, `.render-${format}.json`),
  };
}

export function readPlan(folder: string): Plan {
  const file = videoFiles(folder).plan;
  if (!fs.existsSync(file)) throw new Error(`No plan.json in ${relToRoot(folder)}`);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`plan.json is not valid JSON: ${(err as Error).message}`);
  }
  const result = Plan.safeParse(raw);
  if (!result.success) {
    const problems = formatIssues(result.error).map((p) => `  - ${p}`);
    throw new Error(`plan.json is invalid:\n${problems.join("\n")}`);
  }
  return result.data;
}

function readVoices(folder: string): SceneVoice[] {
  const file = videoFiles(folder).voice;
  if (!fs.existsSync(file)) return [];
  const result = VoiceFile.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
  return result.success ? result.data.scenes : [];
}

function writeVoices(folder: string, scenes: SceneVoice[]): void {
  fs.writeFileSync(videoFiles(folder).voice, `${JSON.stringify({ scenes })}\n`);
}

/** The channel with this plan's own narrator, when the plan names one. */
export function withPlanVoice(channel: Channel, plan: Plan): Channel {
  return plan.voice ? { ...channel, voice: { ...channel.voice, ...plan.voice } } : channel;
}

/** Changes whenever the narration or the channel's voice settings change. */
export function voiceKey(narration: string, channel: Channel): string {
  const { provider, id, speed } = channel.voice;
  // Only plans that ask for trimmed clips add to the key, so every older recording stays valid.
  const trim = (channel.voice as { trim?: boolean }).trim === true;
  return createHash("sha1")
    .update(
      JSON.stringify(
        trim ? [narration, provider, id, speed, "trim"] : [narration, provider, id, speed],
      ),
    )
    .digest("hex")
    .slice(0, 16);
}

/** Cuts the silence before the first word and after the last, leaving a breath's worth. */
function trimSilence(file: string): void {
  const out = `${file}.trim.wav`;
  const cut = "silenceremove=start_periods=1:start_threshold=-42dB";
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-y",
    "-i",
    file,
    "-af",
    `${cut}:start_silence=0.03,areverse,${cut}:start_silence=0.05,areverse`,
    out,
  ]);
  fs.renameSync(out, file);
}

export async function analyzeVoice(
  absoluteFile: string,
  file: string,
  key: string,
  narration: string,
): Promise<SceneVoice> {
  const samples = await decodeMono(absoluteFile);
  const envelope = loudnessEnvelope(samples, ANALYSIS_RATE, FPS);
  const { start, end } = voicedRange(envelope, FPS);
  return {
    key,
    file,
    duration: samples.length / ANALYSIS_RATE,
    envelope,
    words: estimateWordTimings(narration, start, end),
  };
}

/**
 * Records narration for every scene that is new or changed, and analyses it (length, loudness, word timings).
 * Unchanged scenes are reused. Progress is saved after each scene, so an interrupted run resumes.
 */
export async function voicePlan(
  folder: string,
  channel: Channel,
  onScene?: (info: { index: number; total: number; reused: boolean }) => void,
): Promise<SceneVoice[]> {
  const plan = readPlan(folder);
  const own = withPlanVoice(channel, plan);
  const files = videoFiles(folder);
  const previous = readVoices(folder);
  fs.mkdirSync(path.join(files.media, "voice"), { recursive: true });

  const total = plan.scenes.length;
  const voices: SceneVoice[] = [];
  for (const [index, scene] of plan.scenes.entries()) {
    const key = voiceKey(scene.narration, own);
    const file = `voice/${String(index + 1).padStart(2, "0")}.wav`;
    const absolute = path.join(files.media, file);
    const old = previous[index];

    if (old && old.key === key && old.file === file && fs.existsSync(absolute)) {
      voices.push(old);
      onScene?.({ index, total, reused: true });
      continue;
    }
    await synthesize(scene.narration, own.voice, absolute);
    if (plan.voice?.trim) trimSilence(absolute);
    voices.push(await analyzeVoice(absolute, file, key, scene.narration));
    writeVoices(folder, [...voices, ...previous.slice(voices.length)]);
    onScene?.({ index, total, reused: false });
  }

  // Drop audio for scenes that no longer exist.
  for (const name of fs.readdirSync(path.join(files.media, "voice"))) {
    const n = Number.parseInt(name, 10);
    if (Number.isInteger(n) && n > total) fs.rmSync(path.join(files.media, "voice", name));
  }
  writeVoices(folder, voices);
  return voices;
}

export function voiceIsCurrent(folder: string, channel: Channel): boolean {
  const plan = readPlan(folder);
  const own = withPlanVoice(channel, plan);
  const voices = readVoices(folder);
  return (
    voices.length === plan.scenes.length &&
    plan.scenes.every((s, i) => voices[i]?.key === voiceKey(s.narration, own))
  );
}

export function seedFrom(text: string): number {
  return Number.parseInt(createHash("sha1").update(text).digest("hex").slice(0, 8), 16);
}

/** plan.json + voice.json + channel.yaml → the props the Remotion compositions render. */
export function buildRenderInput(folder: string, channel: Channel): RenderInput {
  const plan = readPlan(folder);
  if (plan.channel !== channel.id) {
    throw new Error(`plan.json is for channel "${plan.channel}", not "${channel.id}".`);
  }
  if (!voiceIsCurrent(folder, channel)) {
    throw new Error(`Voice is missing or out of date. Run: yt voice ${relToRoot(folder)}`);
  }
  if (!PALETTES[channel.theme.palette]) {
    throw new Error(
      `Unknown theme.palette "${channel.theme.palette}" in channels/${channel.id}/channel.yaml. Options: ${Object.keys(PALETTES).join(", ")}`,
    );
  }
  if (!(FONTS as readonly string[]).includes(channel.theme.font)) {
    throw new Error(
      `Unknown theme.font "${channel.theme.font}" in channels/${channel.id}/channel.yaml. Options: ${FONTS.join(", ")}`,
    );
  }
  return {
    plan,
    voices: readVoices(folder),
    theme: channel.theme,
    channelName: channel.name,
    mascot: channel.mascot ?? null,
    mascotCorner: channel.mascot_corner,
    seed: seedFrom(plan.title),
    music: pickMusic(channel, seedFrom(plan.title)),
    musicVolume: channel.sound.music_volume,
    sfx: channel.sound.sfx,
    logos: resolveLogos(collectLogos(plan)).logos,
    photos: renderPhotos(plan, videoFiles(folder).media),
  };
}

/** The plan's photos as the renderer needs them (credits stay out: they belong to the description). */
function renderPhotos(plan: Plan, mediaDir: string): RenderInput["photos"] {
  if (!plan.photos?.length) return undefined;
  const index = readPhotoIndex(mediaDir);
  const missing = plan.photos.filter((p) => !index[p.id]).map((p) => p.id);
  if (missing.length) {
    throw new Error(
      `Photos not downloaded yet: ${missing.join(", ")}. They download with the render.`,
    );
  }
  return Object.fromEntries(
    plan.photos.map((p) => {
      const { credit: _credit, ...data } = index[p.id] as NonNullable<(typeof index)[string]>;
      return [p.id, data];
    }),
  );
}

/** Downloads emoji and copies sound effects and music into media/ for this plan. */
export async function prepareVideoMedia(folder: string, channel: Channel): Promise<void> {
  const plan = readPlan(folder);
  await prepareMedia(videoFiles(folder).media, channel, plan, seedFrom(plan.title));
}
