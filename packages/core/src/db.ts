import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { paths } from "./paths";

export type DB = Database.Database;

/**
 * Append-only list. Each entry runs once, in order; PRAGMA user_version records how many have run.
 * Never edit an entry that has shipped — add a new one.
 */
const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE topics (
    id          INTEGER PRIMARY KEY,
    channel_id  TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    notes       TEXT,
    priority    INTEGER NOT NULL DEFAULT 0,
    status      TEXT    NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'used', 'skipped')),
    created_at  TEXT    NOT NULL
  );
  CREATE INDEX topics_queue ON topics (channel_id, status, priority DESC, id);

  CREATE TABLE videos (
    id          INTEGER PRIMARY KEY,
    channel_id  TEXT    NOT NULL,
    topic_id    INTEGER REFERENCES topics (id),
    title       TEXT    NOT NULL,
    slug        TEXT    NOT NULL,
    folder      TEXT    NOT NULL UNIQUE,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
  );
  CREATE INDEX videos_channel ON videos (channel_id);

  CREATE TABLE video_steps (
    video_id    INTEGER NOT NULL REFERENCES videos (id) ON DELETE CASCADE,
    step        TEXT    NOT NULL,
    state       TEXT    NOT NULL CHECK (state IN ('pending', 'running', 'done', 'failed')),
    attempts    INTEGER NOT NULL DEFAULT 0,
    error       TEXT,
    updated_at  TEXT    NOT NULL,
    PRIMARY KEY (video_id, step)
  );
  `,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

export function openDb(file: string = paths.db()): DB {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: DB): void {
  const current = db.pragma("user_version", { simple: true }) as number;
  if (current > MIGRATIONS.length) {
    throw new Error(
      `Database schema v${current} is newer than this code (v${MIGRATIONS.length}). Update the code.`,
    );
  }
  for (let version = current; version < MIGRATIONS.length; version++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[version] as string);
      db.pragma(`user_version = ${version + 1}`);
    })();
  }
}
