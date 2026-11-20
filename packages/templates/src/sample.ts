import demo from "../demo/plan.json";
import { FPS } from "./constants";
import type { Plan, RenderInput } from "./schema";
import { estimateWordTimings } from "./words";

/** Silent stand-in for Remotion Studio when no real props are passed: demo plan + estimated timings. */
export function sampleInput(): RenderInput {
  const plan = demo as unknown as Plan;
  return {
    plan,
    voices: plan.scenes.map((scene) => {
      const words = scene.narration.split(/\s+/).length;
      const duration = words * 0.36 + 0.5;
      const frames = Math.ceil(duration * FPS);
      return {
        key: "sample",
        file: "",
        duration,
        envelope: Array.from(
          { length: frames },
          (_, i) => Math.round(Math.max(0, Math.sin(i / 2.2) * Math.sin(i / 7.3)) * 100) / 100,
        ),
        words: estimateWordTimings(scene.narration, 0.15, duration - 0.25),
      };
    }),
    theme: { palette: "dark-blue", font: "Inter" },
    channelName: "How It Actually Works",
    mascot: "robot",
    seed: 7,
    music: null,
    musicVolume: 0.15,
    sfx: false,
    logos: {},
  };
}
