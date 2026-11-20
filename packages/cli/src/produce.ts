import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  buildKit,
  buildRenderInput,
  type Channel,
  collectLogos,
  normalizeLoudness,
  paths,
  photoCreditLines,
  planSlots,
  prepareVideoMedia,
  type RenderState,
  readPhotoIndex,
  readPlan,
  readSchedule,
  relToRoot,
  requireChannel,
  resolveLogos,
  rootDir,
  shortRange,
  slugify,
  videoFiles,
  videoKey,
  voicePlan,
  writeSchedule,
} from "@yt/core";
import { type Format, FPS } from "@yt/templates/constants";
import {
  type BrowserChoice,
  bundleVideo,
  DEMO_PLAN,
  isBrowserCrash,
  REMOTION_ENTRY,
  renderStills,
  renderThumbnails,
  renderVideo,
  systemChrome,
} from "@yt/templates/render";
import type { RenderInput } from "@yt/templates/schema";
import { buildTimeline, forFormat, TRANSITION_FRAMES } from "@yt/templates/timeline";
import { type Command, InvalidArgumentError } from "commander";
import pc from "picocolors";

// ── helpers ───────────────────────────────────────────────────────────────

function run<A extends unknown[]>(fn: (...args: A) => Promise<void>) {
  return async (...args: A) => {
    try {
      await fn(...args);
    } catch (err) {
      process.stderr.write("\n");
      console.error(pc.red(`✖ ${(err as Error).message}`));
      process.exitCode = 1;
    }
  };
}

/** Accepts a path relative to the current directory or to the repo root. */
function resolveFolder(arg: string): string {
  const found = [path.resolve(process.cwd(), arg), path.resolve(rootDir(), arg)].find((p) =>
    fs.existsSync(path.join(p, "plan.json")),
  );
  if (!found) throw new Error(`No plan.json found in "${arg}".`);
  return found;
}

function formats(value: string): Format[] {
  if (value === "both") return ["long", "short"];
  if (value === "long" || value === "short") return [value];
  throw new InvalidArgumentError("use long, short or both");
}

function progressBar(label: string): (share: number) => void {
  const tty = process.stderr.isTTY;
  let last = -1;
  return (share) => {
    const pct = Math.min(100, Math.floor(share * 100));
    const bucket = tty ? pct : Math.floor(pct / 25);
    if (bucket === last) return;
    last = bucket;
    const filled = Math.round((pct / 100) * 24);
    const line = `  ${label.padEnd(14)} ${"█".repeat(filled)}${"░".repeat(24 - filled)} ${String(pct).padStart(3)}%`;
    if (tty) process.stderr.write(`\r${line}${pct === 100 ? "\n" : ""}`);
    else process.stderr.write(`${line}\n`);
  };
}

const mmss = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

interface ProduceOptions {
  format: Format[];
  stills?: string | boolean;
  browser?: string;
  verbose?: boolean;
}

interface BrowserState {
  choice: BrowserChoice;
  /** The user picked the browser, so never swap it. */
  explicit: boolean;
}

/** --browser, else YT_BROWSER, else Remotion's headless Chrome. "chrome" = the installed Google Chrome. */
function chooseBrowser(opts: ProduceOptions): BrowserState {
  const verbose = Boolean(opts.verbose);
  const wanted = opts.browser ?? process.env.YT_BROWSER;
  if (!wanted) return { choice: { executable: null, verbose }, explicit: false };
  const executable = wanted === "chrome" ? systemChrome() : path.resolve(wanted);
  if (!executable) throw new Error("Google Chrome is not installed. Pass --browser <path>.");
  if (!fs.existsSync(executable)) throw new Error(`Browser not found: ${executable}`);
  return { choice: { executable, verbose }, explicit: true };
}

/**
 * Runs a render job. If Remotion's headless Chrome crashes and Google Chrome is
 * installed, retries once with Google Chrome and keeps using it for later jobs.
 */
async function withFallback<T>(
  state: BrowserState,
  job: (browser: BrowserChoice) => Promise<T>,
): Promise<T> {
  try {
    return await job(state.choice);
  } catch (err) {
    const chrome = systemChrome();
    if (state.explicit || state.choice.executable || !chrome || !isBrowserCrash(err)) {
      if (isBrowserCrash(err) && !state.choice.verbose) {
        (err as Error).message += "\n  Run again with --verbose to see Chrome's own log.";
      }
      throw err;
    }
    process.stderr.write("\n");
    console.log(pc.yellow("! Remotion's headless Chrome crashed. Retrying with Google Chrome."));
    console.log(pc.dim(`  ${chrome}`));
    state.choice = { ...state.choice, executable: chrome };
    return job(state.choice);
  }
}

/** voice (if changed) → bundle → render each format, or stills for checking layouts. */
async function produce(folder: string, opts: ProduceOptions): Promise<void> {
  const plan = readPlan(folder);
  const channel = requireChannel(plan.channel);
  const files = videoFiles(folder);
  console.log(`${pc.bold(plan.title)}  ${pc.dim(`${plan.scenes.length} scenes · ${channel.id}`)}`);

  await voicePlan(folder, channel, ({ index, total, reused }) => {
    if (!reused)
      console.log(`  Voice          scene ${index + 1}/${total} ${pc.green("recorded")}`);
  });
  await prepareVideoMedia(folder, channel);
  const input = buildRenderInput(folder, channel);
  const browser = chooseBrowser(opts);

  const unknownLogos = resolveLogos(collectLogos(plan)).unknown;
  if (unknownLogos.length) {
    console.log(pc.yellow(`! Not in Simple Icons, shown as text: ${unknownLogos.join(", ")}`));
  }
  const bundleProgress = progressBar("Bundling");
  const serveUrl = await bundleVideo(files.media, (p) => bundleProgress(p / 100));
  bundleProgress(1);

  const thumbnails = opts.stills
    ? null
    : await withFallback(browser, (choice) =>
        renderThumbnails({ serveUrl, input, outDir: files.upload, browser: choice }),
      );

  for (const format of opts.format) {
    const own = forFormat(input, format);
    if (format === "short" && !opts.stills) {
      const seconds = buildTimeline(own).durationInFrames / FPS;
      const [min, max] = shortRange(channel);
      if (seconds < min || seconds > max) {
        console.log(
          pc.yellow(
            `! Short skipped: it would run ${Math.round(seconds)} seconds. This channel's Shorts run ${min}–${max} seconds.`,
          ) + pc.dim(' Mark its scenes with "short": "also" (or "only") in plan.json.'),
        );
        continue;
      }
    }
    if (opts.stills) {
      const timeline = buildTimeline(own);
      const frames =
        typeof opts.stills === "string"
          ? opts.stills.split(",").map((f) => Number.parseInt(f, 10))
          : timeline.scenes.map((s, i) =>
              i < timeline.scenes.length - 1
                ? s.from + s.duration - TRANSITION_FRAMES - 4
                : s.from + s.duration - 10,
            );
      fs.mkdirSync(files.stills, { recursive: true });
      const written = await withFallback(browser, (choice) =>
        renderStills({ serveUrl, input, format, frames, outDir: files.stills, browser: choice }),
      );
      console.log(pc.green(`✔ ${written.length} ${format} stills in ${relToRoot(files.stills)}/`));
      continue;
    }

    const started = Date.now();
    const outFile = files.output(format);
    let reused = 0;
    const { frames, fps } = await withFallback(browser, (choice) =>
      renderVideo({
        serveUrl,
        input,
        format,
        outFile,
        chunkDir: files.chunks(format),
        browser: choice,
        onProgress: progressBar(`Render ${format}`),
        onChunk: (info) => {
          if (info.reused) reused++;
        },
      }),
    );
    const loud = await normalizeLoudness(outFile);
    fs.writeFileSync(files.renderKey(format), JSON.stringify({ key: videoKey(input, format) }));
    const took = Math.round((Date.now() - started) / 1000);
    console.log(
      pc.green(`✔ ${relToRoot(outFile)}`) +
        pc.dim(
          `  ${mmss(frames / fps)} long · rendered in ${mmss(took)}` +
            (reused ? ` · ${reused} chunks kept from the last run` : "") +
            ` · audio ${loud.after.toFixed(1)} LUFS`,
        ),
    );
  }
  if (!opts.stills) writeKit(folder, channel, input, thumbnails);
}

/** Is <format>.mp4 there, and was it made from the current plan, voice and channel settings? */
function renderState(folder: string, input: RenderInput, format: Format): RenderState {
  const files = videoFiles(folder);
  if (!fs.existsSync(files.output(format))) return "missing";
  const keyFile = files.renderKey(format);
  if (fs.existsSync(keyFile)) {
    const saved = JSON.parse(fs.readFileSync(keyFile, "utf8")) as { key?: string };
    return saved.key === videoKey(input, format) ? "ok" : "stale";
  }
  // Rendered before render keys existed: compare file times instead.
  const made = fs.statSync(files.output(format)).mtimeMs;
  const sources = [files.plan, files.voice, paths.channelConfig(input.plan.channel)];
  return sources.some((f) => fs.existsSync(f) && fs.statSync(f).mtimeMs > made) ? "stale" : "ok";
}

/** Writes upload/: UPLOAD.md, description, pinned comment, Short description and captions. */
function writeKit(
  folder: string,
  channel: Channel,
  input: RenderInput,
  thumbnails: string[] | null,
): void {
  const files = videoFiles(folder);
  fs.mkdirSync(files.upload, { recursive: true });
  const now = new Date();
  const slots = planSlots({
    bookings: readSchedule(channel.id),
    video: relToRoot(folder),
    now,
    publish: channel.youtube.publish,
    shorts: channel.formats.includes("shorts"),
  });
  const kit = buildKit({
    input,
    channel,
    renders: {
      long: renderState(folder, input, "long"),
      ...(channel.formats.includes("shorts") ? { short: renderState(folder, input, "short") } : {}),
    },
    thumbnails:
      thumbnails?.map((file) => ({ file: path.basename(file), bytes: fs.statSync(file).size })) ??
      null,
    now,
    slots: { long: slots.long, short: slots.short },
    photoCredits: photoCreditLines(
      input.plan,
      Object.values(readPhotoIndex(files.media)).map((p) => p.credit),
    ),
  });
  writeSchedule(channel.id, slots.bookings);
  fs.writeFileSync(files.kit, kit.markdown);
  fs.writeFileSync(files.description, kit.description);
  fs.writeFileSync(files.captions, kit.captions);
  for (const [file, text] of [
    [files.comment, kit.comment],
    [files.shortDescription, kit.shortDescription],
  ] as const) {
    if (text) fs.writeFileSync(file, text);
    else fs.rmSync(file, { force: true });
  }
  // The titles on their own, ready to copy into the upload form.
  const title = input.plan.upload?.titles[0] ?? input.plan.title;
  fs.writeFileSync(path.join(files.upload, "title.txt"), `${title}\n`);
  if (kit.shortDescription)
    fs.writeFileSync(
      path.join(files.upload, "short-title.txt"),
      `${input.plan.upload?.short?.title ?? title}\n`,
    );
  else fs.rmSync(path.join(files.upload, "short-title.txt"), { force: true });
  // Before the upload/ folder these sat next to plan.json.
  for (const old of ["description.txt", "pinned-comment.txt"]) {
    fs.rmSync(path.join(folder, old), { force: true });
  }

  const fails = kit.checks.filter((c) => c.status === "fail");
  const warns = kit.checks.filter((c) => c.status === "warn");
  console.log(
    pc.green(`✔ ${relToRoot(files.kit)}`) +
      pc.dim(
        `  upload checklist · ${kit.checks.length - fails.length - warns.length} checks passed`,
      ),
  );
  for (const c of warns) console.log(pc.yellow(`  ! ${c.text}`));
  for (const c of fails) console.log(pc.red(`  ✖ ${c.text}`));
}

// ── commands ──────────────────────────────────────────────────────────────

export function registerProduceCommands(program: Command): void {
  program
    .command("voice")
    .description("record narration for every scene in <folder>/plan.json")
    .argument("<folder>", "video folder containing plan.json")
    .action(
      run(async (arg: string) => {
        const folder = resolveFolder(arg);
        const plan = readPlan(folder);
        const channel = requireChannel(plan.channel);
        console.log(
          `Voice ${channel.voice.provider}/${channel.voice.id} · ${plan.scenes.length} scenes`,
        );
        await voicePlan(folder, channel, ({ index, total, reused }) =>
          console.log(
            `  ${pc.dim(`${index + 1}/${total}`)} ${reused ? pc.dim("unchanged") : pc.green("recorded")}`,
          ),
        );
        console.log(pc.green(`✔ ${relToRoot(videoFiles(folder).voice)}`));
      }),
    );

  program
    .command("render")
    .description("render <folder>/plan.json to long.mp4 and/or short.mp4")
    .argument("<folder>", "video folder containing plan.json")
    .option("-f, --format <format>", "long, short or both", formats, ["long", "short"] as Format[])
    .option(
      "--stills [frames]",
      "save PNG frames instead: comma-separated frames, or one per scene",
    )
    .option("--browser <chrome|path>", "render with Google Chrome or another Chrome binary")
    .option("--verbose", "print Chrome's log (for render crashes)")
    .action(run(async (arg: string, opts: ProduceOptions) => produce(resolveFolder(arg), opts)));

  program
    .command("kit")
    .description(
      "write <folder>/upload/: the upload checklist, description, thumbnails and captions",
    )
    .argument("<folder>", "video folder containing plan.json")
    .option("--no-thumbnails", "skip rendering the thumbnails")
    .option("--browser <chrome|path>", "render with Google Chrome or another Chrome binary")
    .option("--verbose", "print Chrome's log (for render crashes)")
    .action(
      run(async (arg: string, opts: ProduceOptions & { thumbnails: boolean }) => {
        const folder = resolveFolder(arg);
        const plan = readPlan(folder);
        const channel = requireChannel(plan.channel);
        await voicePlan(folder, channel);
        await prepareVideoMedia(folder, channel);
        const input = buildRenderInput(folder, channel);
        // Without --thumbnails, check the ones already in upload/ (null if there are none).
        const upload = videoFiles(folder).upload;
        const existing = fs.existsSync(upload)
          ? fs
              .readdirSync(upload)
              .filter((f) => /^thumbnail-\d\.jpg$/.test(f))
              .map((f) => path.join(upload, f))
          : [];
        let thumbnails: string[] | null = existing.length ? existing : null;
        if (opts.thumbnails) {
          const bundleProgress = progressBar("Bundling");
          const serveUrl = await bundleVideo(videoFiles(folder).media, (p) =>
            bundleProgress(p / 100),
          );
          bundleProgress(1);
          thumbnails = await withFallback(chooseBrowser(opts), (choice) =>
            renderThumbnails({
              serveUrl,
              input,
              outDir: videoFiles(folder).upload,
              browser: choice,
            }),
          );
        }
        writeKit(folder, channel, input, thumbnails);
      }),
    );

  program
    .command("studio")
    .description("live preview of <folder> in Remotion Studio (opens a browser tab)")
    .argument("<folder>", "video folder containing plan.json")
    .action(
      run(async (arg: string) => {
        const folder = resolveFolder(arg);
        const plan = readPlan(folder);
        const channel = requireChannel(plan.channel);
        await voicePlan(folder, channel);
        await prepareVideoMedia(folder, channel);
        const propsFile = path.join(folder, ".studio-props.json");
        fs.writeFileSync(propsFile, JSON.stringify(buildRenderInput(folder, channel)));
        const bin = path.join(rootDir(), "node_modules", ".bin", "remotion");
        const args = ["studio", REMOTION_ENTRY, "--public-dir", videoFiles(folder).media];
        await new Promise<void>((resolve, reject) => {
          const child = spawn(bin, [...args, "--props", propsFile], { stdio: "inherit" });
          child.on("error", reject);
          child.on("exit", () => resolve());
        });
      }),
    );

  program
    .command("demo")
    .description("voice and render a demo (channels/<id>/demo.json, else the built-in one)")
    .argument("[channel]", "channel id", "biztech")
    .option("-f, --format <format>", "long, short or both", formats, ["long", "short"] as Format[])
    .option(
      "--stills [frames]",
      "save PNG frames instead: comma-separated frames, or one per scene",
    )
    .option("--browser <chrome|path>", "render with Google Chrome or another Chrome binary")
    .option("--verbose", "print Chrome's log (for render crashes)")
    .action(
      run(async (channelId: string, opts: ProduceOptions) => {
        requireChannel(channelId);
        // A channel can ship its own demo (channels/<id>/demo.json); otherwise the built-in one.
        const own = path.join(paths.channel(channelId), "demo.json");
        const plan = JSON.parse(fs.readFileSync(fs.existsSync(own) ? own : DEMO_PLAN, "utf8"));
        plan.channel = channelId;
        const folder = path.join(paths.data(), channelId, "demos", slugify(plan.title));
        fs.mkdirSync(folder, { recursive: true });
        const planFile = videoFiles(folder).plan;
        if (!fs.existsSync(planFile)) {
          fs.writeFileSync(planFile, `${JSON.stringify(plan, null, 2)}\n`);
        }
        console.log(
          pc.dim(`Folder: ${relToRoot(folder)} (edit plan.json and run yt render on it)`),
        );
        await produce(folder, opts);
      }),
    );
}
