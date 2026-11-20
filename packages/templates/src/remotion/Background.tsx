import { AbsoluteFill, useCurrentFrame } from "remotion";
import { mulberry32, type Timeline, TRANSITION_FRAMES } from "../timeline";
import { useLayout } from "./layout";
import { alpha, mix, useTheme } from "./theme";

/** Dark palettes get drifting glows; bright palettes (with `scenes` colours) get playful shapes. */
export const Background: React.FC<{ seed: number; timeline: Timeline }> = ({ seed, timeline }) => {
  const { palette } = useTheme();
  return palette.scenes ? <BrightBackground seed={seed} timeline={timeline} /> : <DarkBackground seed={seed} />;
};

type ShapeKind = "circle" | "ring" | "plus" | "triangle" | "squiggle" | "dots";
const SHAPES: ShapeKind[] = ["circle", "ring", "plus", "triangle", "squiggle", "dots"];

function Shape({ kind, color }: { kind: ShapeKind; color: string }) {
  switch (kind) {
    case "circle":
      return <circle cx={50} cy={50} r={34} fill={color} />;
    case "ring":
      return <circle cx={50} cy={50} r={32} fill="none" stroke={color} strokeWidth={14} />;
    case "plus":
      return <path d="M 50 14 L 50 86 M 14 50 L 86 50" stroke={color} strokeWidth={16} strokeLinecap="round" />;
    case "triangle":
      return <path d="M 50 14 L 88 82 L 12 82 Z" fill="none" stroke={color} strokeWidth={13} strokeLinejoin="round" />;
    case "squiggle":
      return <path d="M 6 60 Q 20 30 34 60 T 62 60 T 94 60" fill="none" stroke={color} strokeWidth={13} strokeLinecap="round" />;
    case "dots":
      return (
        <g fill={color}>
          {[20, 50, 80].flatMap((x) => [20, 50, 80].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r={9} />))}
        </g>
      );
  }
}

/** Per-scene background colour (cross-faded during transitions), soft blobs and floating shapes. */
const BrightBackground: React.FC<{ seed: number; timeline: Timeline }> = ({ seed, timeline }) => {
  const frame = useCurrentFrame();
  const { width, height, u } = useLayout();
  const { palette } = useTheme();
  const colors = palette.scenes ?? [palette.bg];
  const pops = palette.pops ?? [palette.accent, palette.accent2];

  // Scene colour: the scene whose start we passed last, blended in over the transition.
  let index = 0;
  for (const s of timeline.scenes) if (s.from <= frame) index = s.index;
  const current = timeline.scenes[index];
  const colorOf = (i: number) => colors[(i + seed) % colors.length] as string;
  const t = current && index > 0 ? Math.min(1, (frame - current.from) / TRANSITION_FRAMES) : 1;
  const bg = mix(colorOf(Math.max(0, index - 1)), colorOf(index), t);

  const rand = mulberry32(seed + 101);
  const blobs = [0, 1, 2].map((i) => ({
    color: pops[(i + seed) % pops.length] as string,
    size: (60 + rand() * 30) * u,
    phase: rand() * Math.PI * 2,
    speed: 0.003 + rand() * 0.003,
    x: [0.12, 0.88, 0.5][i] as number,
    y: [0.2, 0.75, 1.05][i] as number,
  }));

  const shapes: { kind: ShapeKind; x: number; y: number; size: number; color: string; phase: number; spin: number }[] = [];
  let guard = 0;
  while (shapes.length < 14 && guard++ < 400) {
    const x = rand();
    const y = rand();
    // Keep the middle clear for content.
    const dx = (x - 0.5) / 0.36;
    const dy = (y - 0.47) / 0.3;
    if (dx * dx + dy * dy < 1) continue;
    shapes.push({
      kind: SHAPES[Math.floor(rand() * SHAPES.length)] as ShapeKind,
      x,
      y,
      size: (2.4 + rand() * 2.6) * u,
      color: pops[Math.floor(rand() * pops.length)] as string,
      phase: rand() * Math.PI * 2,
      spin: (rand() - 0.5) * 0.8,
    });
  }

  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      {blobs.map((b, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative list
          key={i}
          style={{
            position: "absolute",
            left: width * b.x + Math.sin(frame * b.speed + b.phase) * 8 * u - b.size / 2,
            top: height * b.y + Math.cos(frame * b.speed * 1.2 + b.phase) * 6 * u - b.size / 2,
            width: b.size,
            height: b.size,
            borderRadius: "50%",
            background: alpha(b.color, palette.dark ? 0.16 : 0.1),
          }}
        />
      ))}
      {shapes.map((s, i) => (
        <svg
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative list
          key={i}
          viewBox="0 0 100 100"
          width={s.size}
          height={s.size}
          style={{
            position: "absolute",
            left: width * s.x - s.size / 2,
            top: height * s.y - s.size / 2 + Math.sin(frame / 30 + s.phase) * 1.4 * u,
            transform: `rotate(${s.phase * 57 + frame * s.spin}deg)`,
            opacity: palette.dark ? 0.32 : 0.5,
          }}
        >
          <Shape kind={s.kind} color={s.color} />
        </svg>
      ))}
    </AbsoluteFill>
  );
};

/** Always-moving dark backdrop: drifting colour glows over a slowly scrolling dot grid. */
const DarkBackground: React.FC<{ seed: number }> = ({ seed }) => {
  const frame = useCurrentFrame();
  const { width, height, u } = useLayout();
  const { palette } = useTheme();

  const rand = mulberry32(seed);
  const glows = [palette.accent, palette.accent2, palette.accent].map((color, i) => ({
    color,
    phase: rand() * Math.PI * 2,
    speed: 0.004 + rand() * 0.004,
    size: (i === 1 ? 55 : 75) * u,
    strength: palette.dark ? (i === 1 ? 0.1 : 0.16) : 0.12,
  }));

  const spacing = 4.5 * u;
  const drift = (frame * 0.25) % spacing;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${palette.bg} 0%, ${palette.bg2} 100%)`,
        overflow: "hidden",
      }}
    >
      {glows.map((g, i) => {
        const x = width * (0.5 + 0.42 * Math.sin(frame * g.speed + g.phase));
        const y = height * (0.5 + 0.4 * Math.cos(frame * g.speed * 1.3 + g.phase * 1.7));
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative list
            key={i}
            style={{
              position: "absolute",
              left: x - g.size / 2,
              top: y - g.size / 2,
              width: g.size,
              height: g.size,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${alpha(g.color, g.strength)} 0%, ${alpha(g.color, 0)} 70%)`,
            }}
          />
        );
      })}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${alpha(palette.text, palette.dark ? 0.07 : 0.09)} ${0.16 * u}px, transparent ${0.18 * u}px)`,
          backgroundSize: `${spacing}px ${spacing}px`,
          backgroundPosition: `${drift}px ${drift}px`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 55%, ${alpha(palette.bg, 0.65)} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
