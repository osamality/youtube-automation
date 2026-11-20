import { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { type Act, type Face, FLOOR, SCENE_H, SCENE_W } from "../../paper";
import type { ArtSource, SketchActor, SketchProp, SketchProps } from "../../schema";
import { BOUNCY, clamp01, POP, type SceneCtx, SMOOTH, springAt } from "../anim";
import { handFont } from "../fonts";
import { useLayout } from "../layout";
import { ART_H, shotsFor, type View, viewAt } from "../paper/camera";
import { Figure } from "../paper/Figure";
import { Hand, hash, INK, STROKE, wordFrame, wrap } from "../paper/ink";
import { HEALTH_STILL } from "../paper/HealthProps";
import { PropArt } from "../paper/Props";
import { SET_ART } from "../paper/Sets";
import { Sfx } from "../Sfx";
import { useStage } from "../stage";

const FIGURE_SCALE = 1.3;
const WALK_SPEED = 13;
/** Written words and numbers sit above the lighting, so they stay bright in dark scenes. */
const LIT: ReadonlySet<string> = new Set(["text", "number", "arrow", "banner", "tag"]);
/** Furniture and buildings stand still; everything else floats a little so the picture never freezes. */
const STILL: ReadonlySet<string> = new Set([
  ...HEALTH_STILL,
  "desk",
  "chair",
  "podium",
  "door",
  "building",
  "datacenter",
  "server",
  "vault",
  "screen",
  "chart",
  "bars",
  "pie",
  "laptop",
  "crate",
  "scale",
  "bell",
  "truck",
  "plant",
  "crowd",
  "tokens",
  "vector",
  "space",
  "attention",
  "layers",
  "probs",
  "net",
  "chatbox",
  "books",
  "dial",
]);
const SETTLE = { damping: 11, stiffness: 190, mass: 0.6 };
/** Width of a "picture" prop at scale 1. */
const PICTURE_W = 300;

/** Feet height of a scene, in scene units. */
export const floorOf = (props: SketchProps) =>
  props.floor === undefined ? FLOOR[props.set] : (props.floor / 100) * SCENE_H;

/** Every illustration a scene draws, so the frame waits for them. */
function artIn(props: SketchProps): string[] {
  const ids = [
    props.backdrop,
    ...(props.actors ?? []).flatMap((a) => [a.art, ...(a.beats ?? []).map((b) => b.art)]),
    ...(props.props ?? []).map((p) => p.art),
  ];
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

/** Holds the render until the scene's illustrations are loaded. */
export function useArtLoaded(urls: string[]): void {
  const key = urls.join("|");
  const [handle] = useState(() => (urls.length ? delayRender(`sketch art ${key.slice(0, 60)}`) : null));
  // biome-ignore lint/correctness/useExhaustiveDependencies: the key stands for the list
  useEffect(() => {
    if (handle === null) return;
    let left = urls.length;
    const done = () => {
      left -= 1;
      if (left === 0) continueRender(handle);
    };
    for (const u of urls) {
      const im = new Image();
      im.onload = done;
      im.onerror = done;
      im.src = u;
    }
  }, [key, handle]);
}

/** A cut-out illustration standing on the origin: `h` tall, centred, cropped to its subject. */
const CutOut: React.FC<{ art: ArtSource; h: number }> = ({ art, h }) => {
  const b = art.box ?? { x: 0, y: 0, w: 1, h: 1 };
  const bw = b.w * art.width;
  const bh = b.h * art.height;
  const w = (h * bw) / bh;
  return (
    <svg x={-w / 2} y={-h} width={w} height={h} viewBox={`${b.x * art.width} ${b.y * art.height} ${bw} ${bh}`} preserveAspectRatio="xMidYMax meet" overflow="hidden">
      <image href={staticFile(art.file)} width={art.width} height={art.height} />
    </svg>
  );
};

/** A ctx for drawing a scene with nothing spoken (thumbnails): everything is already in place. */
export const STILL_CTX: SceneCtx = {
  index: 0,
  duration: 1,
  enter: 0,
  voiceStart: 0,
  voiceFrames: 1,
  envelope: [],
  words: [],
};
const STILL_FRAME = 100_000;

interface ActorNow {
  x: number;
  y: number;
  flip: boolean;
  walk: number;
  shown: number;
  drop: number;
  grow: number;
  face: Face;
  act: Act;
  prevAct: Act;
  blend: number;
}

function actorAt(a: SketchActor, i: number, ctx: SceneCtx, frame: number, fps: number, floor: number): ActorNow {
  const homeX = (a.x / 100) * SCENE_W;
  const y = a.y === undefined ? floor : (a.y / 100) * SCENE_H;
  const start = wordFrame(a.at, ctx, ctx.enter - 8);
  const enter = a.enter ?? (a.at ? "walk" : "none");
  let x = homeX;
  let walk = 0;
  let facing: 1 | -1 | 0 = 0;
  let shown = 1;
  let drop = 0;
  let grow = 1;

  if (enter === "walk") {
    const fromX = homeX < SCENE_W / 2 ? -180 : SCENE_W + 180;
    const length = Math.max(14, Math.min(40, Math.abs(homeX - fromX) / (WALK_SPEED * 1.9)));
    const t = clamp01((frame - start) / length);
    x = fromX + (homeX - fromX) * t;
    if (t > 0 && t < 1) {
      walk = Math.min(1, t * 6, (1 - t) * 6);
      facing = homeX > fromX ? 1 : -1;
    }
    if (frame < start) shown = 0;
  } else if (enter === "pop") {
    shown = springAt(frame, fps, start, POP);
  } else if (enter === "drop") {
    const s = springAt(frame, fps, start, BOUNCY);
    shown = clamp01(s * 3);
    drop = (1 - s) * -700;
  } else {
    // Already there, but it settles into place as the scene opens, one figure after another.
    grow = 0.82 + 0.18 * springAt(frame, fps, ctx.enter - 8 + i * 3, SETTLE);
  }

  if (a.to) {
    const toX = (a.to.x / 100) * SCENE_W;
    const go = wordFrame(a.to.at, ctx, ctx.voiceStart + ctx.voiceFrames * 0.5);
    const length = Math.max(16, Math.abs(toX - homeX) / (WALK_SPEED * 1.3));
    const t = clamp01((frame - go) / length);
    if (t > 0) {
      x = homeX + (toX - homeX) * t;
      if (t < 1) {
        walk = Math.min(1, t * 6, (1 - t) * 6);
        facing = toX > homeX ? 1 : -1;
      }
    }
  }

  // Face and pose: the starting ones, then each beat from its word on.
  const states: { frame: number; face: Face; act: Act }[] = [
    { frame: -1000, face: a.face ?? "neutral", act: a.act ?? "stand" },
  ];
  for (const b of a.beats ?? []) {
    const last = states[states.length - 1] as { face: Face; act: Act };
    states.push({ frame: wordFrame(b.at, ctx, ctx.voiceStart), face: b.face ?? last.face, act: b.act ?? last.act });
  }
  let k = 0;
  for (let n = 0; n < states.length; n++) if ((states[n]?.frame ?? 0) <= frame) k = n;
  const now = states[k] as { frame: number; face: Face; act: Act };
  const before = states[Math.max(0, k - 1)] as { act: Act };

  const flip = facing !== 0 ? facing < 0 : (a.flip ?? x > SCENE_W / 2);
  return {
    x,
    y,
    flip,
    walk,
    shown,
    drop,
    grow,
    face: now.face,
    act: now.act,
    prevAct: before.act,
    blend: k === 0 ? 1 : springAt(frame, fps, now.frame, SMOOTH),
  };
}

const Bubble: React.FC<{ text: string; think?: boolean; x: number; y: number; s: number; min: number; max: number }> = ({
  text,
  think,
  x,
  y,
  s,
  min,
  max,
}) => {
  const rows = wrap(text, 20).slice(0, 4);
  const size = 46;
  const w = Math.max(...rows.map((r) => r.length), 5) * size * 0.52 + 70;
  const h = rows.length * size * 1.08 + 50;
  const cx = Math.min(max - w / 2 - 24, Math.max(min + w / 2 + 24, x));
  const tail = Math.max(-w / 2 + 50, Math.min(w / 2 - 50, x - cx));
  return (
    <g transform={`translate(${cx} ${Math.max(h + 50, y)}) scale(${0.3 + 0.7 * s})`} opacity={clamp01(s * 2.5)}>
      {think ? (
        <g fill="#FFFFFF" stroke={INK} strokeWidth={STROKE}>
          <circle cx={tail} cy={8} r={10} />
          <circle cx={tail * 0.8} cy={-16} r={15} />
        </g>
      ) : (
        <path d={`M ${tail - 22} -34 L ${tail} 14 L ${tail + 22} -34 Z`} fill="#FFFFFF" stroke={INK} strokeWidth={STROKE} strokeLinejoin="round" />
      )}
      <rect x={-w / 2} y={-30 - h} width={w} height={h} rx={think ? h / 2 : 26} fill="#FFFFFF" stroke={INK} strokeWidth={STROKE} />
      {!think && <rect x={tail - 20} y={-37} width={40} height={10} fill="#FFFFFF" />}
      <Hand y={-30 - h / 2} size={size} lines={rows} />
    </g>
  );
};

const PropView: React.FC<{ p: SketchProp; i: number; ctx: SceneCtx; frame: number; fps: number; floor: number }> = ({
  p,
  i,
  ctx,
  frame,
  fps,
  floor,
}) => {
  const { art } = useStage();
  const picture = p.kind === "picture" && p.art ? art[p.art] : undefined;
  const start = wordFrame(p.at, ctx, ctx.enter - 8);
  const end = p.until ? wordFrame(p.until, ctx, Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
  const enter = p.enter ?? (p.at ? "pop" : "none");
  const x = (p.x / 100) * SCENE_W;
  const y = p.y === undefined ? floor : (p.y / 100) * SCENE_H;
  const out = Number.isFinite(end) ? clamp01((frame - end) / 8) : 0;
  if (frame < start && enter !== "none") return null;
  if (out >= 1) return null;
  let scale = p.scale ?? 1;
  let dx = 0;
  let dy = 0;
  let opacity = 1 - out;
  if (enter === "pop") {
    const s = springAt(frame, fps, start, POP);
    scale *= 0.2 + 0.8 * s;
    opacity *= clamp01(s * 3);
  } else if (enter === "drop") {
    const s = springAt(frame, fps, start, BOUNCY);
    dy = (1 - s) * -800;
  } else if (enter === "slide") {
    const s = springAt(frame, fps, start, SMOOTH);
    dx = (1 - s) * (x < SCENE_W / 2 ? -1 : 1) * 900;
  } else if (enter === "fade") {
    opacity *= clamp01((frame - start) / 14);
  } else {
    scale *= 0.86 + 0.14 * springAt(frame, fps, ctx.enter - 6 + i * 3, SETTLE);
  }
  // A slow float, and a little wobble for written words, so nothing sits dead on screen.
  const live = !STILL.has(p.kind);
  const bob = live ? Math.sin((frame + i * 41) / 17) * 5 : 0;
  const sway = live ? Math.sin((frame + i * 23) / 29) * (LIT.has(p.kind) ? 1.6 : 0.9) : 0;
  return (
    <g
      transform={`translate(${x + dx} ${y + dy + bob}) rotate(${(p.rot ?? 0) + sway}) scale(${p.flip ? -scale : scale} ${scale})`}
      opacity={opacity}
    >
      {picture ? (
        <CutOut art={picture} h={(PICTURE_W * (picture.box?.h ?? 1) * picture.height) / ((picture.box?.w ?? 1) * picture.width)} />
      ) : (
        <PropArt p={p} frame={frame} age={Math.max(0, frame - start)} />
      )}
    </g>
  );
};

/** Bills or confetti falling through the picture from a spoken word on. */
const Fall: React.FC<{ kind: "rain" | "confetti"; age: number; x0: number; w: number }> = ({ kind, age, x0, w }) => {
  if (age < 0) return null;
  const n = kind === "rain" ? 26 : 70;
  const colours = ["#F0513E", "#FFD23F", "#39C46A", "#3D6BB3", "#FFFFFF", "#F4A6B8"];
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const speed = (kind === "rain" ? 14 : 10) + hash(i) * 9;
        // Each piece starts above the frame at its own moment, then loops.
        const travelled = age * speed - hash(i + 7) * 900;
        if (travelled < 0) return null;
        const y = (travelled % 1400) - 160;
        const x = x0 + hash(i * 3.3 + 1) * w + Math.sin((age + i * 9) / 11) * 26;
        const spin = (age * (4 + hash(i + 2) * 8) + i * 50) % 360;
        return kind === "rain" ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed particles
          <g key={i} transform={`translate(${x} ${y}) rotate(${Math.sin(spin / 57) * 35})`}>
            <rect x={-46} y={-22} width={92} height={44} rx={4} fill="#8FCB8A" stroke={INK} strokeWidth={3} />
            <circle r={11} fill="#CFEFC4" stroke={INK} strokeWidth={2} />
          </g>
        ) : (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed particles
          <rect key={i} x={x} y={y} width={18} height={10} fill={colours[i % colours.length]} transform={`rotate(${spin} ${x} ${y})`} />
        );
      })}
    </g>
  );
};

/** The picture itself, as an SVG that fills its parent. `view` shows only part of the scene's width. */
export const SketchArt: React.FC<{
  props: SketchProps;
  ctx: SceneCtx;
  frame: number;
  fps: number;
  hideTitle?: boolean;
  view?: View;
}> = ({ props, ctx, frame, fps, hideTitle, view }) => {
  const { cast, art: pictures } = useStage();
  const art = SET_ART[props.set];
  const floor = floorOf(props);
  const backdrop = props.backdrop ? pictures[props.backdrop] : undefined;
  useArtLoaded(artIn(props).flatMap((id) => (pictures[id] ? [staticFile(pictures[id].file)] : [])));
  const light = props.light ?? (!backdrop && (props.set === "city" || props.set === "boardroom") ? "dim" : "day");
  const actors = (props.actors ?? []).map((a, i) => ({ a, i, now: actorAt(a, i, ctx, frame, fps, floor) }));
  const sorted = [...actors].sort((p, q) => p.now.y - q.now.y);
  const items = props.props ?? [];
  const setProps = { frame, screen: props.screen, trend: props.trend, light };
  const x0 = view?.x ?? 0;
  const vw = view?.w ?? SCENE_W;
  const y0 = view?.y ?? 0;
  const vh = view?.h ?? SCENE_H;
  // Words fixed to the screen keep their size while the camera zooms.
  const k = vh / SCENE_H;
  const spotX = actors[0] ? actors[0].now.x / SCENE_W : 0.5;
  const title = props.title;
  const titleAt = title ? wordFrame(title.at, ctx, ctx.enter) : 0;
  const titleS = title ? springAt(frame, fps, titleAt, POP) : 0;
  const id = `light-${ctx.index}`;
  const fx = props.fx ?? [];

  return (
    <svg viewBox={`${x0} ${y0} ${vw} ${vh}`} width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{ display: "block" }}>
      <defs>
        <radialGradient id={id} cx={light === "spot" ? 0.5 + (spotX - 0.5) * 0.25 : 0.5} cy={light === "spot" ? 0.58 : 0.52} r={light === "spot" ? 0.66 : 0.78}>
          <stop offset={light === "spot" ? 0.5 : 0.45} stopColor="#0A0A18" stopOpacity={light === "night" ? 0.38 : 0} />
          <stop
            offset={1}
            stopColor={light === "day" ? "#3A2412" : "#06060F"}
            stopOpacity={light === "day" ? 0.26 : light === "dim" ? 0.62 : light === "night" ? 0.7 : 0.86}
          />
        </radialGradient>
      </defs>
      {backdrop ? (
        // Painted background, a little oversized and trailing the camera, so figures move against it.
        <image
          href={staticFile(backdrop.file)}
          x={-0.03 * SCENE_W + (x0 + vw / 2 - SCENE_W / 2) * 0.09}
          y={-0.03 * SCENE_H + (y0 + vh / 2 - SCENE_H / 2) * 0.09}
          width={SCENE_W * 1.06}
          height={SCENE_H * 1.06}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <art.Back {...setProps} />
      )}
      {items.map((p, i) =>
        p.front || LIT.has(p.kind) ? null : (
          // biome-ignore lint/suspicious/noArrayIndexKey: plan order is the identity
          <PropView key={i} p={p} i={i} ctx={ctx} frame={frame} fps={fps} floor={floor} />
        ),
      )}
      {sorted.map(({ a, i, now }) => {
        if (now.shown <= 0.01) return null;
        const scale = FIGURE_SCALE * (a.scale ?? 1) * now.grow * (0.6 + 0.4 * Math.min(1, now.shown));
        const look = cast[a.who] ?? Object.values(cast)[0];
        if (!look) return null;
        const talking = a.talking ? (ctx.envelope[Math.round(frame - ctx.voiceStart)] ?? 0) : 0;
        const lean = Math.sin((frame + i * 37) / 26) * 1.4 + talking * 2.5 * Math.sin(frame / 4);
        // Illustrated cut-out: the pose is a picture, swapped on beats; it breathes, bobs and hops as it walks.
        let pose = a.art;
        let poseAt = -1000;
        for (const b of a.beats ?? []) {
          const f = wordFrame(b.at, ctx, ctx.voiceStart);
          if (b.art && f <= frame) {
            pose = b.art;
            poseAt = f;
          }
        }
        const cut = pose ? pictures[pose] : undefined;
        if (cut) {
          const s = (a.scale ?? 1) * now.grow * (0.6 + 0.4 * Math.min(1, now.shown));
          const swap = 1 - springAt(frame, fps, poseAt, POP);
          const breathe = 1 + Math.sin((frame + i * 31) / 15) * 0.012;
          const hop = Math.abs(Math.sin(frame / 4)) * 16 * now.walk + talking * 7 * Math.abs(Math.sin(frame / 3.2));
          const tilt = Math.sin((frame + i * 37) / 30) * 0.7 + Math.sin(frame / 4) * 3 * now.walk;
          return (
            <g key={`${a.who}-${i}`} opacity={clamp01(now.shown * 2)}>
              <ellipse cx={now.x} cy={now.y + 4} rx={120 * s} ry={20 * s} fill="#000000" opacity={0.22} />
              <g transform={`translate(${now.x} ${now.y + now.drop - hop}) rotate(${tilt}) scale(${(a.flip ? -1 : 1) * s * (1 + swap * 0.07)} ${s * breathe * (1 - swap * 0.05)})`}>
                <CutOut art={cut} h={ART_H} />
              </g>
              {a.tag && now.walk < 0.05 && (
                <g transform={`translate(${now.x} ${now.y + 46})`}>
                  <rect x={-(a.tag.length * 17 + 28) / 2} y={-24} width={a.tag.length * 17 + 28} height={48} rx={8} fill="#FBF6E9" stroke={INK} strokeWidth={3} transform="rotate(-2)" />
                  <Hand size={32} rotate={-2}>
                    {a.tag}
                  </Hand>
                </g>
              )}
            </g>
          );
        }
        return (
          <g key={`${a.who}-${i}`} opacity={clamp01(now.shown * 2)}>
            <g transform={`translate(${now.x} ${now.y + now.drop}) rotate(${lean}) scale(${(now.flip ? -1 : 1) * scale} ${scale})`}>
              <Figure look={look} frame={frame} loud={talking} face={now.face} act={now.act} prevAct={now.prevAct} blend={now.blend} hat={a.hat} walk={now.walk} seed={i} />
            </g>
            {a.tag && now.walk < 0.05 && (
              <g transform={`translate(${now.x} ${now.y + 46})`}>
                <rect x={-(a.tag.length * 17 + 28) / 2} y={-24} width={a.tag.length * 17 + 28} height={48} rx={8} fill="#FBF6E9" stroke={INK} strokeWidth={3} transform="rotate(-2)" />
                <Hand size={32} rotate={-2}>
                  {a.tag}
                </Hand>
              </g>
            )}
          </g>
        );
      })}
      {items.map((p, i) =>
        p.front && !LIT.has(p.kind) ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: plan order is the identity
          <PropView key={i} p={p} i={i} ctx={ctx} frame={frame} fps={fps} floor={floor} />
        ) : null,
      )}
      {!backdrop && art.Front && <art.Front {...setProps} />}
      <rect x={x0} y={y0} width={vw} height={vh} fill={`url(#${id})`} />
      {items.map((p, i) =>
        LIT.has(p.kind) ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: plan order is the identity
          <PropView key={i} p={p} i={i} ctx={ctx} frame={frame} fps={fps} floor={floor} />
        ) : null,
      )}
      {fx.map((f, i) => {
        const age = frame - wordFrame(f.at, ctx, ctx.enter);
        if (f.kind === "rain" || f.kind === "confetti")
          // biome-ignore lint/suspicious/noArrayIndexKey: plan order is the identity
          return <Fall key={i} kind={f.kind} age={age} x0={x0} w={vw} />;
        if (f.kind === "flash" && age >= 0 && age < 9)
          // biome-ignore lint/suspicious/noArrayIndexKey: plan order is the identity
          return <rect key={i} x={x0} y={y0} width={vw} height={vh} fill="#FFFFFF" opacity={0.8 * (1 - age / 9)} />;
        return null;
      })}
      {actors.map(({ a, i, now }) => {
        if (!a.say || now.shown <= 0.5) return null;
        const at = wordFrame(a.sayAt ?? a.at, ctx, ctx.enter + 6);
        const s = springAt(frame, fps, at, POP);
        if (s <= 0.01) return null;
        const scale = FIGURE_SCALE * (a.scale ?? 1);
        const top = a.art ? ART_H * (a.scale ?? 1) + 30 : 330 * scale;
        return <Bubble key={`say-${i}`} text={a.say} think={a.think} x={now.x} y={now.y - top} s={s} min={x0} max={x0 + vw} />;
      })}
      {title && !hideTitle && titleS > 0.01 && (
        <g transform={`translate(${x0 + vw / 2} ${y0 + 150 * k}) scale(${k * (0.6 + 0.4 * titleS)})`} opacity={clamp01(titleS * 2)}>
          <text
            fontSize={Math.min(150, (vw / k - 220) / ((title.text.length + (title.text2?.length ?? 0) + 1) * 0.56))}
            fontWeight={700}
            textAnchor="middle"
            dominantBaseline="central"
            stroke={INK}
            strokeWidth={22}
            strokeLinejoin="round"
            paintOrder="stroke"
            style={{ fontFamily: "inherit" }}
          >
            <tspan fill="#FFFFFF">{title.text}</tspan>
            {title.text2 && <tspan fill="#FF4B36">{` ${title.text2}`}</tspan>}
          </text>
        </g>
      )}
    </svg>
  );
};

/** Share of a portrait frame's height the picture takes, and where it starts. */
const BAND = { top: 0.2, height: 0.5 };

/**
 * One beat of the story as a cartoon. Landscape: the full frame. Portrait (Shorts): a tall band
 * showing the middle of the scene, with the scene's title written above it and captions below.
 */
export const Sketch: React.FC<{ props: SketchProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, width, height, u } = useLayout();
  const pops = (props.props ?? []).filter((p) => p.at).slice(0, 3);
  const fx = props.fx ?? [];

  // Hits: a shake that dies out, and a punch-in that stays.
  let dx = 0;
  let dy = 0;
  let punch = 1;
  for (const f of fx) {
    const start = wordFrame(f.at, ctx, ctx.enter);
    const age = frame - start;
    if (age < 0) continue;
    if (f.kind === "shake") {
      const decay = Math.max(0, 1 - age / 16);
      dx += Math.sin(age * 2.3) * 2.2 * u * decay;
      dy += Math.cos(age * 2.9) * 1.5 * u * decay;
    }
    if (f.kind === "zoom") punch *= 1 + 0.16 * springAt(frame, fps, start, { damping: 14, stiffness: 200 });
  }
  const hit = `translate(${dx}px, ${dy}px) scale(${punch})`;

  // The camera: a new shot every second or two, cut from what is in the scene.
  const shots = useMemo(() => shotsFor(props, ctx, floorOf(props)), [props, ctx]);
  let box: React.CSSProperties = { position: "absolute", inset: 0, transform: hit };
  let w0 = SCENE_W;
  if (portrait) {
    const bandH = height * BAND.height;
    w0 = SCENE_H * (width / bandH);
    box = { position: "absolute", left: 0, top: height * BAND.top, width, height: bandH, overflow: "hidden", transform: hit };
  }
  const view = viewAt(shots, frame, fps, w0, SCENE_H);
  const title = props.title;
  // In Shorts the headline stays put from scene to scene; it only pops in at the very start.
  const titleS = !title ? 0 : portrait && ctx.index > 0 ? 1 : springAt(frame, fps, wordFrame(title.at, ctx, ctx.enter), POP);
  const titleLen = title ? title.text.length + (title.text2?.length ?? 0) + 1 : 1;

  return (
    <AbsoluteFill style={{ background: "#0B0B0E", fontFamily: handFont() }}>
      <div style={box}>
        <SketchArt props={props} ctx={ctx} frame={frame} fps={fps} view={view} hideTitle={portrait} />
      </div>
      {portrait && title && (
        <div
          style={{
            position: "absolute",
            left: 0,
            width,
            top: height * 0.105,
            height: height * (BAND.top - 0.11),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontSize: Math.min(11 * u, (width * 0.92) / (titleLen * 0.5)),
            fontWeight: 700,
            lineHeight: 1,
            color: "#FFFFFF",
            whiteSpace: "nowrap",
            transform: `scale(${0.7 + 0.3 * titleS}) rotate(-1.5deg)`,
            opacity: clamp01(titleS * 2),
          }}
        >
          <span>
            {title.text}
            {title.text2 && <span style={{ color: "#FF4B36" }}>{` ${title.text2}`}</span>}
          </span>
        </div>
      )}
      {pops.map((p, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: plan order is the identity
        <Sfx key={i} at={wordFrame(p.at, ctx)} name={p.kind === "bell" ? "ding" : p.kind === "bomb" || p.kind === "bolt" ? "boom" : "pop"} volume={0.7} />
      ))}
      {fx.map((f, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: plan order is the identity
        <Sfx key={`fx-${i}`} at={wordFrame(f.at, ctx)} name={f.kind === "shake" || f.kind === "zoom" ? "boom" : f.kind === "flash" ? "ding" : "sparkle"} volume={0.8} />
      ))}
    </AbsoluteFill>
  );
};

/** A sketch with everything in place, for thumbnails. */
export const SketchStill: React.FC<{ props: SketchProps; hideTitle?: boolean }> = ({ props, hideTitle }) => (
  <div style={{ position: "absolute", inset: 0, fontFamily: handFont() }}>
    <SketchArt props={props} ctx={STILL_CTX} frame={STILL_FRAME} fps={30} hideTitle={hideTitle} />
  </div>
);
