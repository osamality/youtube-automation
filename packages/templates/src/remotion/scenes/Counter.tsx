import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { CounterProps } from "../../schema";
import { fadeUp, formatNumber, type SceneCtx, SMOOTH, springAt } from "../anim";
import { fitFont, useLayout } from "../layout";
import { Sfx } from "../Sfx";
import { alpha, useTheme } from "../theme";

/** Big number that counts up inside a ring that fills in step with it. */
export const Counter: React.FC<{ props: CounterProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();

  const countStart = ctx.enter + 6;
  const countFrames = 48;
  const p = interpolate(frame, [countStart, countStart + countFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const format = { decimals: props.decimals, prefix: props.prefix, suffix: props.suffix };
  const finalText = formatNumber(props.value, format);
  const shown = formatNumber(props.value * p, format);

  const landed = springAt(frame, fps, countStart + countFrames, { damping: 8, stiffness: 180 });
  const bump = 1 + Math.sin(Math.min(1, landed) * Math.PI) * 0.07;
  const ringIn = springAt(frame, fps, ctx.enter, SMOOTH);

  const D = portrait ? 62 * u : Math.min(50 * u, content.height * 0.82);
  const stroke = 2.2 * u;
  const r = D / 2 - stroke;
  const C = 2 * Math.PI * r;
  // Heavy digits are ~0.72em wide. Keep the final text inside ~66% of the ring.
  const numberSize = Math.min(D * 0.3, (D * 0.66) / (finalText.length * 0.72));

  const label = springAt(frame, fps, ctx.enter + 22, SMOOTH);
  const sub = springAt(frame, fps, ctx.enter + 32, SMOOTH);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: content.left,
          top: content.top,
          width: content.width,
          height: content.height,
          display: "flex",
          flexDirection: portrait ? "column" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: (portrait ? 5 : 7) * u,
        }}
      >
        <div
          style={{
            position: "relative",
            width: D,
            height: D,
            transform: `scale(${(0.7 + 0.3 * ringIn) * bump})`,
            opacity: ringIn,
          }}
        >
          <svg width={D} height={D} style={{ position: "absolute", inset: 0 }}>
            <title>progress ring</title>
            <circle
              cx={D / 2}
              cy={D / 2}
              r={r}
              fill={alpha(palette.surface, 0.7)}
              stroke={alpha(palette.text, 0.08)}
              strokeWidth={stroke}
            />
            <circle
              cx={D / 2}
              cy={D / 2}
              r={r}
              fill="none"
              stroke={palette.accent}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - p)}
              transform={`rotate(-90 ${D / 2} ${D / 2})`}
            />
            {Array.from({ length: 10 }, (_, i) => {
              const a = (i / 10) * Math.PI * 2 + frame * 0.012;
              const orbit = D / 2 + 2.6 * u;
              return (
                <circle
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed decorative dots
                  key={i}
                  cx={D / 2 + Math.cos(a) * orbit}
                  cy={D / 2 + Math.sin(a) * orbit}
                  r={0.45 * u}
                  fill={i % 2 ? palette.accent2 : palette.accent}
                  opacity={0.55}
                />
              );
            })}
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: numberSize,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {shown}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: portrait ? "center" : "flex-start",
            textAlign: portrait ? "center" : "left",
            gap: 1.6 * u,
            maxWidth: portrait ? content.width : content.width - D - 7 * u,
          }}
        >
          <div
            style={{
              fontSize: fitFont(props.label, portrait ? 6.2 * u : 5.4 * u, 22),
              fontWeight: 900,
              lineHeight: 1.1,
              ...fadeUp(label, 4 * u),
            }}
          >
            {props.label}
          </div>
          {props.sublabel && (
            <div
              style={{
                fontSize: (portrait ? 3.8 : 3) * u,
                fontWeight: 700,
                color: palette.muted,
                ...fadeUp(sub, 3 * u),
              }}
            >
              {props.sublabel}
            </div>
          )}
        </div>
      </div>
      <Sfx at={countStart} name="click" />
      <Sfx at={countStart + countFrames} name="ding" />
    </AbsoluteFill>
  );
};
