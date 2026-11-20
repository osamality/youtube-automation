import fs from "node:fs";
import path from "node:path";
import {
  buildEmojiIndex,
  collectEmoji,
  type EmojiIndex,
  emojiFile,
  emojiRepoPath,
} from "@yt/templates/emoji";
import { SFX_DIR } from "@yt/templates/files";
import type { Plan } from "@yt/templates/schema";
import { mulberry32 } from "@yt/templates/timeline";
import type { Channel } from "./config";
import { paths } from "./paths";
import { ensurePhotos } from "./photos";

const EMOJI_RAW = "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/";
const EMOJI_TREE =
  "https://api.github.com/repos/microsoft/fluentui-emoji/git/trees/main?recursive=1";
const MUSIC_EXT = /\.(mp3|m4a|wav|ogg)$/i;

const emojiCache = () => path.join(paths.cache(), "emoji");

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": "youtube-auto" } });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/** The emoji file list, fetched once from GitHub and kept in data/cache/emoji/index.json. */
export async function loadEmojiIndex(): Promise<EmojiIndex> {
  const file = path.join(emojiCache(), "index.json");
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8")) as EmojiIndex;
  const tree = JSON.parse((await download(EMOJI_TREE)).toString("utf8")) as {
    tree: { path: string }[];
  };
  const index = buildEmojiIndex(tree.tree.map((t) => t.path));
  fs.mkdirSync(emojiCache(), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(index));
  return index;
}

/** Up to 3 known ids that contain the unknown id's first word — for error messages. */
function suggest(index: EmojiIndex, id: string): string {
  const word = id.split(/[-:]/)[0] ?? id;
  const hits = Object.keys(index)
    .filter((k) => k.includes(word))
    .slice(0, 3);
  return hits.length ? ` Did you mean: ${hits.join(", ")}?` : "";
}

/** Downloads (once) every emoji the plan uses and copies it into media/emoji/. */
export async function ensureEmoji(refs: string[], mediaDir: string): Promise<void> {
  if (refs.length === 0) return;
  const index = await loadEmojiIndex();
  const unknown = refs.filter((r) => !emojiRepoPath(index, r));
  if (unknown.length) {
    throw new Error(
      `Unknown emoji: ${unknown.map((u) => `"${u}"${suggest(index, u)}`).join(" ")} ` +
        "Names: https://github.com/microsoft/fluentui-emoji/tree/main/assets (lower-case, spaces → dashes).",
    );
  }
  for (const ref of refs) {
    const cached = path.join(emojiCache(), path.basename(emojiFile(ref)));
    if (!fs.existsSync(cached)) {
      const repoPath = emojiRepoPath(index, ref) as string;
      fs.writeFileSync(cached, await download(EMOJI_RAW + encodeURI(repoPath)));
    }
    const target = path.join(mediaDir, emojiFile(ref));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (!fs.existsSync(target)) fs.copyFileSync(cached, target);
  }
}

/** The channel's background tracks (channels/<id>/assets/music/), sorted by name. */
export function musicTracks(channel: Channel): string[] {
  const dir = path.join(paths.channel(channel.id), "assets", "music");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => MUSIC_EXT.test(f))
    .sort()
    .map((f) => path.join(dir, f));
}

/** Same video, same track. Returns the media/-relative path, or null without music. */
export function pickMusic(channel: Channel, seed: number): string | null {
  const tracks = musicTracks(channel);
  if (tracks.length === 0) return null;
  const pick = tracks[Math.floor(mulberry32(seed)() * tracks.length)] as string;
  return `music/${path.basename(pick)}`;
}

/** Puts everything the renderer serves into media/: emoji, sound effects, the music track. */
export async function prepareMedia(
  mediaDir: string,
  channel: Channel,
  plan: Plan,
  seed: number,
): Promise<void> {
  await ensureEmoji(collectEmoji(plan), mediaDir);
  await ensurePhotos(plan, mediaDir);

  if (channel.sound.sfx) {
    const sfxDir = path.join(mediaDir, "sfx");
    fs.mkdirSync(sfxDir, { recursive: true });
    for (const f of fs.readdirSync(SFX_DIR).filter((n) => n.endsWith(".wav"))) {
      fs.copyFileSync(path.join(SFX_DIR, f), path.join(sfxDir, f));
    }
  }

  const music = pickMusic(channel, seed);
  if (music) {
    const source = musicTracks(channel).find((t) => path.basename(t) === path.basename(music));
    const target = path.join(mediaDir, music);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (source && !fs.existsSync(target)) fs.copyFileSync(source, target);
  }
}
