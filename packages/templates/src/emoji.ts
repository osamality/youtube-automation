/**
 * Microsoft Fluent Emoji, 3D style (MIT licence): https://github.com/microsoft/fluentui-emoji
 *
 * Plans refer to an emoji by its kebab-case name, optionally with a skin tone:
 * "briefcase", "money-bag", "woman-office-worker:medium-dark".
 * Core downloads each one into the video's media/emoji/ folder before rendering.
 * Pure data and string helpers — safe to import from Node and from the browser bundle.
 */

export const EMOJI_TONES = [
  "default",
  "light",
  "medium-light",
  "medium",
  "medium-dark",
  "dark",
] as const;
export type EmojiTone = (typeof EMOJI_TONES)[number];

export const EMOJI_REF = /^[a-z0-9-]+(:(default|light|medium-light|medium|medium-dark|dark))?$/;

export interface EmojiRef {
  id: string;
  tone: EmojiTone | null;
}

export function parseEmoji(ref: string): EmojiRef {
  const [id = "", tone] = ref.split(":");
  return { id, tone: (tone as EmojiTone | undefined) ?? null };
}

/** Where the PNG lives inside the video's media/ folder. */
export function emojiFile(ref: string): string {
  return `emoji/${ref.replace(":", "_")}.png`;
}

/** Every string stored under an "emoji" key anywhere in `value` (plans, props). */
export function collectEmoji(value: unknown, out = new Set<string>()): string[] {
  if (Array.isArray(value)) {
    for (const v of value) collectEmoji(v, out);
  } else if (value && typeof value === "object") {
    for (const [key, v] of Object.entries(value)) {
      if ((key === "emoji" || key === "avatar") && typeof v === "string") out.add(v);
      else collectEmoji(v, out);
    }
  }
  return [...out];
}

/** "Man office worker" → "man-office-worker". */
export function emojiId(folderName: string): string {
  return folderName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** id → where its 3D PNG sits in the repository. `toned` entries exist once per skin tone. */
export type EmojiIndex = Record<string, { dir: string; file: string; toned: boolean }>;

/** Builds the index from the repository's file list (paths like assets/<Name>/[<Tone>/]3D/<file>.png). */
export function buildEmojiIndex(repoPaths: string[]): EmojiIndex {
  const index: EmojiIndex = {};
  for (const p of repoPaths) {
    const m = /^assets\/([^/]+)\/(?:([^/]+)\/)?3D\/([^/]+\.png)$/.exec(p);
    if (!m) continue;
    const [, name = "", tone, file = ""] = m;
    const id = emojiId(name);
    if (tone) {
      if (tone !== "Default") continue;
      index[id] = {
        dir: `assets/${name}`,
        file: file.replace(/_default\.png$/, "_{tone}.png"),
        toned: true,
      };
    } else {
      index[id] = { dir: `assets/${name}`, file, toned: false };
    }
  }
  return index;
}

/** Repository path of one emoji PNG, or null if the id is unknown. */
export function emojiRepoPath(index: EmojiIndex, ref: string): string | null {
  const { id, tone } = parseEmoji(ref);
  const entry = index[id];
  if (!entry) return null;
  if (!entry.toned) return `${entry.dir}/3D/${entry.file}`;
  const t = tone ?? "default";
  const folder = t
    .split("-")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join("-");
  return `${entry.dir}/${folder}/3D/${entry.file.replace("{tone}", t)}`;
}
