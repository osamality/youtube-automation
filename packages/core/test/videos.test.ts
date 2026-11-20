import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { fromRoot } from "../src/paths";
import { folderDate, slugify } from "../src/time";
import { addTopic, getTopic } from "../src/topics";
import {
  approve,
  completeStep,
  createVideo,
  failStep,
  requireVideo,
  rewind,
  STEPS,
  startStep,
  summarize,
} from "../src/videos";
import { useTempRoot } from "./helpers";

const t = useTempRoot();

function runStep(videoId: number, step: (typeof STEPS)[number]["id"]) {
  startStep(t.db(), videoId, step);
  completeStep(t.db(), videoId, step);
}

describe("createVideo", () => {
  it("takes the next topic, creates the folder and every step as pending", () => {
    const db = t.db();
    const topic = addTopic(db, "biztech", "How Netflix makes money");
    const video = createVideo(db, "biztech");

    expect(video.folder).toBe(`data/biztech/videos/${folderDate()}_how-netflix-makes-money`);
    expect(fs.existsSync(fromRoot(video.folder))).toBe(true);
    expect(video.steps.map((s) => s.step)).toEqual(STEPS.map((s) => s.id));
    expect(video.steps.every((s) => s.state === "pending")).toBe(true);
    expect(getTopic(db, topic.id)?.status).toBe("used");
    expect(summarize(video)).toMatchObject({ status: "in_progress", current: { step: "script" } });
  });

  it("gives same-day duplicates a numbered folder", () => {
    const db = t.db();
    addTopic(db, "biztech", "Same title");
    addTopic(db, "biztech", "Same  title!");
    const a = createVideo(db, "biztech");
    const b = createVideo(db, "biztech");
    expect(b.folder).toBe(`${a.folder}-2`);
  });

  it("explains what to do when the queue is empty", () => {
    expect(() => createVideo(t.db(), "biztech")).toThrow(/yt topics add biztech/);
  });
});

describe("step machine", () => {
  function newVideo() {
    addTopic(t.db(), "biztech", `Topic ${Math.random()}`);
    return createVideo(t.db(), "biztech").id;
  }

  it("only the current step can run", () => {
    const id = newVideo();
    expect(() => startStep(t.db(), id, "voice")).toThrow(/is at "script"/);
    startStep(t.db(), id, "script");
    expect(summarize(requireVideo(t.db(), id)).status).toBe("running");
    expect(() => startStep(t.db(), id, "script")).toThrow(/already running/);
  });

  it("stops at approval gates until approved", () => {
    const id = newVideo();
    runStep(id, "script");
    const video = requireVideo(t.db(), id);
    expect(summarize(video)).toMatchObject({
      status: "needs_review",
      current: { step: "approve_script" },
    });
    expect(() => startStep(t.db(), id, "approve_script")).toThrow(/approval step/);
    expect(approve(t.db(), id)).toBe("approve_script");
    expect(summarize(requireVideo(t.db(), id)).current?.step).toBe("voice");
    expect(() => approve(t.db(), id)).toThrow(/not waiting for approval/);
  });

  it("records failures and counts retries", () => {
    const id = newVideo();
    startStep(t.db(), id, "script");
    failStep(t.db(), id, "script", "API timeout");
    let video = requireVideo(t.db(), id);
    expect(summarize(video)).toMatchObject({
      status: "failed",
      current: { step: "script", error: "API timeout", attempts: 1 },
    });

    runStep(id, "script");
    video = requireVideo(t.db(), id);
    expect(video.steps[0]).toMatchObject({ state: "done", attempts: 2, error: null });
  });

  it("reaches published after every step, and rewind re-opens later steps", () => {
    const id = newVideo();
    for (const step of STEPS) {
      if (step.kind === "gate") approve(t.db(), id);
      else runStep(id, step.id);
    }
    expect(summarize(requireVideo(t.db(), id)).status).toBe("published");

    rewind(t.db(), id, "render");
    const video = requireVideo(t.db(), id);
    const states = Object.fromEntries(video.steps.map((s) => [s.step, s.state]));
    expect(states).toMatchObject({
      plan: "done",
      render: "pending",
      approve_video: "pending",
      upload: "pending",
    });
    expect(summarize(video).current?.step).toBe("render");
  });
});

describe("slugify", () => {
  it("makes safe folder names", () => {
    expect(slugify("How Netflix makes $$$ — in 2026?")).toBe("how-netflix-makes-in-2026");
    expect(slugify("Café déjà vu")).toBe("cafe-deja-vu");
    expect(slugify("!!!")).toBe("video");
    expect(slugify("a".repeat(100)).length).toBe(60);
  });
});
