import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { CompareProps } from "../../schema";
import { BOUNCY, clamp01, fadeUp, POP, revealTimes, type SceneCtx, springAt } from "../anim";
import { Icon } from "../Icon";
import { Logo } from "../Logo";
import { useLayout } from "../layout";
import { Sfx } from "../Sfx";
import { alpha, useTheme } from "../theme";

type Side = CompareProps["left"];

/** Two cards side by side (stacked in portrait), a pulsing VS badge, points that tick in, optional verdict. */
export const Compare: React.FC<{ props: CompareProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();

  // Points appear alternately: left 1, right 1, left 2, right 2…
  const order: { side: 0 | 1; index: number; text: string }[] = [];
  const rows = Math.max(props.left.points.length, props.right.points.length);
  for (let k = 0; k < rows; k++) {
    const l = props.left.points[k];
    const r = props.right.points[k];
    if (l) order.push({ side: 0, index: k, text: l });
    if (r) order.push({ side: 1, index: k, text: r });
  }
  const times = revealTimes(
    order.map((o) => o.text),
    ctx,
    0.7,
  );
  const timeOf = (side: 0 | 1, index: number) =>
    times[order.findIndex((o) => o.side === side && o.index === index)] ?? 0;

  const verdictH = props.verdict ? (portrait ? 10 : 9) * u : 0;
  const verdictAt = Math.max(
    (times[times.length - 1] ?? 0) + 12,
    ctx.voiceStart + ctx.voiceFrames * 0.72,
  );
  const vsGap = (portrait ? 6 : 12) * u;
  const verdictGap = props.verdict ? (portrait ? 2 : 3) * u : 0;
  const cardW = portrait ? content.width : (content.width - vsGap) / 2;
  const textSize = (portrait ? 3.9 : 4) * u;
  const rowGap = (portrait ? 1.6 : 2.4) * u;

  // Cards are as tall as their content (with a rough line-wrap estimate), capped by the room.
  const textW = cardW - 6.8 * u - textSize * 1.25 - 1.6 * u;
  const lines = (text: string) => Math.max(1, Math.ceil((text.length * textSize * 0.56) / textW));
  const pointsH = (side: Side) =>
    side.points.reduce((h, t) => h + rowGap + Math.max(textSize * 1.25, lines(t) * textSize * 1.2), 0);
  const needH = 6.7 * u + 7 * u + Math.max(pointsH(props.left), pointsH(props.right)) + 2 * u;
  const roomH = portrait
    ? (content.height - verdictH - vsGap - verdictGap) / 2
    : content.height - verdictH - verdictGap;
  const cardH = Math.min(roomH, needH);
  const groupH = (portrait ? 2 * cardH + vsGap : cardH) + verdictGap + verdictH;
  const top0 = content.top + (content.height - groupH) / 2;

  const toneColor = (side: Side) =>
    side.tone === "positive"
      ? palette.positive
      : side.tone === "negative"
        ? palette.negative
        : palette.accent;
  const mark = (side: Side) =>
    side.tone === "positive" ? "check" : side.tone === "negative" ? "x" : "minus";

  const card = (side: Side, which: 0 | 1) => {
    const s = springAt(frame, fps, ctx.enter + which * 5, { damping: 15, stiffness: 120 });
    const color = toneColor(side);
    const offset = (1 - s) * (portrait ? 10 : 22) * u * (which === 0 ? -1 : 1);
    const left = portrait ? content.left : content.left + which * (cardW + vsGap);
    const top = portrait ? top0 + which * (cardH + vsGap) : top0;
    return (
      <div
        style={{
          position: "absolute",
          left,
          top,
          width: cardW,
          height: cardH,
          borderRadius: 3 * u,
          background: palette.surface,
          borderTop: `${0.7 * u}px solid ${color}`,
          boxShadow: `0 ${1.2 * u}px ${4 * u}px ${alpha("#000000", 0.28)}`,
          padding: `${3 * u}px ${3.4 * u}px`,
          display: "flex",
          flexDirection: "column",
          gap: rowGap,
          opacity: clamp01(s * 1.3),
          transform: portrait ? `translateY(${offset}px)` : `translateX(${offset}px)`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 2 * u }}>
          {side.logo ? (
            <Logo slug={side.logo} size={7.4 * u} />
          ) : (
            <div
              style={{
                width: 7 * u,
                height: 7 * u,
                borderRadius: "50%",
                background: alpha(color, 0.18),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
              }}
            >
              <Icon name={side.icon ?? "circle"} size={3.8 * u} color={color} />
            </div>
          )}
          <div style={{ fontSize: (portrait ? 5.2 : 4.9) * u, fontWeight: 900 }}>{side.title}</div>
        </div>
        {side.points.map((point, k) => {
          const p = springAt(frame, fps, timeOf(which, k), POP);
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: points are positional
              key={k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 1.6 * u,
                fontSize: textSize,
                fontWeight: 700,
                ...fadeUp(p, 2 * u),
              }}
            >
              <div
                style={{
                  flex: "none",
                  width: textSize * 1.25,
                  height: textSize * 1.25,
                  borderRadius: "50%",
                  background: alpha(color, 0.2),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${0.5 + 0.5 * p})`,
                }}
              >
                <Icon name={mark(side)} size={textSize * 0.8} color={color} strokeWidth={3} />
              </div>
              {point}
            </div>
          );
        })}
      </div>
    );
  };

  const vs = springAt(frame, fps, ctx.enter + 12, BOUNCY);
  const vsD = (portrait ? 11 : 10) * u;
  const vsX = portrait ? content.left + content.width / 2 : content.left + cardW + vsGap / 2;
  const vsY = portrait ? top0 + cardH + vsGap / 2 : top0 + cardH / 2;
  const verdict = springAt(frame, fps, verdictAt, POP);

  return (
    <AbsoluteFill>
      {card(props.left, 0)}
      {card(props.right, 1)}
      <div
        style={{
          position: "absolute",
          left: vsX - vsD / 2,
          top: vsY - vsD / 2,
          width: vsD,
          height: vsD,
          borderRadius: "50%",
          background: palette.accent2,
          color: palette.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 3.6 * u,
          fontWeight: 900,
          boxShadow: `0 0 0 ${0.8 * u}px ${palette.bg}, 0 0 ${4 * u}px ${alpha(palette.accent2, 0.5)}`,
          transform: `scale(${vs * (1 + 0.05 * Math.sin(frame / 5))})`,
        }}
      >
        VS
      </div>
      {props.verdict && (
        <div
          style={{
            position: "absolute",
            left: content.left,
            top: top0 + groupH - verdictH,
            width: content.width,
            height: verdictH,
            borderRadius: 2.4 * u,
            background: palette.accent,
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 1.6 * u,
            fontSize: (portrait ? 4 : 3.2) * u,
            fontWeight: 800,
            ...fadeUp(verdict, 4 * u),
          }}
        >
          <Icon name="sparkles" size={3.4 * u} color="#FFFFFF" />
          {props.verdict}
        </div>
      )}
      <Sfx at={ctx.enter + 12} name="boom" volume={0.6} />
      {times.map((t, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: one sound per point
        <Sfx key={i} at={t} name="pop" />
      ))}
      {props.verdict ? <Sfx at={verdictAt} name="ding" /> : null}
    </AbsoluteFill>
  );
};
