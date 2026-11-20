import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PhotoData, Plan } from "@yt/templates/schema";
import { paths } from "./paths";

/**
 * Real photos from Wikimedia Commons. Plans list them in plan.photos by Commons file name; scenes
 * use them by id. Every Commons file carries a free licence (public domain, CC0, CC BY, CC BY-SA),
 * and each needs a credit line, which the kit puts in the description.
 */

const API = "https://commons.wikimedia.org/w/api.php";
const UA = { "User-Agent": "NextBigTech-video-tool/1.0 (YouTube explainer production)" };
/** Downloaded width. Commons serves standard thumbnail widths fastest; 1920 fills a 1080p frame. */
const WIDTH = 1920;
const FREE =
  /^(public domain|pd|cc0|cc by(-sa)? [1-4]\.0|cc by(-sa)? 2\.5|attribution|no restrictions|godl-india|ogl( v?\d)?)/i;

export interface PhotoCredit {
  id: string;
  /** Commons file name, e.g. "File:Jensen Huang (cropped) (2024).jpg". */
  title: string;
  author: string;
  license: string;
  /** The file's page on Commons (the attribution link). */
  url: string;
}

interface Cached {
  title: string;
  author: string;
  license: string;
  url: string;
  width: number;
  height: number;
  face: PhotoData["face"];
  subject: PhotoData["subject"];
  hasCut: boolean;
}

const cacheDir = () => path.join(paths.cache(), "photos");
const toolSource = () =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "scripts", "photo-tool.swift");
const toolBinary = () => path.join(paths.cache(), "bin", "photo-tool");

const plain = (html: string | undefined) =>
  (html ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

async function fetchRetry(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: UA });
    if (res.status !== 429 || attempt >= 4) return res;
    await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
  }
}

/** Compiles the Vision helper once (macOS only). Null when Swift isn't available. */
function photoTool(): string | null {
  const bin = toolBinary();
  const src = toolSource();
  if (fs.existsSync(bin) && fs.statSync(bin).mtimeMs >= fs.statSync(src).mtimeMs) return bin;
  if (process.platform !== "darwin") return null;
  try {
    fs.mkdirSync(path.dirname(bin), { recursive: true });
    execFileSync("swiftc", ["-O", src, "-o", bin], { stdio: "pipe" });
    return bin;
  } catch {
    return null;
  }
}

/** Faces, the main subject's box, and a cut-out PNG next to the photo. */
function analyse(file: string, cutFile: string): Pick<Cached, "face" | "subject" | "hasCut"> {
  const tool = photoTool();
  if (!tool) return { face: null, subject: null, hasCut: false };
  try {
    const out = execFileSync(tool, [file, cutFile], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const r = JSON.parse(out) as {
      faces: NonNullable<PhotoData["face"]>[];
      subject: PhotoData["subject"];
    };
    return { face: r.faces[0] ?? null, subject: r.subject ?? null, hasCut: fs.existsSync(cutFile) };
  } catch {
    return { face: null, subject: null, hasCut: false };
  }
}

/** Downloads (once) one Commons file and works out its faces and cut-out. Cached in data/cache/photos/. */
async function cachePhoto(title: string): Promise<{ file: string; cut: string; meta: Cached }> {
  const key = createHash("sha1").update(title).digest("hex").slice(0, 16);
  const file = path.join(cacheDir(), `${key}.jpg`);
  const cut = path.join(cacheDir(), `${key}.png`);
  const metaFile = path.join(cacheDir(), `${key}.json`);
  if (fs.existsSync(metaFile) && fs.existsSync(file)) {
    return { file, cut, meta: JSON.parse(fs.readFileSync(metaFile, "utf8")) as Cached };
  }
  const query = new URLSearchParams({
    action: "query",
    format: "json",
    prop: "imageinfo",
    titles: title,
    iiprop: "url|size|extmetadata|mime",
    iiurlwidth: String(WIDTH),
  });
  const res = await fetchRetry(`${API}?${query}`);
  if (!res.ok) throw new Error(`Commons lookup failed (${res.status}) for ${title}`);
  const data = (await res.json()) as {
    query: { pages: Record<string, { missing?: string; imageinfo?: Record<string, unknown>[] }> };
  };
  const page = Object.values(data.query.pages)[0];
  const info = page?.imageinfo?.[0] as
    | {
        url: string;
        thumburl?: string;
        descriptionurl: string;
        width: number;
        height: number;
        extmetadata?: Record<string, { value?: string }>;
      }
    | undefined;
  if (!info) throw new Error(`No such file on Wikimedia Commons: ${title}`);
  const m = info.extmetadata ?? {};
  const license = plain(m.LicenseShortName?.value) || "unknown licence";
  if (!FREE.test(license)) {
    throw new Error(`${title} is under "${license}", which is not a free licence we accept.`);
  }
  const image = await fetchRetry(info.thumburl ?? info.url);
  if (!image.ok) throw new Error(`Photo download failed (${image.status}): ${title}`);
  fs.mkdirSync(cacheDir(), { recursive: true });
  const tmp = `${file}.part`;
  fs.writeFileSync(tmp, Buffer.from(await image.arrayBuffer()));
  // Commons may hand back PNG or WebP thumbnails; the renderer only needs a file it can load.
  fs.renameSync(tmp, file);
  const scale = info.thumburl ? Math.min(1, WIDTH / info.width) : 1;
  const meta: Cached = {
    title,
    author: plain(m.Artist?.value) || "unknown",
    license,
    url: info.descriptionurl,
    width: Math.round(info.width * scale),
    height: Math.round(info.height * scale),
    ...analyse(file, cut),
  };
  fs.writeFileSync(metaFile, `${JSON.stringify(meta, null, 2)}\n`);
  return { file, cut, meta };
}

/** Where prepareMedia writes what the renderer and the kit need to know about the plan's photos. */
export const photoIndexFile = (mediaDir: string) => path.join(mediaDir, "photos", "index.json");

/** Downloads every photo in plan.photos into media/photos/ and writes media/photos/index.json. */
export async function ensurePhotos(plan: Plan, mediaDir: string): Promise<void> {
  const list = plan.photos ?? [];
  const index: Record<string, PhotoData & { credit: PhotoCredit }> = {};
  for (const p of list) {
    const { file, cut, meta } = await cachePhoto(p.commons);
    const dir = path.join(mediaDir, "photos");
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(file, path.join(dir, `${p.id}.jpg`));
    if (meta.hasCut) fs.copyFileSync(cut, path.join(dir, `${p.id}.png`));
    index[p.id] = {
      file: `photos/${p.id}.jpg`,
      cut: meta.hasCut ? `photos/${p.id}.png` : null,
      width: meta.width,
      height: meta.height,
      face: meta.face,
      subject: meta.subject,
      focus: p.focus ?? null,
      credit: {
        id: p.id,
        title: meta.title,
        author: meta.author,
        license: meta.license,
        url: meta.url,
      },
    };
  }
  if (list.length)
    fs.writeFileSync(photoIndexFile(mediaDir), `${JSON.stringify(index, null, 2)}\n`);
}

/** The photo data prepared for this plan (empty when it has none, or media isn't prepared yet). */
export function readPhotoIndex(
  mediaDir: string,
): Record<string, PhotoData & { credit: PhotoCredit }> {
  const file = photoIndexFile(mediaDir);
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8")) as Record<
    string,
    PhotoData & { credit: PhotoCredit }
  >;
}

/** "Name: photo by Author, CC BY 4.0, via Wikimedia Commons: <url>" — one line per photo, for the description. */
export function photoCreditLines(plan: Plan, credits: PhotoCredit[]): string[] {
  const names = new Map((plan.photos ?? []).map((p) => [p.id, p.name]));
  return credits.map((c) => {
    const who = names.get(c.id) ?? c.title.replace(/^File:/, "").replace(/\.\w+$/, "");
    return `${who}: photo by ${c.author}, ${c.license}, via Wikimedia Commons: ${c.url}`;
  });
}
