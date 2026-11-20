import { spawn } from "node:child_process";
import fs from "node:fs";

/**
 * YouTube's playback loudness. YouTube turns louder uploads down to about -14 LUFS but never turns
 * quieter ones up, so a -22 LUFS render plays about 8 dB quieter than the videos around it.
 */
export const LOUDNESS = { I: -14, TP: -1.5, LRA: 11 } as const;
const TARGET = `I=${LOUDNESS.I}:TP=${LOUDNESS.TP}:LRA=${LOUDNESS.LRA}`;

/** The JSON block ffmpeg's loudnorm filter prints with print_format=json (values are strings). */
export interface LoudnormStats {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
  output_i?: string;
}

/** Pulls loudnorm's JSON block out of ffmpeg's stderr. */
export function parseLoudnorm(stderr: string): LoudnormStats {
  const start = stderr.lastIndexOf("{");
  const end = stderr.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("ffmpeg printed no loudnorm measurements");
  return JSON.parse(stderr.slice(start, end + 1)) as LoudnormStats;
}

function ffmpeg(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", ["-hide_banner", "-nostats", ...args]);
    let stderr = "";
    ff.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    ff.on("error", (err) => reject(new Error(`Could not start ffmpeg: ${err.message}`)));
    ff.on("close", (code) =>
      code === 0
        ? resolve(stderr)
        : reject(new Error(`ffmpeg failed: ${stderr.trim().slice(-400)}`)),
    );
  });
}

/**
 * Two-pass loudnorm to -14 LUFS (true peak -1.5 dB), in place. The video stream is copied; only
 * the audio is re-encoded (AAC 192k, 48 kHz). Files already at the target are left alone.
 */
export async function normalizeLoudness(
  file: string,
): Promise<{ before: number; after: number; changed: boolean }> {
  const first = parseLoudnorm(
    await ffmpeg(["-i", file, "-af", `loudnorm=${TARGET}:print_format=json`, "-f", "null", "-"]),
  );
  const before = Number(first.input_i);
  const peak = Number(first.input_tp);
  // AAC encoding nudges true peak up a little, so a normalised file can read slightly over TP.
  if (
    !Number.isFinite(before) ||
    (Math.abs(before - LOUDNESS.I) <= 0.5 && peak <= LOUDNESS.TP + 0.5)
  ) {
    return { before, after: before, changed: false };
  }
  const measured =
    `measured_I=${first.input_i}:measured_TP=${first.input_tp}:measured_LRA=${first.input_lra}` +
    `:measured_thresh=${first.input_thresh}:offset=${first.target_offset}`;
  const tmp = file.replace(/(\.mp4)?$/, ".loudnorm.mp4");
  try {
    const second = parseLoudnorm(
      await ffmpeg([
        "-y",
        "-i",
        file,
        "-c:v",
        "copy",
        "-af",
        `loudnorm=${TARGET}:${measured}:linear=true:print_format=json`,
        "-ar",
        "48000",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-movflags",
        "+faststart",
        tmp,
      ]),
    );
    fs.renameSync(tmp, file);
    return { before, after: Number(second.output_i ?? LOUDNESS.I), changed: true };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
