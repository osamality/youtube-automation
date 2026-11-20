import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach } from "vitest";
import { type DB, openDb } from "../src/db";

/** Gives each test an empty repo root (YT_ROOT) and an open database inside it. */
export function useTempRoot(): { root: () => string; db: () => DB } {
  let root = "";
  let db: DB | undefined;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "yt-test-"));
    process.env.YT_ROOT = root;
    db = openDb();
  });

  afterEach(() => {
    db?.close();
    db = undefined;
    delete process.env.YT_ROOT;
    fs.rmSync(root, { recursive: true, force: true });
  });

  return {
    root: () => root,
    db: () => {
      if (!db) throw new Error("database not open");
      return db;
    },
  };
}
