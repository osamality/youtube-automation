import type { Tone } from "../../paper";
import type { SceneCtx } from "../anim";
import { handFont } from "../fonts";

/** Outline colour of everything drawn. */
export const INK = "#211C18";
export const PAPER = "#F1E9D8";
export const STROKE = 4;

export const TONE: Record<Tone, { fill: string; text: string; line: string }> = {
  neutral: { fill: "#FBF6E9", text: INK, line: "#3D6BB3" },
  positive: { fill: "#CFEFC4", text: "#14532D", line: "#2FA84F" },
  negative: { fill: "#FAD4CC", text: "#8A1C12", line: "#E0402F" },
  accent: { fill: "#FFD84A", text: INK, line: "#F2A20C" },
  dark: { fill: "#2B2A33", text: "#FFFFFF", line: "#8E8CA3" },
};

export const tone = (t?: Tone) => TONE[t ?? "neutral"];

/** Breaks text into lines of about `max` characters. */
export function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && line.length + word.length + 1 > max) {
      lines.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

/** Font size that fits `text` on one line of `width`. Hand lettering is about 0.52 em per character. */
export function fit(text: string, width: number, max: number, min = 14): number {
  return Math.max(min, Math.min(max, width / (Math.max(1, text.length) * 0.52)));
}

/** Hand-written SVG text, centred on (x, y) by default. Several lines stack around y. */
export const Hand: React.FC<{
  x?: number;
  y?: number;
  size: number;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  rotate?: number;
  lines?: string[];
  children?: string;
  outline?: string;
  outlineWidth?: number;
  weight?: number;
  opacity?: number;
}> = ({
  x = 0,
  y = 0,
  size,
  fill = INK,
  anchor = "middle",
  rotate = 0,
  lines,
  children,
  outline,
  outlineWidth,
  weight = 700,
  opacity,
}) => {
  const rows = lines ?? [children ?? ""];
  const lead = size * 1.08;
  const top = y - ((rows.length - 1) * lead) / 2;
  return (
    <text
      transform={rotate ? `rotate(${rotate} ${x} ${y})` : undefined}
      fontFamily={handFont()}
      fontSize={size}
      fontWeight={weight}
      fill={fill}
      textAnchor={anchor}
      dominantBaseline="central"
      stroke={outline}
      strokeWidth={outline ? (outlineWidth ?? size * 0.16) : undefined}
      strokeLinejoin="round"
      paintOrder="stroke"
      opacity={opacity}
    >
      {rows.map((row, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: lines can repeat
        <tspan key={i} x={x} y={top + i * lead}>
          {row}
        </tspan>
      ))}
    </text>
  );
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The frame (local to the scene) when `at` is spoken: the first narration word that starts with
 * the first word of `at`. Without `at`, or when it is never said, the scene's entrance.
 */
export function wordFrame(at: string | undefined, ctx: SceneCtx, fallback?: number): number {
  const base = fallback ?? ctx.enter;
  if (!at) return base;
  const tokens = at.split(/\s+/).map(norm).filter(Boolean);
  const first = tokens[0];
  if (!first) return base;
  for (let i = 0; i < ctx.words.length; i++) {
    const w = norm(ctx.words[i]?.text ?? "");
    if (!w || !(w === first || (first.length >= 3 && w.startsWith(first)))) continue;
    // A second word, when given, must follow.
    const second = tokens[1];
    if (second) {
      const next = norm(ctx.words[i + 1]?.text ?? "");
      if (!(next === second || (second.length >= 3 && next.startsWith(second)))) continue;
    }
    return Math.max(ctx.enter, (ctx.words[i]?.start ?? base) - 2);
  }
  return base;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Deterministic 0–1 value from a number, for small variations. */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
