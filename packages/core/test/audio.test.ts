import { describe, expect, it } from "vitest";
import { loudnessEnvelope, voicedRange } from "../src/audio";

const RATE = 16000;
const FPS = 30;

/** 1 s silence, 2 s tone, 1 s silence. */
function signal(): Float32Array {
  const samples = new Float32Array(RATE * 4);
  for (let i = RATE; i < RATE * 3; i++) samples[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / RATE);
  return samples;
}

describe("loudnessEnvelope", () => {
  it("is 0 in silence and high while the tone plays, one value per frame", () => {
    const env = loudnessEnvelope(signal(), RATE, FPS);
    expect(env).toHaveLength(4 * FPS);
    expect(Math.max(...env.slice(0, 29))).toBe(0);
    expect(Math.min(...env.slice(40, 85))).toBeGreaterThan(0.8);
    expect(env.every((v) => v >= 0 && v <= 1)).toBe(true);
  });

  it("finds where the voice starts and stops", () => {
    const { start, end } = voicedRange(loudnessEnvelope(signal(), RATE, FPS), FPS);
    expect(start).toBeCloseTo(1, 1);
    expect(end).toBeGreaterThan(2.9);
    expect(end).toBeLessThan(3.4);
  });

  it("treats all-silent audio as fully voiced (no crash)", () => {
    expect(voicedRange([0, 0, 0], FPS)).toEqual({ start: 0, end: 0.1 });
  });
});
