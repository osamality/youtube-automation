import { useMemo } from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { ArtSource, MangaActor, MangaBubble, MangaPanel, MangaProps, MangaSfx } from "../../schema";
import { clamp01, POP, type SceneCtx, springAt } from "../anim";
import { letterFont, sfxFont } from "../fonts";
import { hash, lerp, wordFrame, wrap } from "../paper/ink";
import { Sfx } from "../Sfx";
import { useStage } from "../stage";
import { useArtLoaded } from "./Sketch";

/**
 * A colour manga page. Panels appear on spoken words; inside each one the camera keeps moving
 * (a new framing about every 1.6 s in full-frame panels), cut-out characters slide in and swap
 * poses, and bubbles, sound-effect words and speed lines land on the narration.
 */

const INK = "#111111";
const PAGE = "#FAFAF7";
const BORDER = 7;
/** Frames per camera shot in a full-frame panel (about 1.3 s at 30 fps). */
const SHOT = 40;
const SNAP = { damping: 20, stiffness: 220, mass: 0.7 };
const SLIDE = { damping: 18, stiffness: 150, mass: 0.8 };
/** Length of the rewind effect, in frames. */
const REWIND = 40;
const SFX_COLOURS = { red: "#FF3B30", yellow: "#FFD60A", white: "#FFFFFF", blue: "#3FA9FF" } as const;

type Pt = [number, number];
interface Geo {
  pts: Pt[];
  x: number;
  y: number;
  w: number;
  h: number;
}
interface Framing {
  z: number;
  px: number;
  py: number;
  /** Camera tilt in degrees (dutch angle). */
  r: number;
}

function geo(pts: Pt[]): Geo {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { pts, x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Panel shapes for a layout, in frame pixels. Gutters slant, like a printed manga page. */
export function panelGeometry(layout: "full" | "row" | "feature", n: number, W: number, H: number): Geo[] {
  const full = geo([
    [0, 0],
    [W, 0],
    [W, H],
    [0, H],
  ]);
  if (layout === "full" || n === 1) return Array.from({ length: n }, () => full);
  const m = 26;
  const g = 20;
  const portrait = H > W;
  if (!portrait) {
    const s = 55;
    if (layout === "row" || n === 2) {
      // Vertical cut lines: [x at the top, x at the bottom].
      const cuts: [number, number][] = [[m, m]];
      for (let i = 1; i < n; i++) {
        const xc = m + ((W - 2 * m) * i) / n;
        cuts.push([xc + s, xc - s]);
      }
      cuts.push([W - m, W - m]);
      return Array.from({ length: n }, (_, i) => {
        const L = cuts[i] as [number, number];
        const R = cuts[i + 1] as [number, number];
        const gl = i > 0 ? g / 2 : 0;
        const gr = i < n - 1 ? g / 2 : 0;
        return geo([
          [L[0] + gl, m],
          [R[0] - gr, m],
          [R[1] - gr, H - m],
          [L[1] + gl, H - m],
        ]);
      });
    }
    // Feature: one big panel on the left, two stacked on the right.
    const xc = m + (W - 2 * m) * 0.58;
    const xAt = (y: number) => xc + s + (-2 * s * (y - m)) / (H - 2 * m);
    const yl = H / 2 + 28;
    const yr = H / 2 - 28;
    return [
      geo([
        [m, m],
        [xAt(m) - g / 2, m],
        [xAt(H - m) - g / 2, H - m],
        [m, H - m],
      ]),
      geo([
        [xAt(m) + g / 2, m],
        [W - m, m],
        [W - m, yr - g / 2],
        [xAt(yl - g / 2) + g / 2, yl - g / 2],
      ]),
      geo([
        [xAt(yl + g / 2) + g / 2, yl + g / 2],
        [W - m, yr + g / 2],
        [W - m, H - m],
        [xAt(H - m) + g / 2, H - m],
      ]),
    ];
  }
  // Portrait: bands stacked top to bottom, like a vertical-scroll comic.
  const s = 40;
  const shares = layout === "feature" && n === 3 ? [0.44, 0.28, 0.28] : Array.from({ length: n }, () => 1 / n);
  const cuts: [number, number][] = [[m, m]];
  let acc = m;
  for (let i = 0; i < n - 1; i++) {
    acc += (H - 2 * m) * (shares[i] ?? 0);
    cuts.push([acc + s, acc - s]);
  }
  cuts.push([H - m, H - m]);
  return Array.from({ length: n }, (_, i) => {
    const T = cuts[i] as [number, number];
    const B = cuts[i + 1] as [number, number];
    const gt = i > 0 ? g / 2 : 0;
    const gb = i < n - 1 ? g / 2 : 0;
    return geo([
      [m, T[0] + gt],
      [W - m, T[1] + gt],
      [W - m, B[1] - gb],
      [m, B[0] - gb],
    ]);
  });
}

const points = (pts: Pt[]) => pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");

/** A cut-out standing on the origin: `h` tall, centred, cropped to its subject. */
const CutOut: React.FC<{ art: ArtSource; h: number }> = ({ art, h }) => {
  const b = art.box ?? { x: 0, y: 0, w: 1, h: 1 };
  const bw = b.w * art.width;
  const bh = b.h * art.height;
  const w = (h * bw) / bh;
  return (
    <svg x={-w / 2} y={-h} width={w} height={h} viewBox={`${b.x * art.width} ${b.y * art.height} ${bw} ${bh}`} overflow="hidden">
      <image href={staticFile(art.file)} width={art.width} height={art.height} />
    </svg>
  );
};

interface Timing {
  frame: number;
  fps: number;
  ctx: SceneCtx;
}

const actorStart = (a: MangaActor, t: Timing, panelStart: number) =>
  a.at ? wordFrame(a.at, t.ctx, panelStart) : panelStart;

/** Where an actor stands at a frame, in % of the picture, after any `to` move. */
function actorSpot(a: MangaActor, t: Timing, at: number): { x: number; y: number } {
  let x = a.x;
  let y = a.y ?? 104;
  if (a.to) {
    const k = springAt(at, t.fps, wordFrame(a.to.at, t.ctx, 30), { damping: 20, stiffness: 90 });
    x = lerp(x, a.to.x, k);
    if (a.to.y !== undefined) y = lerp(y, a.to.y, k);
  }
  return { x, y };
}

/**
 * Where the camera looks inside a full-frame panel. The shots cycle through a wide shot, tilted
 * close-ups on faces, a two-shot or medium, a second close-up, and a tilted wide, so the picture
 * changes about every 1.3 s without the plan saying so.
 */
function shotFraming(p: MangaPanel, k: number, at: number, t: Timing, fx: number, fy: number): Framing {
  const shown = (p.actors ?? []).filter((a) => actorStart(a, t, 0) <= at + 6);
  const side = k % 2 === 0 ? 1 : -1;
  const close = (a: MangaActor | undefined, tilt: number, tight = 1): Framing | null => {
    if (!a) return null;
    const h = a.h ?? 95;
    const spot = actorSpot(a, t, at + SHOT / 2);
    // Close-ups frame the face: centred just above the eyes (eyes sit about 7% below the top of
    // a standing figure), so the frame ends around the shoulders.
    const face = spot.y - h * 0.95;
    return {
      z: Math.min(2.4, Math.max(1.9, ((1.9 * 95) / h) * tight)),
      px: spot.x / 100,
      py: face / 100,
      r: tilt,
    };
  };
  if (k === 0) return { z: 1, px: fx, py: fy, r: 0 };
  switch (k % 5) {
    case 1:
      return close(shown[shown.length - 1], 4 * side) ?? { z: 1.35, px: fx, py: fy, r: 3 * side };
    case 2: {
      const [a, b] = shown;
      if (a && b) {
        const sa = actorSpot(a, t, at + SHOT / 2);
        const sb = actorSpot(b, t, at + SHOT / 2);
        return { z: 1.12, px: (sa.x + sb.x) / 200, py: fy, r: 0 };
      }
      return { z: 1.22, px: fx + 0.06 * side, py: fy, r: 2 * side };
    }
    case 3:
      return close(shown[0], -5 * side, 1.15) ?? { z: 1.5, px: fx, py: fy - 0.05, r: -4 * side };
    default:
      return { z: 1.1, px: fx - 0.04 * side, py: fy, r: -3 * side };
  }
}

const PanelView: React.FC<{
  panel: MangaPanel;
  g: Geo;
  id: string;
  start: number;
  end: number;
  full: boolean;
  border: boolean;
  t: Timing;
}> = ({ panel, g, id, start, end, full, border, t }) => {
  const { art: pictures } = useStage();
  const { frame, fps, ctx } = t;
  const pic = pictures[panel.art];
  if (!pic) return null;
  const cover = Math.max(g.w / pic.width, g.h / pic.height) * 1.06;
  const dw = pic.width * cover;
  const dh = pic.height * cover;
  // Without a focus, the camera aims at the lead character's shoulders, not the middle of the body.
  const lead = panel.actors?.[0];
  const leadSpot = lead ? actorSpot(lead, t, frame) : null;
  const fx = (panel.focus?.x ?? leadSpot?.x ?? 50) / 100;
  const fy = panel.focus
    ? panel.focus.y / 100
    : leadSpot
      ? Math.max(0.15, (leadSpot.y - 0.82 * (lead?.h ?? 95)) / 100)
      : 0.5;

  // Camera inside the panel.
  let f: Framing;
  const life = frame - start;
  if (full) {
    const k = Math.max(0, Math.floor(life / SHOT));
    const cur = shotFraming(panel, k, start + k * SHOT, t, fx, fy);
    const prev = k > 0 ? shotFraming(panel, k - 1, start + (k - 1) * SHOT, t, fx, fy) : cur;
    // Every other shot is a hard cut; the rest snap across quickly.
    const blend = k % 2 === 1 ? 1 : springAt(frame, fps, start + k * SHOT, SNAP);
    const push = 1 + 0.06 * clamp01((life - k * SHOT) / SHOT);
    f = {
      z: lerp(prev.z, cur.z, blend) * push,
      px: lerp(prev.px, cur.px, blend),
      py: lerp(prev.py, cur.py, blend),
      r: lerp(prev.r, cur.r, blend),
    };
  } else {
    const p = Math.sin((Math.PI / 2) * clamp01(life / Math.max(60, end - start)));
    const move = panel.move ?? "in";
    f = { z: 1.12, px: fx, py: fy, r: 0 };
    if (move === "in") f.z = 1 + 0.16 * p;
    if (move === "out") f.z = 1.18 - 0.16 * p;
    if (move === "left") f.px = fx + 0.06 - 0.12 * p;
    if (move === "right") f.px = fx - 0.06 + 0.12 * p;
    if (move === "up") f.py = fy + 0.06 - 0.12 * p;
    if (move === "down") f.py = fy - 0.06 + 0.12 * p;
  }
  // The background zooms less than the characters (parallax); keep its window, tilted or not,
  // inside the picture. A tilt the picture can't cover is dropped.
  const zb = 1 + 0.6 * (f.z - 1);
  const windowOf = (deg: number) => {
    const rad = (Math.abs(deg) * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return { hw: (g.w * c + g.h * s) / (2 * zb * dw), hh: (g.w * s + g.h * c) / (2 * zb * dh) };
  };
  let tilt = f.r;
  let win = windowOf(tilt);
  if (win.hw > 0.5 || win.hh > 0.5) {
    tilt = 0;
    win = windowOf(0);
  }
  const hw = Math.min(0.5, win.hw);
  const hh = Math.min(0.5, win.hh);
  const px = Math.min(1 - hw, Math.max(hw, f.px));
  const py = Math.min(1 - hh, Math.max(hh, f.py));
  // The background stays inside the picture; in close-ups the characters may go past that limit,
  // so a face near the top of the picture can still sit in the middle of the frame.
  const free = clamp01((f.z - 1.3) / 0.4);
  const ax = lerp(px, Math.min(0.95, Math.max(0.05, f.px)), free) * dw;
  const ay = lerp(py, Math.min(0.95, Math.max(0.02, f.py)), free) * dh;
  const cx = px * dw;
  const cy = py * dh;
  const content = `translate(${g.x + g.w / 2} ${g.y + g.h / 2}) rotate(${tilt}) scale(${f.z}) translate(${-ax} ${-ay})`;
  const bg = `translate(${ax} ${ay}) scale(${zb / f.z}) translate(${-cx} ${-cy})`;
  const mono = panel.tone === "mono";
  const linesAt = wordFrame(panel.linesAt, ctx, start);

  return (
    <g>
      <g clipPath={`url(#${id})`}>
        <g style={mono ? { filter: "grayscale(1) contrast(1.25)" } : undefined}>
          <rect x={g.x} y={g.y} width={g.w} height={g.h} fill="#FFFFFF" />
          <g transform={content}>
            <g transform={bg}>
              <image href={staticFile(pic.file)} width={dw} height={dh} preserveAspectRatio="none" />
            </g>
            {(panel.actors ?? []).map((a, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: plan order is the identity
              <ActorView key={i} a={a} i={i} dw={dw} dh={dh} start={actorStart(a, t, start)} t={t} />
            ))}
          </g>
        </g>
        {panel.lines && frame >= linesAt && (
          <Lines kind={panel.lines} g={g} age={frame - linesAt} frame={frame} />
        )}
      </g>
      {border && <polygon points={points(g.pts)} fill="none" stroke={INK} strokeWidth={BORDER} strokeLinejoin="miter" />}
      {(panel.bubbles ?? []).map((b, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: plan order is the identity
        <BubbleView key={i} b={b} g={g} at={wordFrame(b.at, ctx, start + 6)} t={t} />
      ))}
    </g>
  );
};

const ActorView: React.FC<{ a: MangaActor; i: number; dw: number; dh: number; start: number; t: Timing }> = ({
  a,
  i,
  dw,
  dh,
  start,
  t,
}) => {
  const { art: pictures } = useStage();
  const { frame, fps, ctx } = t;
  const enter = a.enter ?? (a.at ? "slide" : "none");
  if (enter !== "none" && frame < start) return null;
  // Pose and facing: the starting ones, then each beat from its word on.
  let pose = a.art;
  let poseAt = -1000;
  let facing = a.flip ? -1 : 1;
  let before = facing;
  let turnAt = -1000;
  for (const b of a.beats ?? []) {
    const bf = wordFrame(b.at, ctx, start);
    if (bf > frame) continue;
    if (b.art) {
      pose = b.art;
      poseAt = bf;
    }
    if (b.flip !== undefined && (b.flip ? -1 : 1) !== facing) {
      before = facing;
      facing = b.flip ? -1 : 1;
      turnAt = bf;
    }
  }
  const cut = pictures[pose];
  if (!cut) return null;
  const spot = actorSpot(a, t, frame);
  const x = (spot.x / 100) * dw;
  const y = (spot.y / 100) * dh;
  const h = ((a.h ?? 95) / 100) * dh;
  let dx = 0;
  let dy = 0;
  let s = 1;
  let opacity = 1;
  let moving = 0;
  if (enter === "slide" || enter === "left" || enter === "right") {
    const k = springAt(frame, fps, start, SLIDE);
    const dir = enter === "left" ? -1 : enter === "right" ? 1 : x < dw / 2 ? -1 : 1;
    dx = (1 - k) * dir * dw * 0.45;
    opacity = clamp01(k * 3);
    moving = k < 0.97 ? 1 : 0;
  } else if (enter === "bottom") {
    const k = springAt(frame, fps, start, { damping: 14, stiffness: 170 });
    dy = (1 - k) * h * 0.7;
    opacity = clamp01(k * 3);
  } else if (enter === "pop") {
    const k = springAt(frame, fps, start, POP);
    s = 0.3 + 0.7 * k;
    opacity = clamp01(k * 3);
  }
  if (a.to) {
    const k = springAt(frame, fps, wordFrame(a.to.at, ctx, start + 30), { damping: 20, stiffness: 90 });
    if (k > 0.02 && k < 0.97) moving = 1;
  }
  // Turning round squeezes the figure through the middle; a new pose lands with a small hop.
  const turn = clamp01((frame - turnAt) / 8);
  const sign = lerp(before, facing, turn < 1 ? 0.5 - 0.5 * Math.cos(Math.PI * turn) : 1);
  const swap = 1 - springAt(frame, fps, poseAt, POP);
  const breathe = 1 + Math.sin((frame + i * 31) / 14) * 0.014;
  const bob = Math.sin((frame + i * 23) / 19) * dh * 0.005 - Math.abs(Math.sin(frame / 3.4)) * h * 0.025 * moving;
  const sway = Math.sin((frame + i * 41) / 27) * 1.3 + Math.sin(frame / 3.4) * 2.5 * moving;
  const sx = sign * s * (1 + swap * 0.06);
  const sy = s * breathe * (1 - swap * 0.04);
  return (
    <g opacity={opacity}>
      {spot.y <= 100 && <ellipse cx={x + dx} cy={y} rx={h * 0.16} ry={h * 0.022} fill="#000000" opacity={0.18} />}
      <g transform={`translate(${x + dx} ${y + dy + bob - swap * h * 0.03}) rotate(${sway}) scale(${sx} ${sy})`}>
        <CutOut art={cut} h={h} />
      </g>
    </g>
  );
};

/** Radial focus lines or horizontal speed streaks, flickering every few frames. */
const Lines: React.FC<{ kind: "radial" | "speed"; g: Geo; age: number; frame: number }> = ({ kind, g, age, frame }) => {
  const fade = clamp01(age / 5);
  const seed = Math.floor(frame / 3);
  const cx = g.x + g.w / 2;
  const cy = g.y + g.h / 2;
  if (kind === "radial") {
    const R = Math.hypot(g.w, g.h) * 0.62;
    const n = 84;
    return (
      <g opacity={0.78 * fade}>
        {Array.from({ length: n }, (_, i) => {
          const a = (i / n) * Math.PI * 2 + hash(i * 7.1 + seed) * 0.05;
          const wdt = 0.006 + hash(i * 3.3 + seed) * 0.016;
          const r0 = R * (0.5 + hash(i * 1.7 + seed * 0.37) * 0.25);
          const tip: Pt = [cx + Math.cos(a) * r0, cy + Math.sin(a) * r0];
          const b1: Pt = [cx + Math.cos(a - wdt) * R * 1.3, cy + Math.sin(a - wdt) * R * 1.3];
          const b2: Pt = [cx + Math.cos(a + wdt) * R * 1.3, cy + Math.sin(a + wdt) * R * 1.3];
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed lines
          return <polygon key={i} points={points([tip, b1, b2])} fill={INK} />;
        })}
      </g>
    );
  }
  const n = 34;
  return (
    <g opacity={fade}>
      {Array.from({ length: n }, (_, i) => {
        const len = 160 + hash(i + 3) * 520;
        const span = g.w + len * 2;
        const x = g.x + g.w + len - ((hash(i + 9) * span + age * (42 + hash(i) * 34)) % span);
        const y = g.y + hash(i * 2.3) * g.h;
        const th = 2 + hash(i * 5.1) * 6;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed lines
          <rect key={i} x={x} y={y} width={len} height={th} rx={th / 2} fill={i % 3 === 0 ? INK : "#FFFFFF"} opacity={0.85} />
        );
      })}
    </g>
  );
};

const BubbleView: React.FC<{ b: MangaBubble; g: Geo; at: number; t: Timing }> = ({ b, g, at, t }) => {
  const { frame, fps } = t;
  const s = springAt(frame, fps, at, POP);
  if (frame < at || s <= 0.01) return null;
  const kind = b.kind ?? "speech";
  const k = Math.min(g.w, g.h) / 1080;
  const fs = Math.max(30, 44 * Math.max(0.75, k));
  // Widen the bubble rather than cut words: at most four lines.
  let width = kind === "shout" ? 12 : 16;
  let rows = wrap(b.text.toUpperCase(), width);
  while (rows.length > 4 && width < 40) {
    width += 2;
    rows = wrap(b.text.toUpperCase(), width);
  }
  const tw = Math.max(...rows.map((r) => r.length), 4) * fs * 0.6;
  const th = rows.length * fs * 1.12;
  const rx = tw / 2 + (kind === "shout" ? 70 : 52);
  const ry = th / 2 + (kind === "shout" ? 58 : 40);
  const cx = Math.min(g.x + g.w - rx - 12, Math.max(g.x + rx + 12, g.x + (b.x / 100) * g.w));
  const cy = Math.min(g.y + g.h - ry - 12, Math.max(g.y + ry + 12, g.y + (b.y / 100) * g.h));
  const tail = b.tail ?? (kind === "shout" ? "none" : "down");
  let tailPts: Pt[] | null = null;
  if (tail === "down") tailPts = [[cx - 26, cy + ry * 0.78], [cx + 14, cy + ry * 0.86], [cx + 34, cy + ry + 62]];
  if (tail === "left") tailPts = [[cx - rx * 0.8, cy - 18], [cx - rx * 0.78, cy + 24], [cx - rx - 64, cy + 40]];
  if (tail === "right") tailPts = [[cx + rx * 0.8, cy - 18], [cx + rx * 0.78, cy + 24], [cx + rx + 64, cy + 40]];
  const spikes: Pt[] = [];
  if (kind === "shout") {
    const n = 22;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? 1.2 + hash(i) * 0.12 : 0.92;
      spikes.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]);
    }
  }
  const sc = 0.4 + 0.6 * s;
  return (
    <g transform={`translate(${cx} ${cy}) scale(${sc}) translate(${-cx} ${-cy})`} opacity={clamp01(s * 2.5)}>
      {kind === "thought" ? (
        <g fill="#FFFFFF" stroke={INK} strokeWidth={4}>
          <circle cx={cx - rx * 0.55} cy={cy + ry + 26} r={16} />
          <circle cx={cx - rx * 0.72} cy={cy + ry + 60} r={9} />
        </g>
      ) : (
        tailPts && <polygon points={points(tailPts)} fill="#FFFFFF" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
      )}
      {kind === "shout" ? (
        <polygon points={points(spikes)} fill="#FFFFFF" stroke={INK} strokeWidth={5} strokeLinejoin="miter" />
      ) : (
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#FFFFFF" stroke={INK} strokeWidth={kind === "thought" ? 4 : 5} strokeDasharray={kind === "thought" ? "2 0" : undefined} />
      )}
      {kind === "speech" && tailPts && (
        <polygon points={points(tailPts.map(([x, y]) => [lerp(x, cx, 0.06), lerp(y, cy, 0.06)] as Pt))} fill="#FFFFFF" />
      )}
      <text x={cx} y={cy - th / 2 + fs * 0.88} textAnchor="middle" fontSize={fs} fontWeight={700} fill={INK} style={{ fontFamily: letterFont(), letterSpacing: fs * 0.02 }}>
        {rows.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines of one bubble
          <tspan key={i} x={cx} dy={i === 0 ? 0 : fs * 1.12}>
            {r}
          </tspan>
        ))}
      </text>
    </g>
  );
};

const SfxWord: React.FC<{ sf: MangaSfx; W: number; H: number; t: Timing }> = ({ sf, W, H, t }) => {
  const { frame, fps, ctx } = t;
  const at = wordFrame(sf.at, ctx, ctx.enter);
  const age = frame - at;
  if (age < 0) return null;
  const s = springAt(frame, fps, at, { damping: 10, stiffness: 260, mass: 0.5 });
  const size = ((sf.size ?? 16) / 100) * Math.min(W, H) * (H > W ? 1.1 : 1);
  const jx = age < 14 ? (hash(age * 3.1) * 2 - 1) * 12 * (1 - age / 14) : Math.sin(frame * 1.7) * 1.4;
  const jy = age < 14 ? (hash(age * 5.7) * 2 - 1) * 10 * (1 - age / 14) : Math.cos(frame * 1.9) * 1.2;
  const x = (sf.x / 100) * W + jx;
  const y = (sf.y / 100) * H + jy;
  const fill = SFX_COLOURS[sf.color ?? "red"];
  const common = {
    x: 0,
    y: 0,
    textAnchor: "middle" as const,
    dominantBaseline: "central" as const,
    fontSize: size,
    strokeLinejoin: "round" as const,
    paintOrder: "stroke" as const,
    style: { fontFamily: sfxFont(), letterSpacing: size * 0.04 },
  };
  return (
    <g transform={`translate(${x} ${y}) rotate(${sf.rot ?? -8}) scale(${2.6 - 1.6 * s})`} opacity={clamp01(s * 4)}>
      <text {...common} fill="#FFFFFF" stroke="#FFFFFF" strokeWidth={size * 0.3}>
        {sf.text.toUpperCase()}
      </text>
      <text {...common} fill={fill} stroke={INK} strokeWidth={size * 0.13}>
        {sf.text.toUpperCase()}
      </text>
    </g>
  );
};

const NarrationBox: React.FC<{ text: string; at: number; W: number; H: number; t: Timing; low?: boolean }> = ({ text, at, W, H, t, low }) => {
  const { frame, fps } = t;
  const s = springAt(frame, fps, at, { damping: 18, stiffness: 180 });
  if (frame < at) return null;
  const portrait = H > W;
  const fs = portrait ? 44 : 42;
  let width = portrait ? 24 : 30;
  let rows = wrap(text.toUpperCase(), width);
  while (rows.length > 3 && width < 60) {
    width += 4;
    rows = wrap(text.toUpperCase(), width);
  }
  const w = Math.max(...rows.map((r) => r.length)) * fs * 0.6 + 48;
  const h = rows.length * fs * 1.2 + 30;
  const x = portrait ? (W - w) / 2 : 40;
  const y = portrait ? H * 0.11 : low ? W * 0.078 : 34;
  return (
    <g transform={`translate(${(1 - s) * -(w + 80)} 0)`}>
      <rect x={x} y={y} width={w} height={h} fill="#FFF4C7" stroke={INK} strokeWidth={5} />
      <text x={x + w / 2} y={y + 15 + fs * 0.9} textAnchor="middle" fontSize={fs} fontWeight={700} fill={INK} style={{ fontFamily: letterFont() }}>
        {rows.map((r, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines of one box
          <tspan key={i} x={x + w / 2} dy={i === 0 ? 0 : fs * 1.2}>
            {r}
          </tspan>
        ))}
      </text>
    </g>
  );
};

/** The rewind look: blue tint, rolling scan bars and a big ◀◀ sign. */
const RewindOverlay: React.FC<{ age: number; W: number; H: number; frame: number }> = ({ age, W, H, frame }) => {
  const seed = Math.floor(frame / 2);
  const pulse = 0.85 + 0.15 * Math.sin(age / 2);
  const out = clamp01((age - (REWIND - 8)) / 8);
  const s = Math.min(W, H) / 1080;
  return (
    <g>
      <rect width={W} height={H} fill="#1E5BFF" opacity={0.28 * (1 - out)} />
      {Array.from({ length: 10 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed bars
        <rect key={i} x={0} y={hash(i * 3.7 + seed) * H} width={W} height={4 + hash(i + seed) * 22} fill="#FFFFFF" opacity={0.35 * (1 - out)} />
      ))}
      <g transform={`translate(${W - 230 * s} ${150 * s}) scale(${s * pulse})`} opacity={1 - out}>
        <polygon points="0,-60 -90,0 0,60" fill="#FFFFFF" stroke={INK} strokeWidth={8} strokeLinejoin="round" />
        <polygon points="95,-60 5,0 95,60" fill="#FFFFFF" stroke={INK} strokeWidth={8} strokeLinejoin="round" />
      </g>
      <rect width={W} height={H} fill="#FFFFFF" opacity={0.85 * out * (1 - clamp01((age - REWIND) / 6))} />
    </g>
  );
};

export const Manga: React.FC<{ props: MangaProps; ctx: SceneCtx; tagged?: boolean }> = ({ props, ctx, tagged }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H } = useVideoConfig();
  const { art: pictures } = useStage();
  const n = props.panels.length;
  const layout = props.layout ?? (n === 1 ? "full" : n === 2 ? "row" : "feature");
  const full = layout === "full";
  const portrait = H > W;
  // Panel shapes by how many panels are on the page: one alone fills the frame, two share it.
  const sets = useMemo(
    () =>
      Array.from({ length: n + 1 }, (_, v) =>
        full || v <= 1
          ? panelGeometry("full", Math.max(1, n), W, H)
          : panelGeometry(layout === "feature" && v === 2 ? "row" : layout, v, W, H),
      ),
    [full, layout, n, W, H],
  );
  const t: Timing = { frame, fps, ctx };

  const ids = new Set<string>();
  for (const p of props.panels) {
    ids.add(p.art);
    for (const a of p.actors ?? []) {
      ids.add(a.art);
      for (const b of a.beats ?? []) if (b.art) ids.add(b.art);
    }
  }
  useArtLoaded([...ids].flatMap((id) => (pictures[id] ? [staticFile(pictures[id].file)] : [])));

  const starts = props.panels.map((p, i) =>
    i === 0 ? 0 : wordFrame(p.at, ctx, ctx.voiceStart + (ctx.voiceFrames * i) / n),
  );

  // Hits on the whole page.
  const fx = props.fx ?? [];
  let dx = 0;
  let dy = 0;
  let punch = 1;
  let rewindAge = -1;
  for (const f of fx) {
    const at = wordFrame(f.at, ctx, ctx.enter);
    const age = frame - at;
    if (age < 0) continue;
    if (f.kind === "shake") {
      const decay = Math.max(0, 1 - age / 16);
      dx += Math.sin(age * 2.3) * 24 * decay;
      dy += Math.cos(age * 2.9) * 16 * decay;
    }
    if (f.kind === "zoom") punch *= 1 + 0.12 * springAt(frame, fps, at, { damping: 14, stiffness: 200 });
    if (f.kind === "rewind" && age < REWIND + 6) {
      rewindAge = age;
      dx += Math.sin(age * 1.7) * 9;
    }
  }

  // Multi-panel pages never show an empty slot: the first panel fills the frame, and each new
  // panel slides in while the ones before it shrink into their places on the page.
  const shown = Math.max(1, starts.filter((s) => s <= frame).length);
  const morph = full || shown <= 1 ? 1 : springAt(frame, fps, starts[shown - 1] ?? 0, { damping: 20, stiffness: 140 });
  const shapes = props.panels.map((_, i): Geo | null => {
    if (full) return (sets[1] as Geo[])[0] ?? null;
    const cur = (sets[shown] as Geo[])[i];
    if (!cur) return null;
    if (i < shown - 1) {
      const prev = (sets[shown - 1] as Geo[])[i] as Geo;
      return geo(prev.pts.map((p, j) => [lerp(p[0], cur.pts[j]?.[0] ?? p[0], morph), lerp(p[1], cur.pts[j]?.[1] ?? p[1], morph)] as Pt));
    }
    if (shown <= 1) return cur;
    const off = (1 - morph) * (portrait ? H : W) * 0.6;
    return geo(cur.pts.map(([x, y]) => (portrait ? [x, y + off] : [x + off, y]) as Pt));
  });
  const page = full
    ? ""
    : `translate(${W / 2} ${H / 2}) scale(${1 + 0.025 * clamp01(frame / Math.max(1, ctx.duration))}) translate(${-W / 2} ${-H / 2})`;

  const visible = props.panels.map((_, i) => {
    if (frame < (starts[i] ?? 0)) return false;
    // In a full-frame page each panel replaces the one before it.
    return !full || i === n - 1 || frame < (starts[i + 1] ?? 0) + 14;
  });

  const rewinding = rewindAge >= 0 && rewindAge < REWIND;
  return (
    <AbsoluteFill style={{ background: full ? "#000000" : PAGE }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate(${dx}px, ${dy}px) scale(${punch})`,
          filter: rewinding ? "grayscale(0.8) contrast(1.25)" : undefined,
        }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
          <defs>
            {shapes.map((g, i) =>
              g ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: panel order is the identity
                <clipPath key={i} id={`mp-${ctx.index}-${i}`}>
                  <polygon points={points(g.pts)} />
                </clipPath>
              ) : null,
            )}
          </defs>
          <g transform={page}>
            {props.panels.map((p, i) => {
              const g = shapes[i];
              if (!visible[i] || !g) return null;
              const start = starts[i] ?? 0;
              const end = full ? (starts[i + 1] ?? ctx.duration) : ctx.duration;
              let wrapT = "";
              let opacity = 1;
              if (full && i > 0) {
                // Slides in over the panel before it.
                const k = springAt(frame, fps, start, SLIDE);
                wrapT = `translate(${(1 - k) * W} 0)`;
              } else if (!full && i > 0 && i === shown - 1) {
                opacity = clamp01(morph * 2.5);
              }
              if (full && i < n - 1 && frame >= (starts[i + 1] ?? Infinity)) {
                const k = springAt(frame, fps, starts[i + 1] ?? 0, SLIDE);
                wrapT = `translate(${-k * W * 0.3} 0)`;
              }
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: panel order is the identity
                <g key={i} transform={wrapT} opacity={opacity}>
                  <PanelView panel={p} g={g} id={`mp-${ctx.index}-${i}`} start={start} end={end} full={full} border={!full} t={t} />
                </g>
              );
            })}
          </g>
          {(props.sfx ?? []).map((sf, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: plan order is the identity
            <SfxWord key={i} sf={sf} W={W} H={H} t={t} />
          ))}
          {rewindAge >= 0 && <RewindOverlay age={rewindAge} W={W} H={H} frame={frame} />}
          {fx.map((f, i) => {
            const age = frame - wordFrame(f.at, ctx, ctx.enter);
            if (f.kind !== "flash" || age < 0 || age >= 9) return null;
            // biome-ignore lint/suspicious/noArrayIndexKey: plan order is the identity
            return <rect key={i} width={W} height={H} fill="#FFFFFF" opacity={0.85 * (1 - age / 9)} />;
          })}
        </svg>
      </div>
      {/* The place card sits outside the punch-in and shake, so a zoom never pushes it off screen. */}
      {props.box && (
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ position: "absolute", inset: 0, display: "block" }}>
          <NarrationBox text={props.box.text} at={wordFrame(props.box.at, ctx, ctx.enter)} W={W} H={H} t={t} low={tagged} />
        </svg>
      )}
      {starts.slice(1).map((s, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: panel order is the identity
        <Sfx key={`p-${i}`} at={s} name="whoosh" volume={0.6} />
      ))}
      {/* Sound-effect words and flashes stay silent (user, 16/11/2026: the popup sound was odd). */}
      {fx.map((f, i) =>
        f.kind === "rewind" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: plan order is the identity
          <Sfx key={`f-${i}`} at={wordFrame(f.at, ctx)} name="whoosh" volume={0.8} />
        ) : null,
      )}
    </AbsoluteFill>
  );
};
