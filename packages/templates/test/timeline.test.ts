import { describe, expect, it } from "vitest";
import { FPS } from "../src/constants";
import type { Plan, SceneVoice } from "../src/schema";
import {
  buildTimeline,
  END_HOLD_FRAMES,
  LEAD_IN_FRAMES,
  loudnessAt,
  MIN_SCENE_FRAMES,
  PAD_FRAMES,
  sceneAt,
  TRANSITION_FRAMES,
} from "../src/timeline";

function plan(templates: Plan["scenes"][number]["template"][]): Plan {
  return {
    version: 1,
    channel: "test",
    title: "Test",
    scenes: templates.map(
      (template) =>
        ({ template, narration: "Hello there.", props: {} }) as unknown as Plan["scenes"][number],
    ),
  };
}

function voice(seconds: number): SceneVoice {
  const frames = Math.ceil(seconds * FPS);
  return {
    key: "k",
    file: "v.wav",
    duration: seconds,
    envelope: Array.from({ length: frames }, () => 0.5),
    words: [
      { text: "Hello", start: 0.2, end: 0.6 },
      { text: "there.", start: 0.7, end: 1.1 },
    ],
  };
}

describe("buildTimeline", () => {
  it("overlaps scenes by the transition and leaves exactly PAD frames between voices", () => {
    const t = buildTimeline({
      plan: plan(["flow", "chart", "list"]),
      voices: [5, 6, 7].map(voice),
      seed: 1,
    });
    const [a, b, c] = t.scenes;
    if (!a || !b || !c) throw new Error("missing scenes");

    expect(b.from).toBe(a.from + a.duration - TRANSITION_FRAMES);
    expect(c.from).toBe(b.from + b.duration - TRANSITION_FRAMES);
    expect(a.voiceFrom).toBe(LEAD_IN_FRAMES);
    expect(b.voiceFrom - (a.voiceFrom + a.voiceFrames)).toBe(PAD_FRAMES);
    expect(c.voiceFrom - (b.voiceFrom + b.voiceFrames)).toBe(PAD_FRAMES);
    expect(t.durationInFrames).toBe(c.from + c.duration);
    expect(c.from + c.duration - (c.voiceFrom + c.voiceFrames)).toBe(PAD_FRAMES + END_HOLD_FRAMES);
  });

  it("keeps short scenes long enough for their animation", () => {
    const t = buildTimeline({
      plan: plan(["chart", "list"]),
      voices: [voice(1), voice(1)],
      seed: 1,
    });
    const first = t.scenes[0];
    expect(first?.duration).toBe(LEAD_IN_FRAMES + MIN_SCENE_FRAMES.chart + TRANSITION_FRAMES);
  });

  it("converts word times to absolute frames", () => {
    const t = buildTimeline({
      plan: plan(["hook", "list"]),
      voices: [voice(3), voice(3)],
      seed: 1,
    });
    const second = t.scenes[1];
    expect(second?.words[0]).toEqual({
      text: "Hello",
      start: (second?.voiceFrom ?? 0) + 6,
      end: (second?.voiceFrom ?? 0) + 18,
    });
  });

  it("never repeats a transition back to back, and is stable for a seed", () => {
    const p = plan(Array.from({ length: 12 }, () => "list" as const));
    const voices = Array.from({ length: 12 }, () => voice(2));
    const a = buildTimeline({ plan: p, voices, seed: 42 }).scenes.map((s) => s.transitionIn);
    const b = buildTimeline({ plan: p, voices, seed: 42 }).scenes.map((s) => s.transitionIn);
    expect(a).toEqual(b);
    expect(a[0]).toBeNull();
    for (let i = 2; i < a.length; i++) expect(a[i]).not.toBe(a[i - 1]);
  });

  it("rejects a voice list that does not match the plan", () => {
    expect(() =>
      buildTimeline({ plan: plan(["hook", "list"]), voices: [voice(2)], seed: 1 }),
    ).toThrow(/2 scenes but voice has 1/);
  });

  it("finds the scene on screen and the loudness at a frame", () => {
    const t = buildTimeline({
      plan: plan(["hook", "list"]),
      voices: [voice(3), voice(3)],
      seed: 1,
    });
    const second = t.scenes[1];
    if (!second) throw new Error("missing scene");
    expect(sceneAt(t, second.from)?.index).toBe(1);
    expect(sceneAt(t, second.from - 1)?.index).toBe(0);
    expect(loudnessAt(t, second.voiceFrom + 3)).toBe(0.5);
    expect(loudnessAt(t, 0)).toBe(0);
  });
});
