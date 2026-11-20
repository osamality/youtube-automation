import { describe, expect, it } from "vitest";
import { chunkWords } from "../src/remotion/Captions";
import { isBrowserCrash } from "../src/render";
import type { TimedWord } from "../src/timeline";

/** Words 10 frames apart with no long pauses. */
function words(text: string): TimedWord[] {
  return text.split(" ").map((t, i) => ({ text: t, start: i * 10, end: i * 10 + 8 }));
}

const lines = (text: string, max: number) =>
  chunkWords(words(text), max).map((c) => c.words.map((w) => w.text).join(" "));

describe("chunkWords", () => {
  it("splits a long stretch into near-equal lines, never leaving one word alone", () => {
    expect(lines("Netflix made thirty nine billion dollars in 2024.", 6)).toEqual([
      "Netflix made thirty nine",
      "billion dollars in 2024.",
    ]);
    expect(lines("one two three four five six seven", 6)).toEqual([
      "one two three four",
      "five six seven",
    ]);
  });

  it("breaks after punctuation", () => {
    expect(lines("In 2024, it grew fast.", 6)).toEqual(["In 2024,", "it grew fast."]);
  });

  it("never shows two lines at once", () => {
    const chunks = chunkWords(words("a b c d e f g h"), 3);
    for (let i = 0; i < chunks.length - 1; i++) {
      expect(chunks[i]?.until).toBeLessThan(chunks[i + 1]?.start ?? 0);
    }
  });
});

describe("isBrowserCrash", () => {
  it("recognises Chrome tab and browser crashes only", () => {
    expect(
      isBrowserCrash(new Error("Protocol error (Runtime.callFunctionOn): Target closed.")),
    ).toBe(true);
    expect(isBrowserCrash(new Error("Protocol error (Target.createTarget): Target closed"))).toBe(
      true,
    );
    expect(isBrowserCrash(new Error("No plan.json found"))).toBe(false);
  });
});
