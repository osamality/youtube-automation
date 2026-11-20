import { describe, expect, it } from "vitest";
import { collectLogos, resolveLogos } from "../src/logos";

describe("logos", () => {
  it("collects every logo key in a plan once", () => {
    const plan = {
      scenes: [{ props: { logo: "nvidia", items: [{ logo: "intel" }, { logo: "nvidia" }] } }],
    };
    expect(collectLogos(plan).sort()).toEqual(["intel", "nvidia"]);
  });

  it("resolves Simple Icons slugs, names text-only brands and flags unknown slugs", () => {
    const { logos, unknown } = resolveLogos(["nvidia", "openai", "nvdia"]);
    expect(logos.nvidia?.hex).toBe("#76B900");
    expect(logos.nvidia?.path).toMatch(/^M/);
    expect(logos.openai).toEqual({ title: "OpenAI", hex: null, path: null });
    expect(unknown).toEqual(["nvdia"]);
  });
});
