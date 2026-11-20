import fs from "node:fs";
import path from "node:path";
import type { DB } from "./db";
import { paths, relToRoot } from "./paths";
import { folderDate, nowIso, slugify } from "./time";
import { nextTopic, type Topic } from "./topics";

/**
 * Every video walks these steps in order. "gate" steps wait for a person to approve.
 * Status lives in the database; the video folder holds only the files each step produces.
 */
export const STEPS = [
  { id: "script", kind: "auto", label: "Write script" },
  { id: "approve_script", kind: "gate", label: "Approve script" },
  { id: "voice", kind: "auto", label: "Record voice" },
  { id: "timings", kind: "auto", label: "Word timings" },
  { id: "plan", kind: "auto", label: "Scene plan" },
  { id: "render", kind: "auto", label: "Render videos" },
  { id: "package", kind: "auto", label: "Title, description, thumbnail" },
  { id: "approve_video", kind: "gate", label: "Approve video" },
  { id: "upload", kind: "auto", label: "Upload" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];
export type StepState = "pending" | "running" | "done" | "failed";
export type VideoStatus = "in_progress" | "running" | "needs_review" | "failed" | "published";

export interface StepRecord {
  step: StepId;
  state: StepState;
  attempts: number;
  error: string | null;
  updated_at: string;
}

export interface Video {
  id: number;
  channel_id: string;
  topic_id: number | null;
  title: string;
  slug: string;
  /** Relative to the repo root, e.g. data/biztech/videos/2026-11-12_how-netflix-makes-money */
  folder: string;
  created_at: string;
  updated_at: string;
  steps: StepRecord[];
}

const STEP_ORDER = new Map<string, number>(STEPS.map((s, i) => [s.id, i]));

export function stepDef(step: StepId) {
  return STEPS[STEP_ORDER.get(step) as number] as (typeof STEPS)[number];
}

/** The first step that is not done decides the video's status. */
export function summarize(video: Pick<Video, "steps">): {
  status: VideoStatus;
  current: StepRecord | undefined;
} {
  const current = video.steps.find((s) => s.state !== "done");
  if (!current) return { status: "published", current };
  if (current.state === "failed") return { status: "failed", current };
  if (current.state === "running") return { status: "running", current };
  return {
    status: stepDef(current.step).kind === "gate" ? "needs_review" : "in_progress",
    current,
  };
}

type VideoRow = Omit<Video, "steps">;

function loadSteps(db: DB, videoId: number): StepRecord[] {
  const rows = db
    .prepare("SELECT step, state, attempts, error, updated_at FROM video_steps WHERE video_id = ?")
    .all(videoId) as StepRecord[];
  return rows.sort((a, b) => (STEP_ORDER.get(a.step) ?? 0) - (STEP_ORDER.get(b.step) ?? 0));
}

export function getVideo(db: DB, id: number): Video | undefined {
  const row = db.prepare("SELECT * FROM videos WHERE id = ?").get(id) as VideoRow | undefined;
  return row && { ...row, steps: loadSteps(db, row.id) };
}

export function requireVideo(db: DB, id: number): Video {
  const video = getVideo(db, id);
  if (!video) throw new Error(`No video #${id}.`);
  return video;
}

export function listVideos(db: DB, filter: { channelId?: string } = {}): Video[] {
  const rows = (
    filter.channelId
      ? db.prepare("SELECT * FROM videos WHERE channel_id = ? ORDER BY id").all(filter.channelId)
      : db.prepare("SELECT * FROM videos ORDER BY id").all()
  ) as VideoRow[];
  return rows.map((row) => ({ ...row, steps: loadSteps(db, row.id) }));
}

/** Creates the video folder + step rows and marks the topic used. Uses the next queued topic if none is given. */
export function createVideo(db: DB, channelId: string, topic?: Topic): Video {
  const chosen = topic ?? nextTopic(db, channelId);
  if (!chosen) {
    throw new Error(
      `No queued topics for ${channelId}. Add one: yt topics add ${channelId} "<topic>"`,
    );
  }
  if (chosen.channel_id !== channelId) {
    throw new Error(`Topic #${chosen.id} belongs to ${chosen.channel_id}, not ${channelId}.`);
  }
  if (chosen.status !== "queued") {
    throw new Error(`Topic #${chosen.id} is ${chosen.status}, not queued.`);
  }

  const slug = slugify(chosen.title);
  const parent = paths.videos(channelId);
  fs.mkdirSync(parent, { recursive: true });

  // Same title on the same day gets -2, -3 … Non-recursive mkdir fails if the folder exists.
  const base = `${folderDate()}_${slug}`;
  let folder = "";
  for (let n = 1; !folder; n++) {
    const candidate = path.join(parent, n === 1 ? base : `${base}-${n}`);
    try {
      fs.mkdirSync(candidate);
      folder = candidate;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
  }

  try {
    const id = db.transaction(() => {
      const now = nowIso();
      const info = db
        .prepare(
          `INSERT INTO videos (channel_id, topic_id, title, slug, folder, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(channelId, chosen.id, chosen.title, slug, relToRoot(folder), now, now);
      const videoId = Number(info.lastInsertRowid);
      const insertStep = db.prepare(
        "INSERT INTO video_steps (video_id, step, state, updated_at) VALUES (?, ?, 'pending', ?)",
      );
      for (const step of STEPS) insertStep.run(videoId, step.id, now);
      const used = db
        .prepare("UPDATE topics SET status = 'used' WHERE id = ? AND status = 'queued'")
        .run(chosen.id);
      if (used.changes !== 1) throw new Error(`Topic #${chosen.id} was taken by another run.`);
      return videoId;
    })();
    return requireVideo(db, id);
  } catch (err) {
    fs.rmSync(folder, { recursive: true, force: true });
    throw err;
  }
}

function setStep(
  db: DB,
  videoId: number,
  step: StepId,
  state: StepState,
  opts: { error?: string | null; countAttempt?: boolean } = {},
): void {
  const now = nowIso();
  db.transaction(() => {
    db.prepare(
      `UPDATE video_steps SET state = ?, error = ?, attempts = attempts + ?, updated_at = ?
       WHERE video_id = ? AND step = ?`,
    ).run(state, opts.error ?? null, opts.countAttempt ? 1 : 0, now, videoId, step);
    db.prepare("UPDATE videos SET updated_at = ? WHERE id = ?").run(now, videoId);
  })();
}

/** Only the first unfinished step may move. Returns it. */
function assertCurrent(video: Video, step: StepId): StepRecord {
  const { current } = summarize(video);
  if (!current) throw new Error(`Video #${video.id} has finished every step.`);
  if (current.step !== step) {
    throw new Error(`Video #${video.id} is at "${current.step}", not "${step}".`);
  }
  return current;
}

export function startStep(db: DB, videoId: number, step: StepId): void {
  const video = requireVideo(db, videoId);
  const current = assertCurrent(video, step);
  if (stepDef(step).kind === "gate") {
    throw new Error(`"${step}" is an approval step — approve it instead of running it.`);
  }
  if (current.state === "running") {
    throw new Error(
      `"${step}" is already running for video #${videoId}. If a previous run crashed, rewind to "${step}".`,
    );
  }
  setStep(db, videoId, step, "running", { countAttempt: true });
}

export function completeStep(db: DB, videoId: number, step: StepId): void {
  const current = assertCurrent(requireVideo(db, videoId), step);
  if (current.state !== "running") throw new Error(`"${step}" is ${current.state}, not running.`);
  setStep(db, videoId, step, "done");
}

export function failStep(db: DB, videoId: number, step: StepId, error: string): void {
  const current = assertCurrent(requireVideo(db, videoId), step);
  if (current.state !== "running") throw new Error(`"${step}" is ${current.state}, not running.`);
  setStep(db, videoId, step, "failed", { error });
}

/** Passes the approval gate the video is waiting at. Returns which gate it was. */
export function approve(db: DB, videoId: number): StepId {
  const video = requireVideo(db, videoId);
  const { status, current } = summarize(video);
  if (status !== "needs_review" || !current) {
    throw new Error(`Video #${videoId} is not waiting for approval (status: ${status}).`);
  }
  setStep(db, videoId, current.step, "done");
  return current.step;
}

/** Resets `step` and every later step to pending, so the pipeline re-runs from there. */
export function rewind(db: DB, videoId: number, step: StepId): void {
  requireVideo(db, videoId);
  const from = STEP_ORDER.get(step) as number;
  const later = STEPS.slice(from).map((s) => s.id);
  const now = nowIso();
  db.transaction(() => {
    const reset = db.prepare(
      "UPDATE video_steps SET state = 'pending', error = NULL, updated_at = ? WHERE video_id = ? AND step = ?",
    );
    for (const id of later) reset.run(now, videoId, id);
    db.prepare("UPDATE videos SET updated_at = ? WHERE id = ?").run(now, videoId);
  })();
}
