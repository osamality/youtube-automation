import { AbsoluteFill, Easing, useCurrentFrame, useVideoConfig } from "remotion";
import type { LineProps } from "../../schema";
import { clamp01, formatNumber, revealTimes, type SceneCtx, springAt } from "../anim";
import { useLayout } from "../layout";
import { Sfx } from "../Sfx";
import { alpha, useTheme } from "../theme";
import { SceneTitle, titleSpace } from "./common";

/** A line (e.g. a share price) drawn across the narration, with a value tag riding its tip and labelled points. */
export const Line: React.FC<{ props: LineProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();
  const fmt = { prefix: props.prefix, suffix: props.suffix, decimals: props.decimals };

  const pts = props.points;
  const values = pts.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || Math.abs(hi) || 1;
  const yMin = lo - span * 0.12;
  const yMax = hi + span * 0.18;
  const falling = (values[values.length - 1] ?? 0) < (values[0] ?? 0);
  const color = falling ? palette.negative : palette.positive;

  const top = content.top + titleSpace(portrait, u) + 2 * u;
  const axisW = (portrait ? 13 : 10) * u;
  const W = content.width - axisW - 4 * u;
  const H = content.height - titleSpace(portrait, u) - (props.source ? 9 : 6) * u;
  const x = (i: number) => (pts.length === 1 ? W / 2 : (i / (pts.length - 1)) * W);
  const y = (v: number) => H - ((v - yMin) / (yMax - yMin)) * H;

  // Drawing runs from just after the title to 80% of the narration.
  const start = ctx.enter + 8;
  const end = Math.max(start + 30, ctx.voiceStart + Math.round(ctx.voiceFrames * 0.8));
  const prog = Easing.inOut(Easing.quad)(clamp01((frame - start) / (end - start)));
  const reach = prog * (pts.length - 1);
  const whole = Math.floor(reach);
  const part = reach - whole;
  const shown = pts.slice(0, whole + 1).map((p, i) => [x(i), y(p.value)] as const);
  const a = pts[whole];
  const b = pts[Math.min(whole + 1, pts.length - 1)];
  const tipV = a && b ? a.value + (b.value - a.value) * part : (values[0] ?? 0);
  const tip = [x(reach), y(tipV)] as const;
  if (part > 0) shown.push(tip);
  const path = shown.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const area = shown.length > 1 ? `${path} L${tip[0].toFixed(1)},${H} L0,${H} Z` : "";

  const grid = [0, 1, 2, 3].map((k) => yMin + ((yMax - yMin) * (k + 0.5)) / 4);
  const labelEvery = Math.max(1, Math.ceil(pts.length / (portrait ? 4 : 6)));
  const marks = props.marks ?? [];
  const markTimes = revealTimes(
    marks.map((m) => m.at ?? m.text),
    ctx,
    0.8,
  ).map((t, i) => {
    // A mark never appears before the line reaches its point.
    const idx = Math.min(marks[i]?.index ?? 0, pts.length - 1);
    const reached = start + (end - start) * (idx / Math.max(1, pts.length - 1));
    return Math.max(t, Math.round(reached));
  });
  const fontS = (portrait ? 2.8 : 2.1) * u;

  return (
    <AbsoluteFill>
      <SceneTitle text={props.title} ctx={ctx} />
      <div style={{ position: "absolute", left: content.left, top, width: content.width, height: H + 6 * u }}>
        {grid.map((g) => (
          <div key={g} style={{ position: "absolute", left: 0, top: y(g) - fontS * 0.6, width: axisW - 1.5 * u, textAlign: "right", fontSize: fontS, fontWeight: 700, color: palette.muted }}>
            {formatNumber(g, fmt)}
          </div>
        ))}
        <svg width={W} height={H + 1} style={{ position: "absolute", left: axisW, top: 0, overflow: "visible" }}>
          <defs>
            <linearGradient id={`line-fill-${ctx.index}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          {grid.map((g) => (
            <line key={g} x1={0} x2={W} y1={y(g)} y2={y(g)} stroke={alpha(palette.text, 0.1)} strokeWidth={0.2 * u} />
          ))}
          {area && <path d={area} fill={`url(#line-fill-${ctx.index})`} />}
          <path d={path} fill="none" stroke={color} strokeWidth={0.75 * u} strokeLinejoin="round" strokeLinecap="round" />
          {marks.map((m, i) => {
            const idx = Math.min(m.index, pts.length - 1);
            const p = springAt(frame, fps, markTimes[i] ?? 0, { damping: 12, stiffness: 160 });
            const px = x(idx);
            const py = y(pts[idx]?.value ?? 0);
            return p > 0.01 ? (
              <circle key={m.text} cx={px} cy={py} r={1.3 * u * p} fill="#FFFFFF" stroke={palette.text} strokeWidth={0.45 * u} />
            ) : null;
          })}
          {prog > 0 && <circle cx={tip[0]} cy={tip[1]} r={1.1 * u} fill={color} />}
        </svg>
        {/* x labels */}
        {pts.map((p, i) =>
          (i % labelEvery === 0 && pts.length - 1 - i >= labelEvery / 2) || i === pts.length - 1 ? (
            <div
              key={p.label + String(i)}
              style={{ position: "absolute", top: H + 1.4 * u, left: axisW + x(i) - 8 * u, width: 16 * u, textAlign: "center", fontSize: fontS, fontWeight: 700, color: palette.muted, opacity: i <= reach + 0.01 ? 1 : 0.35 }}
            >
              {p.label}
            </div>
          ) : null,
        )}
        {/* value tag on the tip */}
        {prog > 0 && (
          <div
            style={{
              position: "absolute",
              left: axisW + tip[0] + 1.6 * u,
              top: tip[1] - 2.6 * u,
              transform: tip[0] > W * 0.8 ? "translateX(calc(-100% - 3.2em))" : undefined,
              background: color,
              color: "#FFFFFF",
              fontWeight: 900,
              fontSize: (portrait ? 3.6 : 2.8) * u,
              padding: `${0.4 * u}px ${1.2 * u}px`,
              borderRadius: 1 * u,
              whiteSpace: "nowrap",
            }}
          >
            {formatNumber(tipV, fmt)}
          </div>
        )}
        {marks.map((m, i) => {
          const idx = Math.min(m.index, pts.length - 1);
          const at = markTimes[i] ?? 0;
          const p = springAt(frame, fps, at, { damping: 14, stiffness: 150 });
          const px = axisW + x(idx);
          const py = y(pts[idx]?.value ?? 0);
          const above = py > H * 0.35;
          const boxW = (portrait ? 34 : 26) * u;
          return (
            <div
              key={m.text}
              style={{
                position: "absolute",
                left: Math.min(Math.max(px - boxW / 2, axisW), axisW + W - boxW),
                top: above ? py - 12 * u : py + 3 * u,
                width: boxW,
                background: "#FFFFFF",
                border: `${0.3 * u}px solid ${palette.text}`,
                borderRadius: 1.2 * u,
                padding: `${0.8 * u}px ${1.2 * u}px`,
                fontSize: (portrait ? 2.8 : 2.2) * u,
                fontWeight: 800,
                textAlign: "center",
                lineHeight: 1.2,
                boxShadow: `0 ${0.8 * u}px ${2 * u}px ${alpha("#000000", 0.15)}`,
                opacity: clamp01(p * 2),
                transform: `scale(${0.8 + 0.2 * p})`,
              }}
            >
              {m.text}
              <Sfx at={at} name="pop" />
            </div>
          );
        })}
        {props.source && (
          <div style={{ position: "absolute", left: axisW, top: H + 5.5 * u, fontSize: 1.9 * u, fontWeight: 600, color: palette.muted }}>
            Source: {props.source}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
