import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import {
  type ChromeMode,
  combineChunks,
  openBrowser,
  renderMedia,
  renderStill,
  selectComposition,
} from "@remotion/renderer";
import type { Format } from "./constants";
import type { RenderInput } from "./schema";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Remotion entry file — also what `remotion studio` opens. */
export const REMOTION_ENTRY = path.join(here, "remotion", "index.ts");
/** Hand-written example plan used by `yt demo`. */
export const DEMO_PLAN = path.resolve(here, "..", "demo", "plan.json");

/** Bundles the compositions. `publicDir` is the video's media/ folder, served to the renderer. */
export function bundleVideo(
  publicDir: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  return bundle({ entryPoint: REMOTION_ENTRY, publicDir, onProgress: (p) => onProgress?.(p) });
}

// ── browser ───────────────────────────────────────────────────────────────

/** Which Chrome draws the frames. */
export interface BrowserChoice {
  /** Path to a Chrome or Chromium binary. null = Remotion's own headless build. */
  executable: string | null;
  /** Print Chrome's own log lines. Shows why a tab crashed. */
  verbose: boolean;
}

export const DEFAULT_BROWSER: BrowserChoice = { executable: null, verbose: false };

/** The installed Google Chrome or Chromium, if there is one. */
export function systemChrome(): string | null {
  const mac = "Google Chrome.app/Contents/MacOS/Google Chrome";
  const candidates =
    process.platform === "darwin"
      ? [path.join("/Applications", mac), path.join(os.homedir(), "Applications", mac)]
      : process.platform === "win32"
        ? [
            path.join(
              process.env.PROGRAMFILES ?? "C:\\Program Files",
              "Google",
              "Chrome",
              "Application",
              "chrome.exe",
            ),
          ]
        : [
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
          ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

/** True for the errors Remotion raises when Chrome or one of its tabs dies. */
export function isBrowserCrash(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Target closed|Target\.createTarget|Session closed|Browser closed|Browser has disconnected/i.test(
    message,
  );
}

function browserOptions(browser: BrowserChoice) {
  // A full Chrome needs the new headless mode; Remotion's own build is headless-only.
  const chromeMode: ChromeMode = browser.executable ? "chrome-for-testing" : "headless-shell";
  return {
    browserExecutable: browser.executable,
    chromeMode,
    logLevel: browser.verbose ? ("verbose" as const) : ("info" as const),
  };
}

const launch = (browser: BrowserChoice) => openBrowser("chrome", browserOptions(browser));

const asProps = (input: RenderInput) => input as unknown as Record<string, unknown>;

// ── rendering ─────────────────────────────────────────────────────────────

/** Long renders go in one-minute chunks: a crash costs one minute, and a re-run skips finished chunks. */
export const FRAMES_PER_CHUNK = 1800;

/** [first, last] frame of each chunk. Every chunk has `per` frames except the last. */
export function chunkRanges(total: number, per: number): [number, number][] {
  const out: [number, number][] = [];
  for (let start = 0; start < total; start += per)
    out.push([start, Math.min(total, start + per) - 1]);
  return out;
}

/** Changes when the video's props, the template code or the chunk size change — then old chunks are stale. */
function chunkKey(serveUrl: string, inputProps: Record<string, unknown>, format: Format): string {
  const hash = createHash("sha1").update(JSON.stringify([inputProps, format, FRAMES_PER_CHUNK]));
  const bundleJs = path.join(serveUrl, "bundle.js");
  if (fs.existsSync(bundleJs)) hash.update(fs.readFileSync(bundleJs));
  return hash.digest("hex").slice(0, 16);
}

export interface ChunkState {
  key: string;
  done: number[];
}

export async function renderVideo(opts: {
  serveUrl: string;
  input: RenderInput;
  format: Format;
  outFile: string;
  /** Folder for chunk files. Without it, the video renders in one pass. */
  chunkDir?: string;
  browser?: BrowserChoice;
  onProgress?: (share: number) => void;
  /** Called after each chunk with how many were reused from an earlier run. */
  onChunk?: (info: { index: number; total: number; reused: boolean }) => void;
}): Promise<{ frames: number; fps: number }> {
  const choice = opts.browser ?? DEFAULT_BROWSER;
  const options = browserOptions(choice);
  const inputProps = asProps(opts.input);
  const browser = await launch(choice);
  try {
    const composition = await selectComposition({
      ...options,
      serveUrl: opts.serveUrl,
      id: opts.format,
      inputProps,
      puppeteerInstance: browser,
    });
    const total = composition.durationInFrames;

    if (!opts.chunkDir || total <= FRAMES_PER_CHUNK * 2) {
      await renderMedia({
        ...options,
        composition,
        serveUrl: opts.serveUrl,
        codec: "h264",
        crf: 18,
        outputLocation: opts.outFile,
        inputProps,
        puppeteerInstance: browser,
        onProgress: ({ progress }) => opts.onProgress?.(progress),
      });
      return { frames: total, fps: composition.fps };
    }

    // Chunked: same options for every chunk, h264-ts video + separate AAC audio, then one seamless join.
    const dir = opts.chunkDir;
    const key = chunkKey(opts.serveUrl, inputProps, opts.format);
    const stateFile = path.join(dir, "state.json");
    let state: ChunkState = { key, done: [] };
    if (fs.existsSync(stateFile)) {
      const old = JSON.parse(fs.readFileSync(stateFile, "utf8")) as ChunkState;
      if (old.key === key) state = old;
      else fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });

    const ranges = chunkRanges(total, FRAMES_PER_CHUNK);
    const videoFiles = ranges.map((_, i) =>
      path.join(dir, `chunk-${String(i).padStart(3, "0")}.ts`),
    );
    const audioFiles = ranges.map((_, i) =>
      path.join(dir, `chunk-${String(i).padStart(3, "0")}.aac`),
    );
    let framesDone = 0;
    for (const [i, range] of ranges.entries()) {
      const length = range[1] - range[0] + 1;
      const video = videoFiles[i] as string;
      const audio = audioFiles[i] as string;
      if (state.done.includes(i) && fs.existsSync(video) && fs.existsSync(audio)) {
        framesDone += length;
        opts.onProgress?.((framesDone / total) * 0.97);
        opts.onChunk?.({ index: i, total: ranges.length, reused: true });
        continue;
      }
      await renderMedia({
        ...options,
        composition,
        serveUrl: opts.serveUrl,
        codec: "h264-ts",
        crf: 18,
        frameRange: range,
        compositionStart: 0,
        outputLocation: video,
        separateAudioTo: audio,
        forSeamlessAacConcatenation: true,
        enforceAudioTrack: true,
        numberOfGifLoops: null,
        inputProps,
        puppeteerInstance: browser,
        onProgress: ({ progress }) =>
          opts.onProgress?.(((framesDone + progress * length) / total) * 0.97),
      });
      framesDone += length;
      state.done.push(i);
      fs.writeFileSync(stateFile, JSON.stringify(state));
      opts.onChunk?.({ index: i, total: ranges.length, reused: false });
    }

    await combineChunks({
      outputLocation: opts.outFile,
      videoFiles,
      audioFiles,
      codec: "h264",
      audioCodec: "aac",
      fps: composition.fps,
      framesPerChunk: FRAMES_PER_CHUNK,
      preferLossless: false,
      compositionDurationInFrames: total,
      logLevel: options.logLevel,
      onProgress: ({ totalProgress }) => opts.onProgress?.(0.97 + totalProgress * 0.03),
    });
    fs.rmSync(dir, { recursive: true, force: true });
    opts.onProgress?.(1);
    return { frames: total, fps: composition.fps };
  } finally {
    await browser.close({ silent: true });
  }
}

/** Single frames as PNG — for checking layouts and, later, thumbnails. */
export async function renderStills(opts: {
  serveUrl: string;
  input: RenderInput;
  format: Format;
  frames: number[];
  outDir: string;
  browser?: BrowserChoice;
}): Promise<string[]> {
  const choice = opts.browser ?? DEFAULT_BROWSER;
  const options = browserOptions(choice);
  const inputProps = asProps(opts.input);
  const browser = await launch(choice);
  try {
    const composition = await selectComposition({
      ...options,
      serveUrl: opts.serveUrl,
      id: opts.format,
      inputProps,
      puppeteerInstance: browser,
    });
    const files: string[] = [];
    for (const frame of opts.frames) {
      const clamped = Math.min(frame, composition.durationInFrames - 1);
      const output = path.join(
        opts.outDir,
        `${opts.format}-${String(clamped).padStart(5, "0")}.png`,
      );
      await renderStill({
        ...options,
        composition,
        serveUrl: opts.serveUrl,
        frame: clamped,
        output,
        inputProps,
        puppeteerInstance: browser,
      });
      files.push(output);
    }
    return files;
  } finally {
    await browser.close({ silent: true });
  }
}

/** YouTube refuses thumbnails over 2 MB. */
export const THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;

/** The plan's thumbnails as JPEGs: `thumbnail-1.jpg` … in `outDir`. */
export async function renderThumbnails(opts: {
  serveUrl: string;
  input: RenderInput;
  outDir: string;
  browser?: BrowserChoice;
}): Promise<string[]> {
  const count = Math.max(1, opts.input.plan.upload?.thumbnails.length ?? 0);
  const choice = opts.browser ?? DEFAULT_BROWSER;
  const options = browserOptions(choice);
  const inputProps = asProps(opts.input);
  const browser = await launch(choice);
  fs.mkdirSync(opts.outDir, { recursive: true });
  try {
    const files: string[] = [];
    for (let i = 1; i <= count; i++) {
      const id = `thumbnail-${i}`;
      const composition = await selectComposition({
        ...options,
        serveUrl: opts.serveUrl,
        id,
        inputProps,
        puppeteerInstance: browser,
      });
      const output = path.join(opts.outDir, `${id}.jpg`);
      await renderStill({
        ...options,
        composition,
        serveUrl: opts.serveUrl,
        frame: 0,
        output,
        imageFormat: "jpeg",
        jpegQuality: 90,
        inputProps,
        puppeteerInstance: browser,
      });
      files.push(output);
    }
    return files;
  } finally {
    await browser.close({ silent: true });
  }
}
