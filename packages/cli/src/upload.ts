import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { paths, rootDir } from "@yt/core";
import type { Command } from "commander";
import pc from "picocolors";
import { type Browser, type BrowserContext, chromium, type Page } from "playwright-core";

/**
 * `yt upload <folder>` drives YouTube Studio in the user's own Google Chrome.
 *
 * Chrome is started as a normal browser with its own profile folder
 * (secrets/chrome-profile), so the Google sign-in is done by hand once and kept.
 * The script fills the upload dialog from the files in <folder>/upload and stops
 * on the Visibility step. Nothing is published or scheduled by the script.
 */

const PORT = 9333;
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SIGN_IN_MINUTES = 15;

type Kind = "long" | "short";

interface Job {
  kind: Kind;
  video: string;
  title: string;
  description: string;
  thumbnail?: string;
  tags: string[];
  visibility?: string;
}

const read = (file: string): string =>
  fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim() : "";

/** The cell next to `label` in a markdown table inside `text`. */
function cell(text: string, label: string): string {
  const row = text.split("\n").find((l) => l.startsWith(`| ${label} |`));
  return row ? (row.split("|")[2] ?? "").trim() : "";
}

function jobsFor(folder: string, kinds: Kind[]): Job[] {
  const up = path.join(folder, "upload");
  if (!fs.existsSync(up)) throw new Error("No upload/ folder. Run `yt kit` on this video first.");
  const sheet = read(path.join(up, "UPLOAD.md"));
  const [longPart = "", shortPart = ""] = sheet.split(/^## Short:/m);
  const tags = cell(longPart, "Tags")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const jobs: Job[] = [];
  for (const kind of kinds) {
    const video = path.join(folder, `${kind}.mp4`);
    if (!fs.existsSync(video)) {
      console.log(pc.yellow(`  ! ${kind}.mp4 not found, skipped`));
      continue;
    }
    const long = kind === "long";
    const title = read(path.join(up, long ? "title.txt" : "short-title.txt"));
    if (!title) throw new Error(`No title file for the ${kind} video. Run \`yt kit\` again.`);
    const thumb = path.join(up, "thumbnail-1.jpg");
    jobs.push({
      kind,
      video,
      title,
      description: read(path.join(up, long ? "description.txt" : "short-description.txt")),
      thumbnail: long && fs.existsSync(thumb) ? thumb : undefined,
      tags,
      visibility: cell(long ? longPart : shortPart, "Visibility"),
    });
  }
  return jobs;
}

// ── Chrome ────────────────────────────────────────────────────────────────

async function debuggerUp(): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    return res.ok;
  } catch {
    return false;
  }
}

async function openChrome(): Promise<Browser> {
  if (!(await debuggerUp())) {
    if (!fs.existsSync(CHROME)) throw new Error(`Google Chrome not found at ${CHROME}`);
    const profile = path.join(paths.secrets(), "chrome-profile");
    fs.mkdirSync(profile, { recursive: true });
    spawn(
      CHROME,
      [
        `--remote-debugging-port=${PORT}`,
        `--user-data-dir=${profile}`,
        "--no-first-run",
        "--no-default-browser-check",
        "https://studio.youtube.com",
      ],
      { detached: true, stdio: "ignore" },
    ).unref();
    for (let i = 0; i < 40 && !(await debuggerUp()); i++) await sleep(500);
    if (!(await debuggerUp())) throw new Error("Chrome did not start.");
  }
  try {
    return await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  } catch {
    // On macOS Chrome keeps running after its last window is closed, and then it
    // cannot be driven. Opening a window brings it back.
    await fetch(`http://127.0.0.1:${PORT}/json/new?https://studio.youtube.com`, {
      method: "PUT",
    }).catch(() => undefined);
    await sleep(1500);
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
    } catch {
      throw new Error(
        "The upload Chrome is running without a window. Quit that Chrome (Cmd+Q) and run the command again.",
      );
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Waits until a tab shows YouTube Studio, which means the user is signed in. */
async function waitForStudio(context: BrowserContext): Promise<void> {
  const page = context.pages()[0] ?? (await context.newPage());
  if (!page.url().includes("youtube.com")) await page.goto("https://studio.youtube.com");
  const signedIn = () =>
    context.pages().some((p) => /^https:\/\/studio\.youtube\.com\//.test(p.url()));
  if (signedIn()) return;
  console.log(
    pc.yellow(
      `  Sign in to the channel's Google account in the Chrome window. Waiting up to ${SIGN_IN_MINUTES} minutes.`,
    ),
  );
  const end = Date.now() + SIGN_IN_MINUTES * 60_000;
  while (Date.now() < end) {
    if (signedIn()) return;
    await sleep(1500);
  }
  throw new Error("Sign-in was not finished in time. Run the command again.");
}

// ── the upload dialog ─────────────────────────────────────────────────────

/** Runs one step. A failed step is reported and left for the user; the rest carry on. */
async function step(name: string, fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    console.log(`  ${pc.green("✔")} ${name}`);
    return true;
  } catch (err) {
    const why = (err as Error).message.split("\n")[0];
    console.log(`  ${pc.yellow("!")} ${name}: do this by hand ${pc.dim(`(${why})`)}`);
    return false;
  }
}

async function fillBox(page: Page, selector: string, text: string): Promise<void> {
  const box = page.locator(selector).first();
  await box.waitFor({ state: "visible", timeout: 60_000 });
  await box.click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.insertText(text);
}

async function uploadOne(context: BrowserContext, job: Job): Promise<void> {
  console.log(pc.bold(`\n${job.kind}.mp4`) + pc.dim(`  ${job.title}`));
  const page = await context.newPage();
  page.setDefaultTimeout(20_000);
  await page.goto("https://www.youtube.com/upload", { waitUntil: "domcontentloaded" });

  const sent = await step("video file chosen", async () => {
    const input = page.locator('input[type="file"]').first();
    await input.waitFor({ state: "attached", timeout: 60_000 });
    // Playwright copies files over the debugging connection and refuses those above
    // 50 MB. Chrome runs on this machine, so hand it the path instead.
    const cdp = await context.newCDPSession(page);
    const found = await cdp.send("Runtime.evaluate", {
      expression: `document.querySelector('input[type="file"]')`,
    });
    const objectId = found.result.objectId;
    if (!objectId) throw new Error("file input not found");
    await cdp.send("DOM.setFileInputFiles", { files: [job.video], objectId });
    await cdp.detach();
  });
  if (!sent) {
    console.log(pc.dim(`    File: ${job.video}`));
    return;
  }

  await step("title", () => fillBox(page, "#title-textarea #textbox", job.title));
  if (job.description)
    await step("description", () =>
      fillBox(page, "#description-textarea #textbox", job.description),
    );
  if (job.thumbnail) {
    const file = job.thumbnail;
    await step("thumbnail-1.jpg", async () => {
      const input = page
        .locator('ytcp-thumbnail-uploader input[type="file"], input#file-loader')
        .first();
      await input.setInputFiles(file);
    });
  }
  await step("audience: not made for kids", async () => {
    await page.locator('tp-yt-paper-radio-button[name="VIDEO_MADE_FOR_KIDS_NOT_MFK"]').click();
  });
  if (job.tags.length)
    await step(`${job.tags.length} tags`, async () => {
      await page.locator("#toggle-button").first().click();
      const input = page.locator("#tags-container input#text-input").first();
      await input.waitFor({ state: "visible" });
      await input.click();
      await page.keyboard.insertText(`${job.tags.join(",")},`);
    });

  await step("moved to the Visibility step", async () => {
    const tab = page.locator("#step-badge-3");
    await tab.waitFor({ state: "visible" });
    await tab.click();
  });

  console.log(pc.dim("    Left for you in this tab:"));
  if (job.visibility) console.log(pc.dim(`    · Visibility: ${job.visibility}`));
  else console.log(pc.dim("    · Visibility: choose Schedule or Private, then Save"));
  if (job.kind === "long")
    console.log(pc.dim("    · Playlist, subtitles (captions.srt), end screen: see UPLOAD.md"));
  else console.log(pc.dim("    · Related video: pick the long video"));
}

// ── command ───────────────────────────────────────────────────────────────

function resolveFolder(arg: string): string {
  const found = [path.resolve(process.cwd(), arg), path.resolve(rootDir(), arg)].find((p) =>
    fs.existsSync(path.join(p, "plan.json")),
  );
  if (!found) throw new Error(`No plan.json found in "${arg}".`);
  return found;
}

export function registerUploadCommand(program: Command): void {
  program
    .command("upload")
    .description(
      "open YouTube Studio in Chrome and fill the upload dialog from <folder>/upload (you press Save)",
    )
    .argument("<folder>", "video folder containing plan.json")
    .option("-f, --format <format>", "long, short or both", "both")
    .action(async (arg: string, opts: { format: string }) => {
      try {
        const kinds: Kind[] =
          opts.format === "both" ? ["long", "short"] : [opts.format === "short" ? "short" : "long"];
        const jobs = jobsFor(resolveFolder(arg), kinds);
        if (!jobs.length) throw new Error("Nothing to upload.");
        const browser = await openChrome();
        const context = browser.contexts()[0];
        if (!context) throw new Error("Chrome has no window open.");
        await waitForStudio(context);
        for (const job of jobs) await uploadOne(context, job);
        console.log(
          pc.green("\n✔ Dialogs filled.") +
            " Check each tab, set the visibility and press Save. Keep Chrome open until the uploads finish.",
        );
        // Detach only: Chrome stays open with the uploads running.
        process.exit(0);
      } catch (err) {
        console.error(pc.red(`✖ ${(err as Error).message}`));
        process.exit(1);
      }
    });
}
