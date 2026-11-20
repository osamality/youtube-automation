import { Plan } from "@yt/templates/schema";
import { describe, expect, it } from "vitest";
import { photoCreditLines } from "../src/photos";

const base = {
  version: 1,
  channel: "biztech",
  title: "Test",
  photos: [
    { id: "jensen", commons: "File:Jensen Huang (cropped) (2024).jpg", name: "Jensen Huang" },
  ],
};

describe("plan photos", () => {
  it("accepts scenes and thumbnails that use listed photos", () => {
    const plan = Plan.safeParse({
      ...base,
      scenes: [
        {
          template: "photo",
          narration: "This is Jensen Huang.",
          props: { photo: "jensen", name: "Jensen Huang" },
        },
      ],
      upload: { titles: ["T"], thumbnails: [{ text: "Big words", photos: ["jensen"] }] },
    });
    expect(plan.success).toBe(true);
  });

  it("rejects a photo id that isn't in plan.photos", () => {
    const plan = Plan.safeParse({
      ...base,
      scenes: [
        {
          template: "quote",
          narration: "A quote.",
          props: { text: "A quote.", by: "X", photo: "nobody" },
        },
      ],
    });
    expect(plan.success).toBe(false);
    expect(JSON.stringify(plan.error?.issues)).toContain('unknown photo \\"nobody\\"');
  });

  it("rejects a Commons name without File: or an image extension", () => {
    const plan = Plan.safeParse({
      ...base,
      photos: [{ id: "x", commons: "Jensen Huang" }],
      scenes: [{ template: "hook", narration: "Hi.", props: { title: "Hi" } }],
    });
    expect(plan.success).toBe(false);
  });

  it("writes one credit line per photo, named by the plan", () => {
    const lines = photoCreditLines(base as never, [
      {
        id: "jensen",
        title: "File:Jensen Huang (cropped) (2024).jpg",
        author: "Peter DaSilva",
        license: "CC BY 4.0",
        url: "https://commons.wikimedia.org/wiki/File:Jensen_Huang.jpg",
      },
    ]);
    expect(lines).toEqual([
      "Jensen Huang: photo by Peter DaSilva, CC BY 4.0, via Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Jensen_Huang.jpg",
    ]);
  });
});
