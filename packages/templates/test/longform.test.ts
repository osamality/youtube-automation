import { describe, expect, it } from "vitest";
import { quoteWordTimes } from "../src/remotion/scenes/Quote";
import { chunkRanges } from "../src/render";
import { Plan, type RenderInput, type Scene, type SceneVoice } from "../src/schema";
import { buildTimeline, chapterLines, chapterMarks, forFormat, timestamp } from "../src/timeline";

const voice = (seconds: number): SceneVoice => ({
  key: "k",
  file: "voice/x.wav",
  duration: seconds,
  envelope: [],
  words: [],
});

function input(scenes: Scene[], seconds: number[]): Pick<RenderInput, "plan" | "voices" | "seed"> {
  return {
    plan: { version: 1, channel: "biztech", title: "t", scenes },
    voices: seconds.map(voice),
    seed: 1,
  };
}

const hook = (title: string, short?: "also" | "only"): Scene => ({
  template: "hook",
  narration: title,
  props: { title },
  ...(short ? { short } : {}),
});
const chapter = (number: number, title: string): Scene => ({
  template: "chapter",
  narration: title,
  props: { number, title },
});

describe("forFormat", () => {
  it("shows every scene in both formats when nothing is marked", () => {
    const i = input([hook("a"), hook("b")], [2, 2]);
    expect(forFormat(i, "short").plan.scenes).toHaveLength(2);
    expect(forFormat(i, "long").plan.scenes).toHaveLength(2);
  });

  it("keeps marked scenes for the Short and drops short-only scenes from the long video", () => {
    const i = input([hook("a", "also"), hook("b"), hook("c", "only")], [2, 3, 4]);
    const short = forFormat(i, "short");
    expect(short.plan.scenes.map((s) => s.narration)).toEqual(["a", "c"]);
    expect(short.voices.map((v) => v.duration)).toEqual([2, 4]);
    expect(forFormat(i, "long").plan.scenes.map((s) => s.narration)).toEqual(["a", "b"]);
  });
});

describe("chapters", () => {
  it("adds an Intro at 0:00 and one line per chapter scene", () => {
    const t = buildTimeline(
      input(
        [
          hook("cold open"),
          chapter(1, "The booth"),
          hook("x"),
          chapter(2, "Thirty days"),
          hook("y"),
        ],
        [20, 4, 30, 4, 20],
      ),
    );
    const marks = chapterMarks(t);
    expect(marks.map((m) => m.title)).toEqual(["Intro", "The booth", "Thirty days"]);
    expect(marks[0]?.seconds).toBe(0);
    const lines = chapterLines(marks, Math.floor(t.durationInFrames / 30));
    expect(lines?.[0]).toBe("0:00 Intro");
    expect(lines).toHaveLength(3);
  });

  it("refuses chapter lists YouTube would reject", () => {
    expect(
      chapterLines(
        [
          { seconds: 0, title: "a" },
          { seconds: 30, title: "b" },
        ],
        90,
      ),
    ).toBeNull();
    expect(
      chapterLines(
        [
          { seconds: 0, title: "a" },
          { seconds: 5, title: "b" },
          { seconds: 40, title: "c" },
        ],
        90,
      ),
    ).toBeNull();
  });

  it("formats hours when needed", () => {
    expect(timestamp(65)).toBe("1:05");
    expect(timestamp(3725)).toBe("1:02:05");
  });
});

describe("chunkRanges", () => {
  it("splits into equal chunks with a shorter last one", () => {
    expect(chunkRanges(4000, 1800)).toEqual([
      [0, 1799],
      [1800, 3599],
      [3600, 3999],
    ]);
    expect(chunkRanges(3600, 1800)).toHaveLength(2);
  });
});

describe("quoteWordTimes", () => {
  it("follows the narration word by word when the narrator reads the quote", () => {
    const ctx = {
      index: 0,
      duration: 200,
      enter: 6,
      voiceStart: 10,
      voiceFrames: 150,
      envelope: [],
      words: ["He", "said:", "We", "were", "thirty", "days", "away."].map((text, i) => ({
        text,
        start: 10 + i * 10,
        end: 18 + i * 10,
      })),
    };
    expect(quoteWordTimes("We were thirty days away.", ctx)).toEqual([30, 40, 50, 60, 70]);
  });
});

describe("documentary plans", () => {
  const base = {
    version: 1,
    channel: "biztech",
    title: "t",
    cast: [
      {
        id: "founder",
        name: "Founder",
        skin: "#E0B090",
        hair: "short",
        hairColor: "#333333",
        top: "#111111",
        top2: "#2A2A2A",
      },
    ],
  };

  it("accepts characters from plan.cast, places, logos and sources", () => {
    const plan = {
      ...base,
      sources: [{ label: "Nvidia newsroom", url: "https://nvidianews.nvidia.com/" }],
      scenes: [
        {
          template: "place",
          narration: "n",
          props: {
            place: "diner",
            characters: [{ who: "founder", label: "Founder" }, { who: "maya" }],
          },
          stickers: [{ logo: "nvidia" }],
        },
        { template: "quote", narration: "n", props: { text: "q", by: "Someone" } },
        {
          template: "logos",
          narration: "n",
          props: { title: "t", items: [{ logo: "nvidia" }, { logo: "openai" }] },
        },
      ],
    };
    const result = Plan.safeParse(plan);
    expect(result.success ? "ok" : result.error.issues).toBe("ok");
  });

  it("rejects unknown characters, built-in id clashes and stickers without a picture", () => {
    const plan = {
      ...base,
      cast: [...base.cast, { ...base.cast[0], id: "maya" }],
      scenes: [
        {
          template: "place",
          narration: "n",
          props: { place: "stage", characters: [{ who: "ghost" }] },
        },
        { template: "hook", narration: "n", props: { title: "t" }, stickers: [{ at: "x" }] },
      ],
    };
    const result = Plan.safeParse(plan);
    const paths = result.success ? [] : result.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("scenes.0.props.characters.0.who");
    expect(paths).toContain("cast");
    expect(paths).toContain("scenes.1.stickers.0");
  });
});
