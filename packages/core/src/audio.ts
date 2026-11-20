import { spawn } from "node:child_process";

/** Sample rate used for analysis only — the original file is untouched. */
export const ANALYSIS_RATE = 16000;

/** Decodes any audio file to mono float samples with ffmpeg. */
export function decodeMono(file: string, rate = ANALYSIS_RATE): Promise<Float32Array> {
  return new Promise((resolve, reject) => {
    const ff = spawn("ffmpeg", [
      "-v",
      "error",
      "-i",
      file,
      "-ac",
      "1",
      "-ar",
      String(rate),
      "-f",
      "f32le",
      "pipe:1",
    ]);
    const chunks: Buffer[] = [];
    let stderr = "";
    ff.stdout.on("data", (c: Buffer) => chunks.push(c));
    ff.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    ff.on("error", (err) => reject(new Error(`Could not start ffmpeg: ${err.message}`)));
    ff.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg failed on ${file}: ${stderr.trim()}`));
        return;
      }
      const buf = Buffer.concat(chunks);
      const aligned = buf.buffer.slice(
        buf.byteOffset,
        buf.byteOffset + buf.byteLength - (buf.byteLength % 4),
      );
      resolve(new Float32Array(aligned));
    });
  });
}

/**
 * Loudness per video frame, 0–1. Normalised to the 95th percentile so quiet and loud voices
 * move the mascot's mouth equally. Fast attack, slower release, so the mouth does not flicker.
 */
export function loudnessEnvelope(samples: Float32Array, rate: number, fps: number): number[] {
  const hop = rate / fps;
  const frames = Math.ceil(samples.length / hop);
  const rms: number[] = [];
  for (let f = 0; f < frames; f++) {
    const start = Math.round(f * hop);
    const end = Math.min(samples.length, Math.round((f + 1) * hop));
    let sum = 0;
    for (let i = start; i < end; i++) {
      const s = samples[i] ?? 0;
      sum += s * s;
    }
    rms.push(Math.sqrt(sum / Math.max(1, end - start)));
  }

  const sorted = [...rms].sort((a, b) => a - b);
  const reference = sorted[Math.floor(0.95 * (sorted.length - 1))] || 1e-9;

  let previous = 0;
  return rms.map((value) => {
    let x = Math.min(1, value / reference);
    x = x < 0.08 ? 0 : x ** 0.8;
    const y = x > previous ? x * 0.7 + previous * 0.3 : x * 0.45 + previous * 0.55;
    previous = y;
    return Math.round(y * 100) / 100;
  });
}

/** First and last moment (seconds) the voice is audible. */
export function voicedRange(
  envelope: number[],
  fps: number,
  threshold = 0.1,
): { start: number; end: number } {
  const first = envelope.findIndex((v) => v > threshold);
  if (first < 0) return { start: 0, end: envelope.length / fps };
  let last = envelope.length - 1;
  while (last > first && (envelope[last] ?? 0) <= threshold) last--;
  return { start: first / fps, end: (last + 1) / fps };
}
