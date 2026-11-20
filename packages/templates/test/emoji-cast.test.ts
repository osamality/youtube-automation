import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildEmojiIndex, collectEmoji, emojiFile, emojiRepoPath } from "../src/emoji";
import { characterStates } from "../src/remotion/Character";
import { Plan } from "../src/schema";

const TREE = [
  "assets/Briefcase/3D/briefcase_3d.png",
  "assets/Briefcase/Color/briefcase_color.svg",
  "assets/Man office worker/Default/3D/man_office_worker_3d_default.png",
  "assets/Man office worker/Medium-Dark/3D/man_office_worker_3d_medium-dark.png",
  "assets/1st place medal/3D/1st_place_medal_3d.png",
  "README.md",
];

describe("emoji index", () => {
  const index = buildEmojiIndex(TREE);

  it("maps kebab-case names to 3D PNG paths and ignores everything else", () => {
    expect(Object.keys(index).sort()).toEqual([
      "1st-place-medal",
      "briefcase",
      "man-office-worker",
    ]);
    expect(emojiRepoPath(index, "briefcase")).toBe("assets/Briefcase/3D/briefcase_3d.png");
  });

  it("resolves skin tones, defaulting to the yellow default tone", () => {
    expect(emojiRepoPath(index, "man-office-worker")).toBe(
      "assets/Man office worker/Default/3D/man_office_worker_3d_default.png",
    );
    expect(emojiRepoPath(index, "man-office-worker:medium-dark")).toBe(
      "assets/Man office worker/Medium-Dark/3D/man_office_worker_3d_medium-dark.png",
    );
  });

  it("returns null for unknown names", () => {
    expect(emojiRepoPath(index, "spaceship")).toBeNull();
  });

  it("keeps tone variants apart in media/", () => {
    expect(emojiFile("man-office-worker:medium")).toBe("emoji/man-office-worker_medium.png");
  });
});

describe("collectEmoji", () => {
  it("finds every emoji and avatar anywhere in a plan, once each", () => {
    const plan = {
      scenes: [
        { props: { emoji: "trophy", chips: [{ emoji: "fire" }, { emoji: "trophy" }] } },
        { props: { avatar: "robot" }, stickers: [{ emoji: "eyes" }] },
      ],
    };
    expect(collectEmoji(plan).sort()).toEqual(["eyes", "fire", "robot", "trophy"]);
  });
});

describe("characterStates", () => {
  it("starts from the base pose and carries pose or mood forward through beats", () => {
    const states = characterStates({ pose: "type" }, [
      { at: 40, mood: "worried" },
      { at: 90, pose: "celebrate" },
    ]);
    expect(states).toEqual([
      { from: 0, pose: "type", mood: "neutral" },
      { from: 40, pose: "type", mood: "worried" },
      { from: 90, pose: "celebrate", mood: "worried" },
    ]);
  });
});

// Channel folders are not in the shared repo, so this check runs only where the channel exists.
const CAREER_DEMO = path.resolve(import.meta.dirname, "../../../channels/career/demo.json");

describe("career demo plan", () => {
  it.skipIf(!fs.existsSync(CAREER_DEMO))("is a valid plan that uses the new templates", () => {
    const result = Plan.safeParse(JSON.parse(fs.readFileSync(CAREER_DEMO, "utf8")));
    expect(result.success ? "ok" : result.error.issues).toBe("ok");
    const templates = result.success ? result.data.scenes.map((s) => s.template) : [];
    expect(templates).toEqual(expect.arrayContaining(["story", "chat", "tip"]));
  });

  it("rejects an unknown cast member and a malformed emoji name", () => {
    const bad = {
      version: 1,
      channel: "x",
      title: "t",
      scenes: [
        { template: "story", narration: "n", props: { character: { who: "zed" } } },
        { template: "tip", narration: "n", props: { number: 1, title: "t", emoji: "Brief Case" } },
      ],
    };
    const result = Plan.safeParse(bad);
    const paths = result.success ? [] : result.error.issues.map((i) => i.path.join("."));
    expect(paths).toContain("scenes.0.props.character.who");
    expect(paths).toContain("scenes.1.props.emoji");
  });
});
