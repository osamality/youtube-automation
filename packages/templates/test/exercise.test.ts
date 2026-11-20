import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BONES,
  cycleSeconds,
  FLOOR,
  MAT,
  MOVE_IDS,
  type MoveStep,
  moveAt,
  moveBounds,
  moveDef,
  oneHanded,
  SWITCH_SECONDS,
  skeleton,
} from "../src/moves";
import { Plan } from "../src/schema";
import { buildTimeline, followAlongFrames, isPaperScene } from "../src/timeline";

/** Every key pose of a move, both sides. */
const allSteps = (id: (typeof MOVE_IDS)[number]): MoveStep[] => [
  ...moveDef(id).steps,
  ...(moveDef(id).otherSide ?? []),
];

describe("exercise library", () => {
  it("keeps every key pose within reach: no stretched arms or legs", () => {
    const stretched: string[] = [];
    for (const id of MOVE_IDS) {
      allSteps(id).forEach((step, i) => {
        const sk = skeleton(step.pose);
        const limbs = [...sk.legs, ...sk.arms];
        limbs.forEach((limb, j) => {
          if (limb.stretched) stretched.push(`${id} step ${i} limb ${j}`);
        });
      });
    }
    expect(stretched).toEqual([]);
  });

  it("keeps knees and heads above the floor", () => {
    const below: string[] = [];
    for (const id of MOVE_IDS) {
      const floor = moveDef(id).set === "mat" ? MAT : FLOOR;
      allSteps(id).forEach((step, i) => {
        const sk = skeleton(step.pose);
        if (sk.head[1] + BONES.head > floor + 1) below.push(`${id} step ${i} head`);
        sk.legs.forEach((leg, j) => {
          if (leg.joint[1] > floor) below.push(`${id} step ${i} knee ${j}`);
        });
      });
    }
    expect(below).toEqual([]);
  });

  it("counts a rep each time the counted pose is reached", () => {
    const def = moveDef("wall-push-up");
    const cycle = cycleSeconds(def);
    expect(moveAt(def, 0).reps).toBe(0);
    expect(moveAt(def, cycle - 0.01).reps).toBe(0);
    expect(moveAt(def, cycle + 0.01).reps).toBe(1);
    expect(moveAt(def, cycle * 3 + 0.01).reps).toBe(3);
  });

  it("counts both sides of an alternating move", () => {
    const def = moveDef("bird-dog");
    expect(moveAt(def, cycleSeconds(def) + 0.01).reps).toBe(2);
  });

  it("holds the last pose of a hold move and times it", () => {
    const def = moveDef("one-leg-stand");
    const reach = cycleSeconds(def);
    expect(moveAt(def, reach - 0.1).timer).toBe(0);
    expect(moveAt(def, reach + 5).timer).toBeCloseTo(5, 5);
    const foot = moveAt(def, reach + 5).pose.feet[0];
    expect(foot[1]).toBeLessThan(FLOOR - 20);
  });

  it("gives both sides the same start, end and length, so switching is seamless", () => {
    for (const id of MOVE_IDS) {
      const def = moveDef(id);
      if (!def.otherSide) continue;
      const a = def.steps;
      const b = def.otherSide;
      expect(cycleSeconds({ ...def, steps: b }), id).toBeCloseTo(cycleSeconds(def), 5);
      expect(b[0]?.pose, id).toEqual(a[0]?.pose);
      expect(b.filter((s) => s.count).length, id).toBe(a.filter((s) => s.count).length);
      if (def.kind === "reps") expect(b[b.length - 1]?.pose, id).toEqual(a[a.length - 1]?.pose);
    }
  });

  it("switches a reps move to the other side after the given reps, and restarts the count", () => {
    const def = moveDef("back-leg-raise");
    const cycle = cycleSeconds(def);
    const at = (s: number) => moveAt(def, s, { switchEvery: 3 });
    expect(at(cycle * 3 - 0.01)).toMatchObject({ side: 0, reps: 3 });
    expect(at(cycle * 3 + 0.01)).toMatchObject({ side: 1, reps: 0 });
    expect(at(cycle * 4 + 0.01)).toMatchObject({ side: 1, reps: 1 });
    expect(at(cycle * 6 + 0.01).side).toBe(0);
    // Without switchEvery it stays on one side.
    expect(moveAt(def, cycle * 10).side).toBe(0);
  });

  it("switches a hold to the other leg and restarts the timer", () => {
    const def = moveDef("one-leg-stand");
    const reach = cycleSeconds(def);
    const at = (s: number) => moveAt(def, s, { switchEvery: 10 });
    expect(at(reach + 9).side).toBe(0);
    expect(at(reach + 10 + SWITCH_SECONDS + 2)).toMatchObject({ side: 1 });
    expect(at(reach + 10 + SWITCH_SECONDS + 2).timer).toBeCloseTo(2, 5);
    // The far foot is lifted on the second side; the near foot is down.
    const pose = at(reach + 10 + SWITCH_SECONDS + 5).pose;
    expect(pose.feet[1][1]).toBeLessThan(FLOOR - 20);
    expect(pose.feet[0][1]).toBeGreaterThan(FLOOR - 15);
  });

  it("keeps the free hand in reach when a chair move is done one-handed", () => {
    for (const id of MOVE_IDS) {
      if (moveDef(id).set !== "chair-front") continue;
      for (const step of allSteps(id)) {
        const arm = skeleton(oneHanded(step.pose)).arms[0];
        expect(arm.stretched, id).toBe(false);
        expect(arm.end[1], id).toBeGreaterThan(skeleton(step.pose).hip[1]);
      }
    }
  });

  it("frames every move inside a sensible stage area", () => {
    for (const id of MOVE_IDS) {
      const [x0, y0, x1, y1] = moveBounds(moveDef(id), { switchEvery: 4 });
      expect(x1 - x0, id).toBeGreaterThan(90);
      expect(y0, id).toBeGreaterThan(-40);
      expect(y1, id).toBeGreaterThanOrEqual(FLOOR + 14);
    }
  });

  it("moves smoothly: no jumps between frames, on both sides", () => {
    for (const id of MOVE_IDS) {
      const def = moveDef(id);
      const opts = { switchEvery: def.kind === "hold" ? 4 : 2 };
      let prev = moveAt(def, 0, opts).pose;
      for (let f = 1; f < 30 * 30; f++) {
        const pose = moveAt(def, f / 30, opts).pose;
        const points = (p: typeof pose) => [p.hip, ...p.hands, ...p.feet];
        const before = points(prev);
        const jump = Math.max(
          ...points(pose).map((pt, k) => {
            const was = before[k] ?? pt;
            return Math.hypot(pt[0] - was[0], pt[1] - was[1]);
          }),
        );
        expect(jump, `${id} at frame ${f}`).toBeLessThan(20);
        prev = pose;
      }
    }
  });
});

// Channel folders are not in the shared repo, so these checks run only where the channel exists.
const HEALTH_DEMO = path.resolve(import.meta.dirname, "../../../channels/health/demo.json");
const noHealthDemo = !fs.existsSync(HEALTH_DEMO);

describe("health demo plan", () => {
  it.skipIf(noHealthDemo)("is a valid plan that uses the exercise template", () => {
    const result = Plan.safeParse(JSON.parse(fs.readFileSync(HEALTH_DEMO, "utf8")));
    expect(result.success ? "ok" : result.error.issues).toBe("ok");
    const templates = result.success ? result.data.scenes.map((s) => s.template) : [];
    expect(templates.filter((t) => t === "exercise").length).toBeGreaterThanOrEqual(3);
  });

  it.skipIf(noHealthDemo)(
    "marks a Short of 55–95 words (20–40 seconds), with no scene leaning on the long video",
    () => {
      const plan = Plan.parse(JSON.parse(fs.readFileSync(HEALTH_DEMO, "utf8")));
      const short = plan.scenes.filter((s) => s.short);
      const words = short.reduce((n, s) => n + s.narration.split(/\s+/).length, 0);
      expect(words).toBeGreaterThanOrEqual(55);
      expect(words).toBeLessThanOrEqual(95);
      expect(short.map((s) => s.narration).join(" ")).not.toMatch(/move (one|two|three|four)/i);
    },
  );

  it("runs a follow-along scene for its seconds, even with short narration", () => {
    const scene = {
      template: "exercise" as const,
      narration: "Stand up.",
      props: { move: "sit-to-stand" as const, cues: [{ text: "Stand" }], seconds: 30 },
    };
    expect(followAlongFrames(scene)).toBe(14 + 30 * 30);
    const timeline = buildTimeline({
      plan: { version: 1, channel: "x", title: "t", scenes: [scene, scene] },
      voices: [0, 1].map(() => ({ key: "k", file: "f", duration: 1, envelope: [], words: [] })),
      seed: 1,
    });
    expect(timeline.scenes[1]?.duration ?? 0).toBeGreaterThanOrEqual(14 + 30 * 30);
  });

  it("treats a paper exercise as a paper scene (full frame, fades, no captions in landscape)", () => {
    const scene = {
      template: "exercise" as const,
      narration: "Sit tall.",
      props: { move: "chest-stretch" as const, cues: [{ text: "Sit tall" }], paper: true },
    };
    expect(isPaperScene(scene)).toBe(true);
    expect(isPaperScene({ ...scene, props: { ...scene.props, paper: undefined } })).toBe(false);
  });

  it("rejects switchEvery on a move with only one side", () => {
    const result = Plan.safeParse({
      version: 1,
      channel: "x",
      title: "t",
      scenes: [
        {
          template: "exercise",
          narration: "n",
          props: { move: "wall-push-up", cues: [{ text: "Push" }], switchEvery: 5 },
        },
      ],
    });
    const paths = result.success ? [] : result.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("scenes.0.props.switchEvery");
  });

  it("rejects an unknown move", () => {
    const result = Plan.safeParse({
      version: 1,
      channel: "x",
      title: "t",
      scenes: [
        {
          template: "exercise",
          narration: "n",
          props: { move: "burpee", name: "Burpee", cues: [{ text: "Jump" }] },
        },
      ],
    });
    const paths = result.success ? [] : result.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("scenes.0.props.move");
  });
});
