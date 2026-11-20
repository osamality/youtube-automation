import { sampleInput } from "@yt/templates/sample";
import { Plan, type RenderInput } from "@yt/templates/schema";
import { buildTimeline, forFormat } from "@yt/templates/timeline";
import { describe, expect, it } from "vitest";
import { ChannelSchema } from "../src/config";
import { buildKit, captionCues, tagsLength, toSrt, videoKey } from "../src/kit";
import { formatSlot, nextSlot } from "../src/time";

function channel(extra: Record<string, unknown> = {}) {
  return ChannelSchema.parse({
    id: "biztech",
    name: "Next Big Tech",
    language: "en",
    audience: "adults",
    tone: "clear",
    formats: ["long", "shorts"],
    voice: { provider: "kokoro", id: "af_bella" },
    theme: { palette: "neon-night", font: "Montserrat" },
    templates: ["hook"],
    schedule: { long_per_week: 1, shorts_per_day: 1 },
    ...extra,
  });
}

const upload = {
  titles: ["How it began", "A second title"],
  thumbnails: [{ text: "Big words here", highlight: "words" }],
  tags: ["nvidia", "jensen huang"],
  hashtags: ["#Nvidia"],
  question: "Next Cisco, or not?",
};

function input(extra: Partial<RenderInput["plan"]> = {}): RenderInput {
  const base = sampleInput();
  return { ...base, plan: { ...base.plan, ...extra } };
}

/** Tuesday 10/11/2026, 12:00 in Dubai, 03:00 in New York. */
const NOW = new Date("2026-11-10T08:00:00Z");

describe("publish slots", () => {
  it("picks the next allowed weekday at the channel's local time, at least 12 hours out", () => {
    const publish = { days: ["tue", "wed", "thu"], time: "15:00", timezone: "America/New_York" };
    const slot = nextSlot(NOW, publish);
    expect(formatSlot(slot, "America/New_York")).toBe("Tue 10/11/2026, 15:00");
    expect(formatSlot(slot, "Asia/Dubai")).toBe("Wed 11/11/2026, 00:00");
    expect(formatSlot(nextSlot(NOW, { ...publish, days: ["thu"] }), "America/New_York")).toBe(
      "Thu 12/11/2026, 15:00",
    );
  });
});

describe("captions", () => {
  it("splits the narration into short, non-overlapping lines in SubRip format", () => {
    const cues = captionCues(buildTimeline(sampleInput()));
    expect(cues.length).toBeGreaterThan(5);
    cues.forEach((cue, i) => {
      expect(cue.end).toBeGreaterThan(cue.start);
      const next = cues[i + 1];
      if (next) expect(cue.end).toBeLessThanOrEqual(next.start);
      if (cue.text.includes(" ")) expect(cue.text.length).toBeLessThanOrEqual(42);
    });
    expect(toSrt(cues)).toMatch(/^1\n00:00:\d\d,\d{3} --> 00:00:\d\d,\d{3}\n\S/);
  });
});

describe("upload kit", () => {
  it("counts tags the way YouTube does", () => {
    expect(tagsLength(["a b", "c"])).toBe(7);
    expect(tagsLength([])).toBe(0);
  });

  it("fills the form from the plan and the channel, and opens the pinned comment with the question", () => {
    const kit = buildKit({
      input: input({ upload }),
      channel: channel({ youtube: { category: "Science & Technology", tags: ["business"] } }),
      renders: { long: "ok", short: "ok" },
      thumbnails: [{ file: "thumbnail-1.jpg", bytes: 300_000 }],
      now: NOW,
    });
    expect(kit.markdown).toContain("| Title | How it began |");
    expect(kit.markdown).toContain("A second title");
    expect(kit.markdown).toContain("nvidia, jensen huang, business");
    expect(kit.markdown).toContain("Science & Technology");
    expect(kit.markdown).toContain("Wed 11/11/2026, 00:00 Gulf time");
    expect(kit.comment?.startsWith("Next Cisco, or not?")).toBe(true);
    expect(kit.description.trim().endsWith("#Nvidia")).toBe(true);
    // The sample plan's Short is the whole 55-second demo, longer than the 20–40 second house rule.
    expect(kit.checks.filter((c) => c.status === "fail").map((c) => c.text)).toEqual([
      "Short: 55 seconds (the channel's range is 20–40).",
    ]);
  });

  it("fails on a working-title channel name and an out-of-date video", () => {
    const kit = buildKit({
      input: input({ upload }),
      channel: channel({ name: "Career Compass (working title)" }),
      renders: { long: "stale", short: "missing" },
      thumbnails: null,
      now: NOW,
    });
    const fails = kit.checks.filter((c) => c.status === "fail").map((c) => c.text);
    expect(fails.some((t) => t.includes("working title"))).toBe(true);
    expect(fails.some((t) => t.includes("long.mp4 is older"))).toBe(true);
    expect(fails.some((t) => t.includes("short.mp4 isn't rendered"))).toBe(true);
  });

  it("turns off comments, end screens and remixing on kids' channels", () => {
    const kit = buildKit({
      input: input({ upload }),
      channel: channel({ made_for_kids: true }),
      renders: {},
      thumbnails: null,
      now: NOW,
    });
    expect(kit.comment).toBeNull();
    expect(kit.markdown).toContain("Yes, it's made for kids");
    expect(kit.markdown).toContain("doesn't show them on videos made for kids");
  });
});

describe("video keys", () => {
  it("ignore upload details but change with what the video shows", () => {
    const base = input();
    const key = videoKey(base, "long");
    expect(videoKey(input({ upload, summary: "New summary." }), "long")).toBe(key);
    const scenes = base.plan.scenes.map((s, i) =>
      i === 0 ? { ...s, narration: `${s.narration} More.` } : s,
    );
    expect(videoKey(input({ scenes }), "long")).not.toBe(key);
  });
});

describe("end screen scene", () => {
  const plan = (templates: string[]) => ({
    version: 1,
    channel: "biztech",
    title: "T",
    scenes: templates.map((t) =>
      t === "endscreen"
        ? { template: t, narration: "Thanks.", props: { title: "Next story" } }
        : { template: t, narration: "Hello there.", props: { title: "Hello" } },
    ),
  });

  it("must be last, and stays out of the Short", () => {
    expect(Plan.safeParse(plan(["hook", "endscreen"])).success).toBe(true);
    expect(Plan.safeParse(plan(["endscreen", "hook"])).success).toBe(false);
    const parsed = Plan.parse(plan(["hook", "hook", "endscreen"]));
    const voices = parsed.scenes.map(
      () => sampleInput().voices[0] as RenderInput["voices"][number],
    );
    const short = forFormat({ plan: parsed, voices }, "short");
    expect(short.plan.scenes.map((s) => s.template)).toEqual(["hook", "hook"]);
  });
});

describe("long uploads", () => {
  it("blocks videos over 15 minutes until the channel is verified", () => {
    const base = input({ upload });
    const long = {
      ...base,
      voices: base.voices.map((v) => ({ ...v, duration: v.duration + 1000 })),
    };
    const blocked = (verified: boolean) =>
      buildKit({
        input: long,
        channel: channel({ youtube: { verified } }),
        renders: {},
        thumbnails: null,
        now: NOW,
      }).checks.some((c) => c.status === "fail" && c.text.includes("youtube.com/verify"));
    expect(blocked(false)).toBe(true);
    expect(blocked(true)).toBe(false);
  });
});

describe("short length", () => {
  it("fails a Short outside the channel's 20–40 second range", () => {
    const kit = buildKit({
      input: input({ upload }),
      channel: channel(),
      renders: {},
      thumbnails: null,
      now: NOW,
    });
    const short = kit.checks.find((c) => c.text.startsWith("Short:"));
    expect(short?.status).toBe("fail");
    expect(short?.text).toContain("20–40");
  });
});
