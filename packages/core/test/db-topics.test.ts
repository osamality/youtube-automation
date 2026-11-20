import { describe, expect, it } from "vitest";
import { openDb, SCHEMA_VERSION } from "../src/db";
import { paths } from "../src/paths";
import { addTopic, countQueuedTopics, listTopics, nextTopic, skipTopic } from "../src/topics";
import { useTempRoot } from "./helpers";

const t = useTempRoot();

describe("openDb", () => {
  it("migrates to the latest schema and is safe to open again", () => {
    expect(t.db().pragma("user_version", { simple: true })).toBe(SCHEMA_VERSION);
    const again = openDb(paths.db());
    expect(again.pragma("user_version", { simple: true })).toBe(SCHEMA_VERSION);
    again.close();
  });
});

describe("topics", () => {
  it("queues by priority, then oldest first", () => {
    const db = t.db();
    addTopic(db, "biztech", "First normal");
    addTopic(db, "biztech", "Urgent", { priority: 5 });
    addTopic(db, "biztech", "Second normal");
    addTopic(db, "psych", "Other channel", { priority: 99 });

    expect(nextTopic(db, "biztech")?.title).toBe("Urgent");
    expect(listTopics(db, { channelId: "biztech" }).map((x) => x.title)).toEqual([
      "Urgent",
      "First normal",
      "Second normal",
    ]);
  });

  it("cleans whitespace and rejects duplicates per channel, case-insensitive", () => {
    const db = t.db();
    const topic = addTopic(db, "biztech", "  How   Netflix makes money ");
    expect(topic.title).toBe("How Netflix makes money");
    expect(() => addTopic(db, "biztech", "how netflix MAKES money")).toThrow(/already in biztech/);
    expect(() => addTopic(db, "psych", "How Netflix makes money")).not.toThrow();
    expect(() => addTopic(db, "biztech", "   ")).toThrow(/empty/);
  });

  it("a skipped topic leaves the queue and can be added again", () => {
    const db = t.db();
    const topic = addTopic(db, "biztech", "Maybe later");
    skipTopic(db, topic.id);
    expect(nextTopic(db, "biztech")).toBeUndefined();
    expect(() => skipTopic(db, topic.id)).toThrow(/only queued/);
    expect(() => addTopic(db, "biztech", "Maybe later")).not.toThrow();
  });

  it("counts queued topics per channel", () => {
    const db = t.db();
    addTopic(db, "biztech", "A");
    addTopic(db, "biztech", "B");
    addTopic(db, "psych", "C");
    expect(Object.fromEntries(countQueuedTopics(db))).toEqual({ biztech: 2, psych: 1 });
  });
});
