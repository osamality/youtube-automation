import type { DB } from "./db";
import { nowIso } from "./time";

export const TOPIC_STATUSES = ["queued", "used", "skipped"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export interface Topic {
  id: number;
  channel_id: string;
  title: string;
  notes: string | null;
  priority: number;
  status: TopicStatus;
  created_at: string;
}

/** Queue order: highest priority first, then oldest first. */
const QUEUE_ORDER = "priority DESC, id ASC";

export function addTopic(
  db: DB,
  channelId: string,
  title: string,
  opts: { notes?: string; priority?: number } = {},
): Topic {
  const clean = title.trim().replace(/\s+/g, " ");
  if (!clean) throw new Error("Topic title is empty.");

  const duplicate = db
    .prepare(
      "SELECT id, status FROM topics WHERE channel_id = ? AND lower(title) = lower(?) AND status != 'skipped'",
    )
    .get(channelId, clean) as { id: number; status: TopicStatus } | undefined;
  if (duplicate) {
    throw new Error(
      `"${clean}" is already in ${channelId} (topic #${duplicate.id}, ${duplicate.status}).`,
    );
  }

  const info = db
    .prepare(
      "INSERT INTO topics (channel_id, title, notes, priority, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(channelId, clean, opts.notes?.trim() || null, opts.priority ?? 0, nowIso());
  return getTopic(db, Number(info.lastInsertRowid)) as Topic;
}

export function getTopic(db: DB, id: number): Topic | undefined {
  return db.prepare("SELECT * FROM topics WHERE id = ?").get(id) as Topic | undefined;
}

export function listTopics(
  db: DB,
  filter: { channelId?: string; status?: TopicStatus } = {},
): Topic[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.channelId) {
    where.push("channel_id = ?");
    params.push(filter.channelId);
  }
  if (filter.status) {
    where.push("status = ?");
    params.push(filter.status);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  return db
    .prepare(`SELECT * FROM topics ${clause} ORDER BY channel_id, ${QUEUE_ORDER}`)
    .all(...params) as Topic[];
}

export function nextTopic(db: DB, channelId: string): Topic | undefined {
  return db
    .prepare(
      `SELECT * FROM topics WHERE channel_id = ? AND status = 'queued' ORDER BY ${QUEUE_ORDER} LIMIT 1`,
    )
    .get(channelId) as Topic | undefined;
}

export function skipTopic(db: DB, id: number): Topic {
  const topic = getTopic(db, id);
  if (!topic) throw new Error(`No topic #${id}.`);
  if (topic.status !== "queued") {
    throw new Error(`Topic #${id} is ${topic.status}; only queued topics can be skipped.`);
  }
  db.prepare("UPDATE topics SET status = 'skipped' WHERE id = ?").run(id);
  return { ...topic, status: "skipped" };
}

export function countQueuedTopics(db: DB): Map<string, number> {
  const rows = db
    .prepare(
      "SELECT channel_id, COUNT(*) AS n FROM topics WHERE status = 'queued' GROUP BY channel_id",
    )
    .all() as { channel_id: string; n: number }[];
  return new Map(rows.map((r) => [r.channel_id, r.n]));
}
