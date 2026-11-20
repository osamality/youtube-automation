import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { revealTimes, type SceneCtx } from "../src/remotion/anim";
import { Plan } from "../src/schema";
import { estimateWordTimings } from "../src/words";

describe("estimateWordTimings", () => {
  it("covers the voiced range in order, with longer words taking longer", () => {
    const words = estimateWordTimings("A remarkably unbelievable idea, really.", 0.5, 3.5);
    expect(words.map((w) => w.text)).toEqual([
      "A",
      "remarkably",
      "unbelievable",
      "idea,",
      "really.",
    ]);
    expect(words[0]?.start).toBe(0.5);
    expect(words.at(-1)?.end).toBeCloseTo(3.5, 2);
    for (let i = 1; i < words.length; i++) {
      expect(words[i]?.start).toBeGreaterThanOrEqual(words[i - 1]?.end ?? 0);
    }
    const len = (i: number) => (words[i]?.end ?? 0) - (words[i]?.start ?? 0);
    expect(len(2)).toBeGreaterThan(len(0));
  });

  it("leaves a gap after punctuation", () => {
    const words = estimateWordTimings("Stop. Go now", 0, 3);
    const gapAfterStop = (words[1]?.start ?? 0) - (words[0]?.end ?? 0);
    const gapAfterGo = (words[2]?.start ?? 0) - (words[1]?.end ?? 0);
    expect(gapAfterStop).toBeGreaterThan(0.1);
    expect(gapAfterGo).toBe(0);
  });

  it("returns nothing for empty text or an empty range", () => {
    expect(estimateWordTimings("  ", 0, 2)).toEqual([]);
    expect(estimateWordTimings("hello", 2, 2)).toEqual([]);
  });
});

describe("revealTimes", () => {
  const ctx = (words: [string, number][]): SceneCtx => ({
    index: 1,
    duration: 300,
    enter: 6,
    voiceStart: 0,
    voiceFrames: 200,
    envelope: [],
    words: words.map(([text, start]) => ({ text, start, end: start + 5 })),
  });

  it("reveals an item when its keyword is spoken", () => {
    const c = ctx([
      ["You", 10],
      ["pay", 20],
      ["monthly.", 30],
      ["Netflix", 60],
      ["buys", 70],
      ["shows.", 90],
    ]);
    expect(revealTimes(["You pay monthly", "Netflix", "New shows"], c)).toEqual([17, 57, 87]);
  });

  it("falls back to even spacing and always moves forward", () => {
    const times = revealTimes(["alpha", "beta", "gamma"], ctx([]));
    expect(times[0]).toBe(10);
    expect(times[1]).toBeGreaterThan(times[0] ?? 0);
    expect(times[2]).toBeGreaterThan(times[1] ?? 0);
  });
});

describe("demo plan", () => {
  it("is a valid plan", () => {
    const file = path.resolve(import.meta.dirname, "../demo/plan.json");
    const result = Plan.safeParse(JSON.parse(fs.readFileSync(file, "utf8")));
    expect(result.success ? "ok" : result.error.issues).toBe("ok");
  });

  it("rejects unknown templates and missing props", () => {
    const bad = {
      version: 1,
      channel: "x",
      title: "t",
      scenes: [
        { template: "spinner", narration: "n", props: {} },
        { template: "counter", narration: "n", props: { value: 3 } },
      ],
    };
    const result = Plan.safeParse(bad);
    expect(result.success).toBe(false);
    const paths = result.success ? [] : result.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("scenes.0.template");
    expect(paths).toContain("scenes.1.props.label");
  });
});
