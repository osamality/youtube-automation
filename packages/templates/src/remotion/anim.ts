import type { CSSProperties } from "react";
import { interpolate, type SpringConfig, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimedScene } from "../timeline";

/** Per-scene timing, in frames local to the scene. */
export interface SceneCtx {
  index: number;
  duration: number;
  /** When entrance animations should start (after the incoming transition is mostly done). */
  enter: number;
  voiceStart: number;
  voiceFrames: number;
  envelope: number[];
  words: { text: string; start: number; end: number }[];
}

export function toCtx(t: TimedScene): SceneCtx {
  const voiceStart = t.voiceFrom - t.from;
  return {
    index: t.index,
    duration: t.duration,
    enter: t.index === 0 ? voiceStart : 6,
    voiceStart,
    voiceFrames: t.voiceFrames,
    envelope: t.envelope,
    words: t.words.map((w) => ({ text: w.text, start: w.start - t.from, end: w.end - t.from })),
  };
}

export const POP: Partial<SpringConfig> = { damping: 12, stiffness: 170, mass: 0.6 };
export const SMOOTH: Partial<SpringConfig> = { damping: 200 };
export const BOUNCY: Partial<SpringConfig> = { damping: 9, stiffness: 160, mass: 0.7 };

/** 0 → 1 spring that starts at `delay`. */
export function useSpringAt(delay: number, config: Partial<SpringConfig> = POP): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config });
}

export function springAt(
  frame: number,
  fps: number,
  delay: number,
  config: Partial<SpringConfig> = POP,
): number {
  return spring({ frame: frame - delay, fps, config });
}

export function fadeUp(p: number, distance: number): CSSProperties {
  return {
    opacity: Math.min(1, Math.max(0, p * 1.3)),
    transform: `translateY(${(1 - p) * distance}px)`,
  };
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function progress(frame: number, start: number, length: number): number {
  return interpolate(frame, [start, start + length], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

export function formatNumber(
  value: number,
  opts: { decimals?: number; prefix?: string; suffix?: string } = {},
): string {
  const d = opts.decimals ?? 0;
  const body = value.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
  return `${opts.prefix ?? ""}${body}${opts.suffix ?? ""}`;
}

const STOP_WORDS = new Set(
  "the and for with that this from your you are its into more than have what when they their them will just our out who how why can".split(
    " ",
  ),
);

function keywords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => (w.length >= 3 || /\d/.test(w)) && !STOP_WORDS.has(w));
}

const stem = (w: string) => w.slice(0, 5);

/**
 * When each item should appear. Items whose keywords are spoken appear as the word is said;
 * the rest are spread evenly across the narration. Always increasing, at least 6 frames apart.
 */
export function revealTimes(labels: string[], ctx: SceneCtx, spread = 0.8): number[] {
  const n = labels.length;
  const first = Math.max(ctx.enter + 4, ctx.voiceStart);
  const last = ctx.voiceStart + ctx.voiceFrames * spread;
  const even = labels.map((_, i) => Math.round(first + ((last - first) * i) / Math.max(n, 1)));

  const spoken = ctx.words.map((w) => ({
    start: w.start,
    stem: stem(w.text.toLowerCase().replace(/[^a-z0-9]/g, "")),
  }));

  let cursor = 0;
  const out = labels.map((label, i) => {
    const stems = keywords(label).map(stem);
    for (let j = cursor; j < spoken.length; j++) {
      const word = spoken[j];
      if (word && stems.includes(word.stem)) {
        cursor = j + 1;
        return Math.max(first, word.start - 3);
      }
    }
    return even[i] ?? first;
  });

  for (let i = 1; i < out.length; i++) {
    out[i] = Math.max(out[i] ?? 0, (out[i - 1] ?? 0) + 6);
  }
  return out;
}
