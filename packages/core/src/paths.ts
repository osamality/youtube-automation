import path from "node:path";
import { fileURLToPath } from "node:url";

const coreDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Repo root. YT_ROOT overrides it (tests point it at a temp folder). */
export function rootDir(): string {
  const override = process.env.YT_ROOT;
  return override ? path.resolve(override) : path.resolve(coreDir, "../..");
}

export const paths = {
  channels: () => path.join(rootDir(), "channels"),
  channel: (id: string) => path.join(rootDir(), "channels", id),
  channelConfig: (id: string) => path.join(rootDir(), "channels", id, "channel.yaml"),
  /** Starter files copied by `yt channel add`. Lives with the code, not with the channels. */
  channelTemplate: () => path.join(coreDir, "channel-template"),
  data: () => path.join(rootDir(), "data"),
  db: () => path.join(rootDir(), "data", "yt.db"),
  /** Downloads shared by every video (emoji images, their index). */
  cache: () => path.join(rootDir(), "data", "cache"),
  videos: (channelId: string) => path.join(rootDir(), "data", channelId, "videos"),
  secrets: () => path.join(rootDir(), "secrets"),
};

/** Path relative to the repo root — what gets stored in the database and printed. */
export function relToRoot(absolute: string): string {
  return path.relative(rootDir(), absolute);
}

export function fromRoot(relative: string): string {
  return path.resolve(rootDir(), relative);
}
