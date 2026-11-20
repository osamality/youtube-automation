import type { CSSProperties } from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CharacterRef, PhotoData } from "../schema";
import { Character, characterStates } from "./Character";
import { clamp01, type SceneCtx, springAt } from "./anim";
import { impactFont } from "./fonts";
import { useLayout } from "./layout";
import { Sfx } from "./Sfx";
import { alpha } from "./theme";

/** The point of a photo to keep in view: the plan's focus, else the biggest face, else the person. */
export function focusOf(p: PhotoData): { x: number; y: number } {
  if (p.focus) return p.focus;
  if (p.face) return { x: p.face.x + p.face.w / 2, y: p.face.y + p.face.h / 2 };
  if (p.subject) return { x: p.subject.x + p.subject.w / 2, y: p.subject.y + p.subject.h * 0.3 };
  return { x: 0.5, y: 0.4 };
}

/**
 * A photo covering a width × height box. `zoom` enlarges it; `pull` (0–1) moves the view from the
 * photo's centre towards its focus, which lands at `target` (fractions of the box) where the edges allow.
 */
export const PhotoFill: React.FC<{
  photo: PhotoData | null;
  width: number;
  height: number;
  zoom?: number;
  pull?: number;
  target?: { x: number; y: number };
  filter?: string;
  style?: CSSProperties;
}> = ({ photo, width, height, zoom = 1, pull = 1, target, filter, style }) => {
  const box: CSSProperties = { position: "relative", width, height, overflow: "hidden", flex: "none", ...style };
  if (!photo) return <div style={{ ...box, background: "#C9CED8" }} />;
  const scale = Math.max(width / photo.width, height / photo.height) * zoom;
  const w = photo.width * scale;
  const h = photo.height * scale;
  const f = focusOf(photo);
  const fx = 0.5 + (f.x - 0.5) * pull;
  const fy = 0.5 + (f.y - 0.5) * pull;
  const left = Math.min(0, Math.max(width - w, width * (target?.x ?? 0.5) - fx * w));
  const top = Math.min(0, Math.max(height - h, height * (target?.y ?? 0.42) - fy * h));
  return (
    <div style={box}>
      <Img
        src={staticFile(photo.file)}
        style={{ position: "absolute", left, top, width: w, height: h, maxWidth: "none", filter }}
      />
    </div>
  );
};

/**
 * A person cut out of their photo, sized so the face is `faceWidth` of the box wide, with the face
 * centre at `faceY` of its height. Fades out at the bottom. Without a cut-out, a face crop is shown.
 */
export const Cutout: React.FC<{
  photo: PhotoData | null;
  width: number;
  height: number;
  faceWidth?: number;
  faceY?: number;
  style?: CSSProperties;
  filter?: string;
}> = ({ photo, width, height, faceWidth = 0.42, faceY = 0.38, style, filter }) => {
  if (!photo?.cut || !photo.face) {
    return <PhotoFill photo={photo} width={width} height={height} zoom={1.1} style={style} filter={filter} />;
  }
  const scale = (faceWidth * width) / (photo.face.w * photo.width);
  const w = photo.width * scale;
  const h = photo.height * scale;
  const cx = (photo.face.x + photo.face.w / 2) * w;
  const cy = (photo.face.y + photo.face.h / 2) * h;
  // Never leave a gap under a person whose photo ends at the chest: fade the bottom edge out instead.
  const bottom = height * faceY - cy + h;
  const fadeFrom = Math.min(1, bottom / height) * 100;
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        overflow: "hidden",
        flex: "none",
        maskImage: `linear-gradient(to bottom, black ${Math.max(0, fadeFrom - 14)}%, transparent ${fadeFrom}%)`,
        WebkitMaskImage: `linear-gradient(to bottom, black ${Math.max(0, fadeFrom - 14)}%, transparent ${fadeFrom}%)`,
        ...style,
      }}
    >
      <Img
        src={staticFile(photo.cut)}
        style={{
          position: "absolute",
          left: width / 2 - cx,
          top: height * faceY - cy,
          width: w,
          height: h,
          maxWidth: "none",
          filter,
        }}
      />
    </div>
  );
};

/** A red rubber stamp that slams onto the scene at frame `at`. */
export const Stamp: React.FC<{ text: string; at: number; size: number; rotate?: number; color?: string }> = ({
  text,
  at,
  size,
  rotate = -10,
  color = "#D9262C",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = springAt(frame, fps, at, { damping: 13, stiffness: 260, mass: 0.7 });
  if (frame < at) return null;
  return (
    <div
      style={{
        display: "inline-block",
        padding: `${size * 0.12}px ${size * 0.32}px`,
        border: `${size * 0.09}px solid ${color}`,
        borderRadius: size * 0.12,
        color,
        fontFamily: impactFont(),
        fontSize: size,
        lineHeight: 1.05,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        background: alpha("#FFFFFF", 0.82),
        transform: `rotate(${rotate}deg) scale(${2.2 - 1.2 * p})`,
        opacity: clamp01(p * 2),
        boxShadow: `0 ${size * 0.06}px ${size * 0.3}px ${alpha("#000000", 0.25)}`,
      }}
    >
      {text}
      <Sfx at={at} name="boom" volume={0.7} />
    </div>
  );
};

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The frame at which the narration reaches `phrase` (its first two words in a row), or `fallback`. */
export function phraseTime(phrase: string, ctx: SceneCtx, fallback: number): number {
  const want = phrase.split(/\s+/).map(norm).filter(Boolean);
  const words = ctx.words.map((w) => norm(w.text));
  if (!want.length) return fallback;
  for (let i = 0; i < words.length; i++) {
    if (words[i] === want[0] && (want.length < 2 || words[i + 1] === want[1])) {
      return Math.max(ctx.enter + 4, ctx.words[i]?.start ?? fallback);
    }
  }
  for (let i = 0; i < words.length; i++) {
    if (words[i] === want[0]) return Math.max(ctx.enter + 4, ctx.words[i]?.start ?? fallback);
  }
  return fallback;
}

/**
 * Text with one passage marked by a highlighter that sweeps across it (line after line) from frame
 * `at`. The passage must appear in `text` exactly; otherwise the text is shown plain.
 */
export const Highlighted: React.FC<{
  text: string;
  passage?: string;
  at: number;
  color?: string;
}> = ({ text, passage, at, color = "#FFE14D" }) => {
  const frame = useCurrentFrame();
  const i = passage ? text.indexOf(passage) : -1;
  if (!passage || i < 0) return <>{text}</>;
  const words = passage.split(/\s+/).length;
  const length = Math.min(45, Math.max(12, words * 3));
  const p = clamp01((frame - at) / length);
  return (
    <>
      {text.slice(0, i)}
      <span
        style={{
          backgroundImage: `linear-gradient(${color}, ${color})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${p * 100}% 100%`,
          padding: "0 0.08em",
          margin: "0 -0.08em",
        }}
      >
        {passage}
      </span>
      {text.slice(i + passage.length)}
      <Sfx at={at} name="click" volume={0.6} />
    </>
  );
};

/** A white strip with a person's name and role, sliding in from the left. */
export const NameTag: React.FC<{ name: string; role?: string; at: number; accent: string; size?: number }> = ({
  name,
  role,
  at,
  accent,
  size,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const s = size ?? 4.2 * u;
  const a = springAt(frame, fps, at, { damping: 200 });
  const b = springAt(frame, fps, at + 5, { damping: 200 });
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0.5 * u }}>
      <div
        style={{
          background: accent,
          color: "#FFFFFF",
          fontWeight: 900,
          fontSize: s,
          lineHeight: 1.1,
          padding: `${0.5 * s * 0.5}px ${s * 0.45}px`,
          textTransform: "uppercase",
          letterSpacing: "0.01em",
          clipPath: `inset(0 ${(1 - a) * 100}% 0 0)`,
          boxShadow: `0 ${0.4 * u}px ${1.4 * u}px ${alpha("#000000", 0.25)}`,
        }}
      >
        {name}
      </div>
      {role && (
        <div
          style={{
            background: "#FFFFFF",
            color: "#14182B",
            fontWeight: 700,
            fontSize: s * 0.58,
            padding: `${s * 0.18}px ${s * 0.45}px`,
            clipPath: `inset(0 ${(1 - b) * 100}% 0 0)`,
            boxShadow: `0 ${0.4 * u}px ${1.4 * u}px ${alpha("#000000", 0.2)}`,
          }}
        >
          {role}
        </div>
      )}
    </div>
  );
};

/** A cartoon cast member shown head-and-shoulders inside a box: the drawn stand-in for a portrait photo. */
export const CartoonBust: React.FC<{
  character: CharacterRef;
  width: number;
  height: number;
  background: string;
  /** Pose and mood changes at scene-local frames. */
  beats?: { at: number; pose?: CharacterRef["pose"]; mood?: CharacterRef["mood"] }[];
}> = ({ character, width, height, background, beats = [] }) => {
  // The head spans about 17–51% of the character's height: size it to fill ~60% of the box, from 12% down.
  const charH = height * 1.76;
  const charW = (charH * 200) / 280;
  return (
    <div style={{ position: "relative", width, height, overflow: "hidden", background, flex: "none" }}>
      <div style={{ position: "absolute", left: width / 2 - charW / 2, top: height * 0.12 - charH * 0.17 }}>
        <Character
          who={character.who}
          height={charH}
          states={characterStates({ pose: character.pose ?? "idle", mood: character.mood ?? "neutral" }, beats)}
        />
      </div>
    </div>
  );
};
