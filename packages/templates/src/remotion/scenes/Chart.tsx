import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChartProps } from "../../schema";
import { formatNumber, progress, revealTimes, type SceneCtx, SMOOTH, springAt } from "../anim";
import { useLayout } from "../layout";
import { Sfx } from "../Sfx";
import { alpha, mix, useTheme } from "../theme";
import { SceneTitle, titleSpace } from "./common";

const GROW = { damping: 18, stiffness: 90, mass: 0.8 };

/** Bar chart. Vertical bars in landscape, horizontal rows in portrait. The highlighted bar glows when it is mentioned. */
export const Chart: React.FC<{ props: ChartProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();

  const bars = props.bars;
  const n = bars.length;
  const max = Math.max(...bars.map((b) => b.value), 1e-9);
  const format = { decimals: props.decimals, prefix: props.prefix, suffix: props.suffix };
  const growStart = ctx.enter + 8;

  const hlIndex = bars.findIndex((b) => b.highlight);
  const hlLabel = bars[hlIndex]?.label;
  const mention = hlLabel ? (revealTimes([hlLabel], ctx)[0] ?? 0) : Number.POSITIVE_INFINITY;
  const emphasis = springAt(frame, fps, Math.max(mention, growStart + n * 5 + 10), {
    damping: 10,
    stiffness: 150,
  });

  const sounds = (
    <>
      {bars.map((b, i) => (
        <Sfx key={b.label} at={growStart + i * 5} name="click" />
      ))}
      {Number.isFinite(mention) ? (
        <Sfx at={Math.max(mention, growStart + n * 5 + 10)} name="ding" />
      ) : null}
    </>
  );

  const top = content.top + titleSpace(portrait, u);
  const sourceH = props.source ? 4 * u : 0;
  const areaH = content.top + content.height - top - sourceH;

  const barColor = (hl: boolean) =>
    hl
      ? `linear-gradient(${portrait ? "90deg" : "0deg"}, ${mix(palette.accent, palette.bg, 0.25)}, ${palette.accent})`
      : palette.dark
        ? mix(palette.surface2, palette.text, 0.12)
        : mix(palette.accent2, palette.bg, 0.55);

  const source = props.source && (
    <div
      style={{
        position: "absolute",
        right: content.left,
        top: content.top + content.height - sourceH + u,
        fontSize: (portrait ? 2.6 : 1.9) * u,
        fontWeight: 600,
        color: palette.muted,
        opacity: progress(frame, growStart + 20, 15),
      }}
    >
      {props.source}
    </div>
  );

  if (portrait) {
    const labelW = 16 * u;
    const valueW = 16 * u;
    const rowH = Math.min(10 * u, areaH / n);
    const barMax = content.width - labelW - valueW - 4 * u;
    const startY = top + (areaH - rowH * n) / 2;
    return (
      <AbsoluteFill>
        <SceneTitle text={props.title} ctx={ctx} />
        {bars.map((bar, i) => {
          const g = springAt(frame, fps, growStart + i * 5, GROW);
          const hl = !!bar.highlight;
          const w = barMax * (bar.value / max) * g;
          const y = startY + i * rowH;
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: bars are positional
              key={i}
              style={{
                position: "absolute",
                left: content.left,
                top: y,
                height: rowH,
                width: content.width,
                display: "flex",
                alignItems: "center",
                gap: 2 * u,
              }}
            >
              <div
                style={{
                  width: labelW,
                  textAlign: "right",
                  fontSize: 3.6 * u,
                  fontWeight: hl ? 900 : 700,
                  color: hl ? palette.text : palette.muted,
                }}
              >
                {bar.label}
              </div>
              <div
                style={{
                  width: w,
                  height: rowH * 0.56,
                  borderRadius: `0 ${1.4 * u}px ${1.4 * u}px 0`,
                  background: barColor(hl),
                  boxShadow: hl ? `0 0 ${3 * u * emphasis}px ${alpha(palette.accent, 0.6)}` : "none",
                  transform: hl ? `scaleY(${1 + 0.12 * Math.sin(Math.min(1, emphasis) * Math.PI)})` : "none",
                }}
              />
              <div
                style={{
                  fontSize: (hl ? 4.4 : 3.6) * u,
                  fontWeight: 900,
                  color: hl ? palette.accent2 : palette.text,
                  fontVariantNumeric: "tabular-nums",
                  opacity: g,
                }}
              >
                {formatNumber(bar.value * g, format)}
              </div>
            </div>
          );
        })}
        {source}
      {sounds}
      </AbsoluteFill>
    );
  }

  const valueH = 6 * u;
  const labelH = 5 * u;
  const plotTop = top + valueH;
  const plotH = areaH - valueH - labelH;
  const baseY = plotTop + plotH;
  const plotLeft = content.left + 8 * u;
  const plotW = content.width - 16 * u;
  const slot = plotW / n;
  const bw = Math.min(13 * u, slot * 0.58);
  const baseline = progress(frame, ctx.enter, 18);
  const grid = springAt(frame, fps, ctx.enter + 4, SMOOTH);

  return (
    <AbsoluteFill>
      <SceneTitle text={props.title} ctx={ctx} />
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <div
          key={f}
          style={{
            position: "absolute",
            left: plotLeft,
            top: baseY - plotH * f,
            width: plotW * grid,
            height: Math.max(1, 0.12 * u),
            background: alpha(palette.text, 0.07),
          }}
        />
      ))}
      <div
        style={{
          position: "absolute",
          left: plotLeft,
          top: baseY,
          width: plotW * baseline,
          height: 0.35 * u,
          borderRadius: u,
          background: alpha(palette.text, 0.35),
        }}
      />
      {bars.map((bar, i) => {
        const g = springAt(frame, fps, growStart + i * 5, GROW);
        const hl = !!bar.highlight;
        const h = plotH * (bar.value / max) * g;
        const x = plotLeft + slot * i + slot / 2 - bw / 2;
        const pop = hl ? 1 + 0.08 * Math.sin(Math.min(1, emphasis) * Math.PI) : 1;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: bars are positional
          <div key={i}>
            <div
              style={{
                position: "absolute",
                left: x,
                top: baseY - h,
                width: bw,
                height: h,
                borderRadius: `${1.4 * u}px ${1.4 * u}px 0 0`,
                background: barColor(hl),
                boxShadow: hl ? `0 0 ${4 * u * emphasis}px ${alpha(palette.accent, 0.55)}` : "none",
                transform: `scaleX(${pop})`,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: x - slot / 2 + bw / 2,
                width: slot,
                top: baseY - h - 1.2 * u,
                transform: "translateY(-100%)",
                textAlign: "center",
                fontSize: (hl ? 3.4 : 2.7) * u,
                fontWeight: 900,
                color: hl ? palette.accent2 : palette.text,
                fontVariantNumeric: "tabular-nums",
                opacity: g,
              }}
            >
              {formatNumber(bar.value * g, format)}
            </div>
            <div
              style={{
                position: "absolute",
                left: x - slot / 2 + bw / 2,
                width: slot,
                top: baseY + 1.4 * u,
                textAlign: "center",
                fontSize: 2.5 * u,
                fontWeight: hl ? 900 : 700,
                color: hl ? palette.text : palette.muted,
                opacity: baseline,
              }}
            >
              {bar.label}
            </div>
          </div>
        );
      })}
      {source}
      {sounds}
    </AbsoluteFill>
  );
};
