import { SCENE_H, SCENE_W } from "../../paper";
import type { SketchProps } from "../../schema";
import { type SceneCtx, springAt } from "../anim";
import { wordFrame } from "./ink";

/**
 * The camera of a sketch scene. A scene is cut into shots of about a second and a half:
 * the whole picture, then a figure, then the thing that just appeared, and so on. The camera
 * snaps or jumps between them and keeps pushing in or pulling out inside each shot, so the
 * picture on screen changes every second or two without the plan having to say so.
 */

const FIGURE_SCALE = 1.3;
/** Height of an illustrated cut-out figure at scale 1, in scene units. */
export const ART_H = 640;
/** Target length of one shot, in frames at 30 fps. */
const SHOT = 46;
const SNAP = { damping: 19, stiffness: 210, mass: 0.7 };

const FURNITURE: ReadonlySet<string> = new Set([
  "desk",
  "chair",
  "podium",
  "door",
  "building",
  "datacenter",
  "server",
  "vault",
  "plant",
  "crowd",
  "crate",
  "books",
  "sofa",
  "stairs",
  "mat",
]);

const WORDS: ReadonlySet<string> = new Set(["text", "number", "arrow", "banner", "tag"]);

export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Framing {
  cx: number;
  cy: number;
  z: number;
}

interface Target extends Framing {
  key: string;
  /** Frame from which it is on screen. */
  start: number;
  end: number;
}

export interface Shot extends Framing {
  from: number;
  length: number;
  /** Jump straight to this framing instead of flying to it. */
  cut: boolean;
  /** +1 pushes in during the shot, -1 pulls out. */
  push: 1 | -1;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function targets(props: SketchProps, ctx: SceneCtx, floor: number): Target[] {
  const out: Target[] = [];
  (props.actors ?? []).forEach((a, i) => {
    const s = FIGURE_SCALE * (a.scale ?? 1);
    const y = a.y === undefined ? floor : (a.y / 100) * SCENE_H;
    const start = a.at ? wordFrame(a.at, ctx, 0) + 14 : -1;
    // A figure that walks to a new spot is one target before the walk and another after it.
    const moved = a.to
      ? wordFrame(a.to.at, ctx, ctx.voiceStart + ctx.voiceFrames * 0.5)
      : Number.POSITIVE_INFINITY;
    // With a speech bubble the shot is wider and higher, so the words stay in the picture.
    const tall = a.say ? 800 : 520;
    // An illustrated figure is framed from the waist up; with a bubble, whole and with room above.
    const h = ART_H * (a.scale ?? 1);
    const shot = a.art
      ? a.say
        ? { cy: y - h * 0.62, z: clamp(SCENE_H / (h * 1.5), 1.1, 1.8) }
        : { cy: y - h * 0.7, z: clamp(SCENE_H / (h * 0.9), 1.25, 2.1) }
      : { cy: y - (a.say ? 330 : 250) * s, z: clamp(SCENE_H / (tall * s), 1.25, 2.3) };
    out.push({ key: `a${i}`, start, end: moved, cx: (a.x / 100) * SCENE_W, ...shot });
    if (a.to)
      out.push({
        key: `a${i}`,
        start: moved + 22,
        end: Number.POSITIVE_INFINITY,
        cx: (a.to.x / 100) * SCENE_W,
        ...shot,
      });
  });
  (props.props ?? []).forEach((p, i) => {
    // Furniture is part of the room, not something to look at, unless the story brings it in on a word.
    if (FURNITURE.has(p.kind) && !p.at) return;
    const s = p.scale ?? 1;
    const x = (p.x / 100) * SCENE_W;
    const y = p.y === undefined ? floor : (p.y / 100) * SCENE_H;
    const start = p.at ? wordFrame(p.at, ctx, 0) : -1;
    const end = p.until
      ? wordFrame(p.until, ctx, Number.POSITIVE_INFINITY)
      : Number.POSITIVE_INFINITY;
    if (WORDS.has(p.kind)) {
      // Written words get a lean towards them, not a close-up: alone they would fill the frame with wall.
      if (!p.at) return;
      out.push({
        key: `p${i}`,
        start,
        end,
        cx: (x + SCENE_W / 2) / 2,
        cy: (y + SCENE_H / 2) / 2,
        z: 1.3,
      });
      return;
    }
    out.push({
      key: `p${i}`,
      start,
      end,
      cx: x,
      cy: y - 120 * s,
      z: clamp(1.95 / Math.sqrt(s), 1.3, 2.1),
    });
  });
  return out;
}

/** The shots of one scene, in order. */
export function shotsFor(props: SketchProps, ctx: SceneCtx, floor: number): Shot[] {
  const wide: Framing = { cx: ((props.focus ?? 50) / 100) * SCENE_W, cy: SCENE_H / 2, z: 1 };
  const duration = Math.max(1, ctx.duration);
  const n = Math.max(1, Math.round(duration / SHOT));
  const length = duration / n;
  // Painted scenes take gentler close-ups: the art is full of detail, and words must stay in the picture.
  const soften = props.backdrop ? 0.28 : 1;
  const all =
    props.camera === "still"
      ? []
      : targets(props, ctx, floor).map((t) => ({ ...t, z: 1 + (t.z - 1) * soften }));
  const shots: Shot[] = [];
  const used: string[] = [];
  let turn = ctx.index;

  for (let k = 0; k < n; k++) {
    const from = Math.round(k * length);
    const seen = all.filter((t) => t.start <= from + 8 && t.end >= from + length);
    // Something that arrived since the last cut gets the shot.
    const fresh = seen
      .filter((t) => t.start > from - length && !used.slice(-1).includes(t.key))
      .sort((p, q) => q.start - p.start)[0];
    let pick: Target | undefined;
    if (fresh) pick = fresh;
    else if (k % 3 !== (ctx.index % 2 === 0 ? 0 : 1) && seen.length) {
      const rest = seen.filter((t) => !used.slice(-2).includes(t.key));
      const pool = rest.length ? rest : seen;
      pick = pool[turn++ % pool.length];
    }
    const last = shots[shots.length - 1];
    const framing: Framing = pick ?? (last && last.z === 1 ? { ...wide, z: 1.14 } : wide);
    used.push(pick?.key ?? "wide");
    shots.push({
      ...framing,
      from,
      length,
      // Figure to object and back is a jump; anything to or from the whole picture is a fast zoom.
      cut: Boolean(last && pick && last.z > 1.2 && k % 2 === 1),
      push: (k + ctx.index) % 3 === 2 ? -1 : 1,
    });
  }
  return shots;
}

function at(shot: Shot, frame: number): Framing {
  const t = clamp((frame - shot.from) / Math.max(1, shot.length), 0, 1.4);
  const drift = shot.push > 0 ? 1 + 0.07 * t : 1.07 - 0.07 * t;
  return { cx: shot.cx, cy: shot.cy, z: shot.z * drift };
}

/**
 * What the camera sees at `frame`. `w0` × `h0` is the part of the scene that fills the picture
 * at zoom 1 (the whole scene in landscape, the middle of it in a Short).
 */
export function viewAt(shots: Shot[], frame: number, fps: number, w0: number, h0: number): View {
  let k = 0;
  for (let i = 0; i < shots.length; i++) if ((shots[i] as Shot).from <= frame) k = i;
  const now = shots[k] as Shot;
  let f = at(now, frame);
  const before = shots[k - 1];
  if (before && !now.cut) {
    const s = springAt(frame, fps, now.from, SNAP);
    if (s < 0.999) {
      const p = at(before, now.from);
      f = { cx: p.cx + (f.cx - p.cx) * s, cy: p.cy + (f.cy - p.cy) * s, z: p.z + (f.z - p.z) * s };
    }
  }
  const w = Math.min(SCENE_W, w0 / f.z);
  const h = Math.min(SCENE_H, h0 / f.z);
  return {
    x: clamp(f.cx - w / 2, 0, SCENE_W - w),
    y: clamp(f.cy - h / 2, 0, SCENE_H - h),
    w,
    h,
  };
}
