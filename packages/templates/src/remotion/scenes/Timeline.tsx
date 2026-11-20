import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TimelineProps } from "../../schema";
import { BOUNCY, clamp01, POP, revealTimes, type SceneCtx, SMOOTH, springAt } from "../anim";
import { Emoji } from "../Emoji";
import { useLayout } from "../layout";
import { Logo } from "../Logo";
import { Sfx } from "../Sfx";
import { alpha, mix, useTheme } from "../theme";
import { SceneTitle, titleSpace } from "./common";

/** Dates on a line that draws itself from point to point as each one is spoken. Vertical in portrait. */
export const Timeline: React.FC<{ props: TimelineProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();

  const items = props.items;
  const n = items.length;
  const times = revealTimes(
    items.map((it) => it.at ?? `${it.year} ${it.label}`),
    ctx,
    0.8,
  );
  const top = content.top + (props.title ? titleSpace(portrait, u) : 0);
  const height = content.top + content.height - top;
  const highlight = (props.highlight ?? 0) - 1;
  const glow = 0.5 + 0.5 * Math.sin(frame / 7);

  // Where the drawn line has reached: eases from one item to the next as each appears.
  let reach = 0;
  times.forEach((t, i) => {
    reach = Math.max(reach, i + springAt(frame, fps, t - 8, SMOOTH) - 1);
  });
  reach = Math.max(-0.5, reach);

  const lineColor = alpha(palette.text, 0.16);
  const fill = `linear-gradient(${portrait ? "180deg" : "90deg"}, ${palette.accent}, ${palette.accent2})`;

  if (portrait) {
    const x = content.left + 9 * u;
    const rowH = height / n;
    const yOf = (i: number) => top + rowH * (i + 0.5);
    const lineTop = yOf(0);
    const lineEnd = yOf(n - 1);
    const drawn = Math.min(lineEnd, yOf(0) + rowH * reach);
    return (
      <AbsoluteFill>
        {props.title && <SceneTitle text={props.title} ctx={ctx} />}
        <div style={{ position: "absolute", left: x - 0.4 * u, top: lineTop, width: 0.8 * u, height: lineEnd - lineTop, background: lineColor, borderRadius: u }} />
        <div style={{ position: "absolute", left: x - 0.4 * u, top: lineTop, width: 0.8 * u, height: Math.max(0, drawn - lineTop), background: fill, borderRadius: u }} />
        {items.map((it, i) => {
          const s = springAt(frame, fps, times[i] ?? 0, BOUNCY);
          const hot = i === highlight && s > 0.5;
          return (
            <div
              key={`${it.year}-${i}`}
              style={{
                position: "absolute",
                left: x - 2 * u,
                top: yOf(i),
                transform: `translateY(-50%) translateX(${(1 - s) * 6 * u}px)`,
                opacity: clamp01(s * 2),
                display: "flex",
                alignItems: "center",
                gap: 3 * u,
                width: content.width - 6 * u,
              }}
            >
              <Dot size={4 * u} hot={hot} glow={glow} scale={s} />
              {it.emoji ? <Emoji name={it.emoji} size={9 * u} /> : it.logo ? <Logo slug={it.logo} size={8.4 * u} /> : null}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 6 * u, fontWeight: 900, color: hot ? palette.accent2 : palette.accent, lineHeight: 1 }}>{it.year}</div>
                <div style={{ fontSize: 4 * u, fontWeight: 800, lineHeight: 1.15 }}>{it.label}</div>
              </div>
              <Sfx at={times[i] ?? 0} name={hot ? "ding" : "pop"} />
            </div>
          );
        })}
      </AbsoluteFill>
    );
  }

  const pad = 4 * u;
  const step = (content.width - pad * 2) / n;
  const xOf = (i: number) => content.left + pad + step * (i + 0.5);
  const y = top + height * 0.46;
  const lineStart = content.left + pad * 0.5;
  const lineEnd = content.left + content.width - pad * 0.5;
  const drawn = Math.min(lineEnd, Math.max(lineStart, xOf(0) + step * reach));
  const lineIn = springAt(frame, fps, ctx.enter, SMOOTH);

  return (
    <AbsoluteFill>
      {props.title && <SceneTitle text={props.title} ctx={ctx} />}
      <div
        style={{
          position: "absolute",
          left: lineStart,
          top: y - 0.4 * u,
          width: (lineEnd - lineStart) * lineIn,
          height: 0.8 * u,
          background: lineColor,
          borderRadius: u,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: lineStart,
          top: y - 0.4 * u,
          width: drawn - lineStart,
          height: 0.8 * u,
          background: fill,
          borderRadius: u,
          boxShadow: `0 0 ${2 * u}px ${alpha(palette.accent, 0.5)}`,
        }}
      />
      {items.map((it, i) => {
        const at = times[i] ?? 0;
        const s = springAt(frame, fps, at, BOUNCY);
        const label = springAt(frame, fps, at + 5, POP);
        const hot = i === highlight && s > 0.5;
        const above = i % 2 === 0;
        const x = xOf(i);
        const iconSize = 13 * u;
        const block = (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1.2 * u,
              width: step * 0.94,
              textAlign: "center",
            }}
          >
            {it.emoji ? (
              <Emoji name={it.emoji} size={iconSize} />
            ) : it.logo ? (
              <Logo slug={it.logo} size={iconSize * 0.9} />
            ) : null}
            <div style={{ fontSize: 3.8 * u, fontWeight: 800, lineHeight: 1.15 }}>{it.label}</div>
          </div>
        );
        return (
          <div key={`${it.year}-${i}`}>
            {/* Year on one side of the line, picture + label on the other, alternating. */}
            <div
              style={{
                position: "absolute",
                left: x,
                top: above ? y + 4.2 * u : y - 4.2 * u,
                transform: `translate(-50%, ${above ? 0 : -100}%) scale(${0.6 + 0.4 * s})`,
                opacity: clamp01(s * 2),
                fontSize: 7.4 * u,
                fontWeight: 900,
                letterSpacing: "-0.02em",
                color: hot ? palette.accent2 : mix(palette.accent, palette.text, 0.2),
                textShadow: hot ? `0 0 ${2 * u * glow}px ${alpha(palette.accent2, 0.7)}` : "none",
              }}
            >
              {it.year}
            </div>
            <div style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)" }}>
              <Dot size={4.2 * u} hot={hot} glow={glow} scale={s} />
            </div>
            <div
              style={{
                position: "absolute",
                left: x,
                top: above ? y - 4.2 * u : y + 4.2 * u,
                transform: `translate(-50%, ${above ? -100 : 0}%) translateY(${(1 - label) * (above ? 3 : -3) * u}px)`,
                opacity: clamp01(label * 2),
              }}
            >
              {block}
            </div>
            <Sfx at={at} name={hot ? "ding" : "pop"} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

const Dot: React.FC<{ size: number; hot: boolean; glow: number; scale: number }> = ({ size, hot, glow, scale }) => {
  const { palette } = useTheme();
  const color = hot ? palette.accent2 : palette.accent;
  return (
    <div
      style={{
        width: size,
        height: size,
        flex: "none",
        borderRadius: "50%",
        background: palette.surface,
        border: `${size * 0.22}px solid ${color}`,
        transform: `scale(${scale * (hot ? 1.15 + 0.1 * glow : 1)})`,
        boxShadow: hot ? `0 0 ${size * 1.2 * glow}px ${alpha(color, 0.8)}` : `0 0 ${size * 0.5}px ${alpha(color, 0.4)}`,
      }}
    />
  );
};
