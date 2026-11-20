import fs from "node:fs";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import {
  addTopic,
  type ChannelEntry,
  countQueuedTopics,
  createChannel,
  type DB,
  formatDateTime,
  listChannels,
  listTopics,
  listVideos,
  nowIso,
  openDb,
  requireChannel,
  rootDir,
  skipTopic,
  stepDef,
  summarize,
  type Video,
  type VideoStatus,
} from "@yt/core";
import { Command, InvalidArgumentError } from "commander";
import pc from "picocolors";
import { registerProduceCommands } from "./produce";
import { registerUploadCommand } from "./upload";

// Keys and settings from <root>/.env. Variables already set in the shell win.
const envFile = path.join(rootDir(), ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

// ── helpers ───────────────────────────────────────────────────────────────

/** Runs a command body with an open database, prints errors without a stack trace. */
function action<A extends unknown[]>(fn: (db: DB, ...args: A) => void) {
  return (...args: A) => {
    let db: DB | undefined;
    try {
      db = openDb();
      fn(db, ...args);
    } catch (err) {
      console.error(pc.red(`✖ ${(err as Error).message}`));
      process.exitCode = 1;
    } finally {
      db?.close();
    }
  };
}

function integer(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n)) throw new InvalidArgumentError("must be a whole number");
  return n;
}

function table(rows: string[][]): string {
  const visible = (s: string) => stripVTControlCharacters(s).length;
  const widths =
    rows[0]?.map((_, col) => Math.max(...rows.map((r) => visible(r[col] ?? "")))) ?? [];
  return rows
    .map((r) =>
      r
        .map((cell, col) => cell + " ".repeat((widths[col] ?? 0) - visible(cell)))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

const hint = (text: string) => pc.dim(`→ ${text}`);

// ── program ───────────────────────────────────────────────────────────────

const program = new Command()
  .name("yt")
  .description("Animated YouTube video engine — one engine, many channels")
  .showHelpAfterError();

// channel ─────────────────────────────────────────────────────────────────

const channel = program.command("channel").description("create and check channels");

channel
  .command("add")
  .description("create channels/<id>/ from the template")
  .argument("<id>", "short folder name, e.g. biztech")
  .requiredOption("-n, --name <name>", "display name of the channel")
  .action(
    action((_db, id: string, opts: { name: string }) => {
      const created = createChannel(id, opts.name);
      console.log(pc.green(`✔ Created channels/${created.id}/`));
      console.log(hint(`edit channels/${created.id}/channel.yaml — audience, tone, voice`));
      console.log(hint(`edit channels/${created.id}/prompts/script.md — how scripts are written`));
      console.log(hint(`add topics: yt topics add ${created.id} "<topic>"`));
    }),
  );

channel
  .command("list")
  .description("list all channels")
  .action(
    action(() => {
      const entries = listChannels();
      if (!entries.length) {
        console.log('No channels yet. Create one: yt channel add <id> --name "<name>"');
        return;
      }
      const rows = [["ID", "NAME", "FORMATS", "VOICE", "CONFIG"].map((h) => pc.bold(h))];
      for (const e of entries) {
        rows.push(
          e.ok
            ? [
                e.id,
                e.channel.name,
                e.channel.formats.join("+"),
                `${e.channel.voice.provider}/${e.channel.voice.id}`,
                pc.green("ok"),
              ]
            : [e.id, "", "", "", pc.red("invalid — run yt channel check")],
        );
      }
      console.log(table(rows));
    }),
  );

channel
  .command("check")
  .description("validate every channel.yaml")
  .action(
    action(() => {
      const entries = listChannels();
      if (!entries.length) console.log("No channels to check.");
      for (const e of entries) {
        if (e.ok) console.log(pc.green(`✔ ${e.id}`));
        else {
          console.log(pc.red(`✖ ${e.id}`));
          console.log(e.error);
          process.exitCode = 1;
        }
      }
    }),
  );

// topics ──────────────────────────────────────────────────────────────────

const topics = program.command("topics").description("manage each channel's topic queue");

topics
  .command("add")
  .description("add a topic to a channel's queue")
  .argument("<channel>", "channel id")
  .argument("<title...>", "the topic — quotes optional")
  .option("--notes <text>", "angle, sources or anything the script writer should know")
  .option("-p, --priority <n>", "higher runs sooner (default 0)", integer, 0)
  .action(
    action((db, channelId: string, words: string[], opts: { notes?: string; priority: number }) => {
      requireChannel(channelId);
      const topic = addTopic(db, channelId, words.join(" "), opts);
      console.log(pc.green(`✔ Topic #${topic.id} queued for ${channelId}: ${topic.title}`));
    }),
  );

topics
  .command("list")
  .description("show queued topics (all channels, or one)")
  .argument("[channel]", "channel id")
  .option("-a, --all", "include used and skipped topics")
  .action(
    action((db, channelId: string | undefined, opts: { all?: boolean }) => {
      if (channelId) requireChannel(channelId);
      const items = listTopics(db, { channelId, status: opts.all ? undefined : "queued" });
      if (!items.length) {
        console.log(
          `No ${opts.all ? "" : "queued "}topics${channelId ? ` for ${channelId}` : ""}.`,
        );
        return;
      }
      const rows = [
        ["#", "CHANNEL", "PRIORITY", "STATUS", "ADDED", "TOPIC"].map((h) => pc.bold(h)),
      ];
      for (const t of items) {
        rows.push([
          String(t.id),
          t.channel_id,
          String(t.priority),
          t.status,
          formatDateTime(t.created_at),
          t.title,
        ]);
      }
      console.log(table(rows));
    }),
  );

topics
  .command("skip")
  .description("remove a queued topic from the queue")
  .argument("<id>", "topic number", integer)
  .action(
    action((db, id: number) => {
      const topic = skipTopic(db, id);
      console.log(pc.yellow(`Skipped topic #${topic.id}: ${topic.title}`));
    }),
  );

// status ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<VideoStatus, string> = {
  in_progress: "in progress",
  running: "running",
  needs_review: "need review",
  failed: "failed",
  published: "published",
};

function channelBlock(entry: ChannelEntry, queued: number, videos: Video[]): string[] {
  if (!entry.ok) {
    return [`${pc.bold(entry.id)}  ${pc.red("invalid config")}`, pc.red(entry.error)];
  }
  const counts = new Map<VideoStatus, number>();
  for (const v of videos) {
    const { status } = summarize(v);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  const videoLine = (Object.keys(STATUS_LABEL) as VideoStatus[])
    .map((s) => `${counts.get(s) ?? 0} ${STATUS_LABEL[s]}`)
    .join(" · ");

  const lines = [
    `${pc.bold(entry.id)}  ${entry.channel.name}`,
    `  Topics queued: ${queued}`,
    `  Videos:        ${videoLine}`,
  ];
  if (queued === 0 && videos.length === 0) {
    lines.push(`  ${hint(`add topics: yt topics add ${entry.id} "<topic>"`)}`);
  }
  return lines;
}

program
  .command("status")
  .description("what every channel has queued, in progress and waiting for you")
  .action(
    action((db) => {
      console.log(pc.dim(`youtube-auto · ${formatDateTime(nowIso())} GST`));
      console.log();

      const entries = listChannels();
      if (!entries.length) {
        console.log('No channels yet. Create one: yt channel add <id> --name "<name>"');
        return;
      }

      const queued = countQueuedTopics(db);
      const videos = listVideos(db);
      for (const entry of entries) {
        const own = videos.filter((v) => v.channel_id === entry.id);
        console.log(channelBlock(entry, queued.get(entry.id) ?? 0, own).join("\n"));
        console.log();
      }

      const waiting = videos
        .map((v) => ({ v, ...summarize(v) }))
        .filter((x) => x.status === "needs_review" || x.status === "failed");
      if (!waiting.length) {
        console.log(pc.dim("Nothing is waiting for you."));
        return;
      }
      console.log(pc.bold("Waiting for you:"));
      for (const { v, status, current } of waiting) {
        const what =
          status === "failed"
            ? pc.red(`failed at ${current?.step}: ${current?.error ?? "unknown error"}`)
            : pc.yellow(current ? stepDef(current.step).label.toLowerCase() : "");
        console.log(`  #${v.id}  ${v.channel_id}  ${v.title}  ${what}`);
      }
    }),
  );

registerProduceCommands(program);

registerUploadCommand(program);
await program.parseAsync();
