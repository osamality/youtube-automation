import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ChannelConfigError,
  createChannel,
  listChannels,
  loadChannel,
  requireChannel,
} from "../src/config";
import { paths } from "../src/paths";
import { useTempRoot } from "./helpers";

useTempRoot();

function editConfig(id: string, edit: (yaml: string) => string): void {
  const file = paths.channelConfig(id);
  fs.writeFileSync(file, edit(fs.readFileSync(file, "utf8")));
}

describe("createChannel", () => {
  it("copies the template and produces a valid config", () => {
    const channel = createChannel("biztech", 'How It "Actually" Works: Tech');
    expect(channel.id).toBe("biztech");
    expect(channel.name).toBe('How It "Actually" Works: Tech');
    expect(channel.formats).toEqual(["long", "shorts"]);
    expect(channel.voice.speed).toBe(1.15);
    // No sound: block in the file → effects on, music at the default level.
    expect(channel.sound).toEqual({ sfx: true, music_volume: 0.15 });
    expect(fs.existsSync(`${paths.channel("biztech")}/prompts/script.md`)).toBe(true);
    const prompt = fs.readFileSync(`${paths.channel("biztech")}/prompts/script.md`, "utf8");
    expect(prompt).toContain('How It "Actually" Works: Tech');
    expect(fs.readFileSync(paths.channelConfig("biztech"), "utf8")).not.toMatch(/__ID__|__NAME__/);
  });

  it("rejects bad ids, empty names and existing folders", () => {
    expect(() => createChannel("Biz Tech", "x")).toThrow(/Invalid channel id/);
    expect(() => createChannel("-biz", "x")).toThrow(/Invalid channel id/);
    expect(() => createChannel("biztech", "   ")).toThrow(/name must not be empty/);
    createChannel("biztech", "One");
    expect(() => createChannel("biztech", "Two")).toThrow(/already exists/);
  });
});

describe("loadChannel", () => {
  it("lists every problem with its field path", () => {
    createChannel("biztech", "Biz");
    editConfig("biztech", (y) =>
      y
        .replace("provider: kokoro", "provider: robot-voice")
        .replace("formats: [long, shorts]", "formats: []")
        .replace("long_per_week: 2", "long_per_week: 1.5"),
    );
    try {
      loadChannel("biztech");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ChannelConfigError);
      const problems = (err as ChannelConfigError).problems.join("\n");
      expect(problems).toMatch(/^voice\.provider:/m);
      expect(problems).toMatch(/^formats:/m);
      expect(problems).toMatch(/^schedule\.long_per_week:/m);
    }
  });

  it("rejects unknown keys (catches typos)", () => {
    createChannel("biztech", "Biz");
    editConfig("biztech", (y) => `${y}\nshedule_typo: 1\n`);
    expect(() => loadChannel("biztech")).toThrow(/shedule_typo/);
  });

  it("requires id to match the folder name", () => {
    createChannel("biztech", "Biz");
    editConfig("biztech", (y) => y.replace("id: biztech", "id: other"));
    expect(() => loadChannel("biztech")).toThrow(/must match the folder name/);
  });

  it("defaults to not made for kids and no series", () => {
    const channel = createChannel("biztech", "Biz");
    expect(channel.made_for_kids).toBe(false);
    expect(channel.series).toBeUndefined();
  });

  it("reads made_for_kids and series, each series with its own narrator", () => {
    createChannel("kids-ar", "Kids Arabic");
    editConfig(
      "kids-ar",
      (y) => `${y}
made_for_kids: true
series:
  - id: arabic-beginners
    name: Arabic for beginners
    narration: en
    audience: Non-native children aged 3-6
  - id: arabic-native
    name: Arabic for Arabic speakers
    narration: ar
    audience: Arabic-speaking children aged 3-6
    voice: { provider: elevenlabs, id: some-arabic-voice }
`,
    );
    const channel = loadChannel("kids-ar");
    expect(channel.made_for_kids).toBe(true);
    expect(channel.series?.map((s) => [s.id, s.narration])).toEqual([
      ["arabic-beginners", "en"],
      ["arabic-native", "ar"],
    ]);
    expect(channel.series?.[0]?.voice).toBeUndefined();
    expect(channel.series?.[1]?.voice).toEqual({
      provider: "elevenlabs",
      id: "some-arabic-voice",
      speed: 1,
    });
  });

  it("rejects duplicate series ids", () => {
    createChannel("kids-ar", "Kids Arabic");
    editConfig(
      "kids-ar",
      (y) => `${y}
series:
  - { id: beginners, name: A, narration: en, audience: a }
  - { id: beginners, name: B, narration: ar, audience: b }
`,
    );
    expect(() => loadChannel("kids-ar")).toThrow(/series: series ids must be unique/);
  });

  it("reports YAML syntax errors", () => {
    createChannel("biztech", "Biz");
    editConfig("biztech", (y) => `${y}\nvoice: [unclosed\n`);
    expect(() => loadChannel("biztech")).toThrow(/YAML syntax/);
  });
});

describe("listChannels", () => {
  it("returns valid and broken channels, skipping _ and . folders", () => {
    createChannel("biztech", "Biz");
    createChannel("psych", "Psych");
    editConfig("psych", (y) => y.replace(/^audience:.*$/m, 'audience: ""'));
    fs.mkdirSync(`${paths.channels()}/_drafts`);
    fs.mkdirSync(`${paths.channels()}/.hidden`);

    const entries = listChannels();
    expect(entries.map((e) => [e.id, e.ok])).toEqual([
      ["biztech", true],
      ["psych", false],
    ]);
  });

  it("requireChannel names the known channels when the id is wrong", () => {
    createChannel("biztech", "Biz");
    expect(() => requireChannel("biztek")).toThrow(/Known channels: biztech/);
  });
});
