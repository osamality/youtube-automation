import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { FlowProps } from "../../schema";
import { clamp01, POP, progress, revealTimes, type SceneCtx, springAt } from "../anim";
import { Icon } from "../Icon";
import { useLayout } from "../layout";
import { Sfx } from "../Sfx";
import { alpha, useTheme } from "../theme";
import { SceneTitle, titleSpace } from "./common";

type Pt = { x: number; y: number };
type Segment = { kind: "line"; a: Pt; b: Pt } | { kind: "curve"; p: [Pt, Pt, Pt, Pt] };

function cubic(p: [Pt, Pt, Pt, Pt], t: number): Pt {
  const [a, b, c, d] = p;
  const m = 1 - t;
  const w = [m * m * m, 3 * m * m * t, 3 * m * t * t, t * t * t] as const;
  return {
    x: w[0] * a.x + w[1] * b.x + w[2] * c.x + w[3] * d.x,
    y: w[0] * a.y + w[1] * b.y + w[2] * c.y + w[3] * d.y,
  };
}

function pointOn(seg: Segment, t: number): Pt {
  return seg.kind === "line"
    ? { x: seg.a.x + (seg.b.x - seg.a.x) * t, y: seg.a.y + (seg.b.y - seg.a.y) * t }
    : cubic(seg.p, t);
}

const Arrowhead: React.FC<{ tip: Pt; from: Pt; size: number; color: string; opacity: number }> = ({
  tip,
  from,
  size,
  color,
  opacity,
}) => {
  const a = Math.atan2(tip.y - from.y, tip.x - from.x);
  const left = { x: tip.x - size * Math.cos(a - 0.5), y: tip.y - size * Math.sin(a - 0.5) };
  const right = { x: tip.x - size * Math.cos(a + 0.5), y: tip.y - size * Math.sin(a + 0.5) };
  return (
    <polygon
      points={`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`}
      fill={color}
      opacity={opacity}
    />
  );
};

/** Steps connected by arrows that draw themselves; a light pulse then travels the chain. */
export const Flow: React.FC<{ props: FlowProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content, width, height } = useLayout();
  const { palette } = useTheme();

  const steps = props.steps;
  const n = steps.length;
  const reveal = revealTimes(
    steps.map((s) => s.label),
    ctx,
    0.75,
  );
  const at = (i: number) => reveal[i] ?? 0;

  const top = content.top + (props.title ? titleSpace(portrait, u) : 0);
  const areaH = content.top + content.height - top;
  const loopSpace = props.loop ? 12 * u : 0;

  const boxes = steps.map((_, i) => {
    if (!portrait) {
      const gap = 6 * u;
      const w = Math.min(40 * u, (content.width - gap * (n - 1)) / n);
      const h = 31 * u;
      const total = n * w + (n - 1) * gap;
      return {
        x: content.left + (content.width - total) / 2 + i * (w + gap) + w / 2,
        y: top + (areaH - loopSpace) / 2,
        w,
        h,
      };
    }
    const gap = 5 * u;
    const h = Math.min(12 * u, (areaH - gap * (n - 1)) / n);
    const total = n * h + (n - 1) * gap;
    return {
      x: content.left + (content.width - loopSpace) / 2,
      y: top + (areaH - total) / 2 + i * (h + gap) + h / 2,
      w: 64 * u,
      h,
    };
  });

  const edge = 1.4 * u;
  const segments: { seg: Segment; p: number }[] = boxes.slice(0, -1).map((b, i) => {
    const nb = boxes[i + 1] as (typeof boxes)[number];
    const a = portrait ? { x: b.x, y: b.y + b.h / 2 + edge } : { x: b.x + b.w / 2 + edge, y: b.y };
    const z = portrait
      ? { x: nb.x, y: nb.y - nb.h / 2 - edge }
      : { x: nb.x - nb.w / 2 - edge, y: nb.y };
    const drawStart = Math.max(at(i) + 6, at(i + 1) - 12);
    return {
      seg: { kind: "line", a, b: z },
      p: progress(frame, drawStart, Math.max(6, at(i + 1) - drawStart)),
    };
  });

  if (props.loop && n > 1) {
    const first = boxes[0] as (typeof boxes)[number];
    const last = boxes[n - 1] as (typeof boxes)[number];
    const bulge = 11 * u;
    const pts: [Pt, Pt, Pt, Pt] = portrait
      ? [
          { x: last.x + last.w / 2 + edge, y: last.y },
          { x: last.x + last.w / 2 + bulge, y: last.y },
          { x: first.x + first.w / 2 + bulge, y: first.y },
          { x: first.x + first.w / 2 + edge, y: first.y },
        ]
      : [
          { x: last.x, y: last.y + last.h / 2 + edge },
          { x: last.x, y: last.y + last.h / 2 + bulge },
          { x: first.x, y: first.y + first.h / 2 + bulge },
          { x: first.x, y: first.y + first.h / 2 + edge },
        ];
    segments.push({ seg: { kind: "curve", p: pts }, p: progress(frame, at(n - 1) + 10, 22) });
  }

  const allDrawn = at(n - 1) + (props.loop ? 34 : 12);
  const perSegment = 22;
  const travel = frame - allDrawn;
  let pulse: Pt | null = null;
  if (travel > 0 && segments.length) {
    const t = (travel / perSegment) % segments.length;
    const seg = segments[Math.floor(t)];
    if (seg) pulse = pointOn(seg.seg, t - Math.floor(t));
  }

  const lineColor = alpha(palette.text, 0.35);
  const iconBox = portrait ? Math.min(8 * u, (boxes[0]?.h ?? 10 * u) * 0.68) : 13 * u;

  return (
    <AbsoluteFill>
      {props.title && <SceneTitle text={props.title} ctx={ctx} />}

      <svg width={width} height={height} style={{ position: "absolute", inset: 0 }}>
        <title>flow connectors</title>
        {segments.map(({ seg, p }, i) => {
          const d =
            seg.kind === "line"
              ? `M ${seg.a.x} ${seg.a.y} L ${seg.b.x} ${seg.b.y}`
              : `M ${seg.p[0].x} ${seg.p[0].y} C ${seg.p[1].x} ${seg.p[1].y}, ${seg.p[2].x} ${seg.p[2].y}, ${seg.p[3].x} ${seg.p[3].y}`;
          const tip = seg.kind === "line" ? seg.b : seg.p[3];
          const from = seg.kind === "line" ? seg.a : seg.p[2];
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: segments are positional
            <g key={i}>
              <path
                d={d}
                fill="none"
                stroke={seg.kind === "curve" ? alpha(palette.accent2, 0.7) : lineColor}
                strokeWidth={0.55 * u}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray="1 1"
                strokeDashoffset={1 - p}
              />
              <Arrowhead
                tip={tip}
                from={from}
                size={1.8 * u}
                color={seg.kind === "curve" ? palette.accent2 : lineColor}
                opacity={clamp01((p - 0.85) / 0.15)}
              />
            </g>
          );
        })}
        {pulse && (
          <>
            <circle cx={pulse.x} cy={pulse.y} r={2.4 * u} fill={alpha(palette.accent2, 0.25)} />
            <circle cx={pulse.x} cy={pulse.y} r={1.05 * u} fill={palette.accent2} />
          </>
        )}
      </svg>

      {steps.map((step, i) => {
        const b = boxes[i] as (typeof boxes)[number];
        const s = springAt(frame, fps, at(i), POP);
        const current = frame >= at(i) && (i === n - 1 || frame < at(i + 1));
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: steps are positional
            key={i}
            style={{
              position: "absolute",
              left: b.x - b.w / 2,
              top: b.y - b.h / 2,
              width: b.w,
              height: b.h,
              borderRadius: 2.6 * u,
              background: palette.surface,
              border: `${0.3 * u}px solid ${current ? palette.accent : alpha(palette.text, 0.1)}`,
              boxShadow: current
                ? `0 0 ${4 * u}px ${alpha(palette.accent, 0.45)}`
                : `0 ${u}px ${3 * u}px ${alpha("#000000", 0.25)}`,
              display: "flex",
              flexDirection: portrait ? "row" : "column",
              alignItems: "center",
              justifyContent: portrait ? "flex-start" : "center",
              gap: (portrait ? 3 : 1.8) * u,
              padding: portrait ? `0 ${3.5 * u}px` : `${2 * u}px`,
              opacity: clamp01(s * 1.4),
              transform: `scale(${0.6 + 0.4 * s})`,
            }}
          >
            <div
              style={{
                flex: "none",
                width: iconBox,
                height: iconBox,
                borderRadius: "50%",
                background: alpha(palette.accent, 0.16),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={step.icon} size={iconBox * 0.52} color={palette.accent} />
            </div>
            <div
              style={{
                fontSize: (portrait ? 4.4 : 3.9) * u,
                fontWeight: 800,
                lineHeight: 1.15,
                textAlign: portrait ? "left" : "center",
              }}
            >
              {step.label}
            </div>
          </div>
        );
      })}
      {reveal.map((t, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: one sound per step
        <Sfx key={i} at={t} name="pop" />
      ))}
    </AbsoluteFill>
  );
};
