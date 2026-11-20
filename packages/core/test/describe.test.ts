import { sampleInput } from "@yt/templates/sample";
import { describe, expect, it } from "vitest";
import { DESCRIPTION_MAX_BYTES, describeVideo } from "../src/kit";

function withSources(count: number) {
  const input = sampleInput();
  input.plan = {
    ...input.plan,
    summary: "One line about the video.",
    sources: Array.from({ length: count }, (_, i) => ({
      label: `Source number ${i} <with brackets>`,
      url: `https://example.com/a-fairly-long-path/that-keeps-going/to-source-${i}`,
    })),
  };
  return input;
}

describe("describeVideo", () => {
  it("opens with the summary and keeps sources in the description when they fit", () => {
    const { text, comment } = describeVideo(withSources(3));
    expect(text.startsWith("One line about the video.\n")).toBe(true);
    expect(text).toContain("Sources\nSource number 0 with brackets: https://example.com/");
    expect(text).not.toMatch(/[<>]/);
    expect(comment).toBeNull();
  });

  it("moves sources to a pinned comment when they would push past YouTube's limit", () => {
    const { text, comment } = describeVideo(withSources(60));
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(DESCRIPTION_MAX_BYTES);
    expect(text).toContain("Sources: see the pinned comment.");
    expect(comment?.split("\n").filter((line) => line.startsWith("Source number"))).toHaveLength(
      60,
    );
  });
});

describe("describeVideo with photo credits", () => {
  const credits = [
    "Jensen Huang: photo by Someone, CC BY 4.0, via Wikimedia Commons: https://commons.wikimedia.org/wiki/File:X.jpg",
  ];

  it("lists photo credits after the sources", () => {
    const { text, comment } = describeVideo(withSources(3), credits);
    expect(text.indexOf("Photo credits")).toBeGreaterThan(text.indexOf("Sources"));
    expect(text).toContain(credits[0]);
    expect(comment).toBeNull();
  });

  it("keeps the credits in the description when only the sources overflow", () => {
    const { text, comment } = describeVideo(withSources(60), credits);
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(DESCRIPTION_MAX_BYTES);
    expect(text).toContain("Photo credits");
    expect(comment).toContain("Sources");
    expect(comment).not.toContain("Photo credits");
  });
});

describe("describeVideo news layout", () => {
  it("orders summary, key figures, question, chapters and the figures-as-of line", () => {
    const input = withSources(2);
    input.plan = {
      ...input.plan,
      upload: {
        titles: ["T"],
        thumbnails: [{ text: "Big words" }],
        keyFigures: "Key figures paragraph.",
        question: "What do you think?",
        figuresAsOf: "Figures as of 10/11/2026, from CNBC.",
      },
    };
    const { text } = describeVideo(input);
    const at = (s: string) => text.indexOf(s);
    expect(at("One line about the video.")).toBe(0);
    expect(at("Key figures paragraph.")).toBeGreaterThan(0);
    expect(at("What do you think?")).toBeGreaterThan(at("Key figures paragraph."));
    expect(at("Figures as of 10/11/2026")).toBeGreaterThan(at("What do you think?"));
    expect(at("Sources")).toBeGreaterThan(at("Figures as of"));
  });
});
