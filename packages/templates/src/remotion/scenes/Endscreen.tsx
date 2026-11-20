import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { EndscreenProps } from "../../schema";
import { fadeUp, POP, type SceneCtx, SMOOTH, springAt } from "../anim";
import { handFont } from "../fonts";
import { useLayout } from "../layout";
import { Sfx } from "../Sfx";
import { alpha, useTheme } from "../theme";

/**
 * Where YouTube's end screen elements go, as fractions of the frame. The video box is 16:9;
 * UPLOAD.md tells the uploader to drag each element onto its space.
 */
export const ENDSCREEN_SLOTS = {
  /** 16:9 box for the "watch next" video (fractions of width, top as a fraction of height). */
  video: { left: 0.08, top: 0.34, width: 0.42 },
  /** Subscribe circle beside the video box, level with its middle. Diameter is a fraction of height. */
  subscribe: { cx: 0.72, diameter: 0.24 },
  /** Subscribe circle on its own, when there's no video to link yet. */
  subscribeAlone: { cx: 0.5, cy: 0.56, diameter: 0.3 },
} as const;

/** The last 20 seconds: a title, then empty spaces for the end screen's video and subscribe button. */
export const Endscreen: React.FC<{ props: EndscreenProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, height, u } = useLayout();
  const theme = useTheme();
  // Paper look: white hand lettering on black, like the cards.
  const palette = props.card
    ? { ...theme.palette, accent: "#FF4B36", accent2: "#FFD84A", text: "#FFFFFF" }
    : theme.palette;
  const showVideo = props.video !== false;

  const title = springAt(frame, fps, ctx.enter, SMOOTH);
  const boxIn = springAt(frame, fps, ctx.enter + 8, POP);
  const circleIn = springAt(frame, fps, ctx.enter + (showVideo ? 16 : 8), POP);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 9);
  const dash = (frame * 0.6) % 40;

  const v = ENDSCREEN_SLOTS.video;
  const box = { left: v.left * width, top: v.top * height, width: v.width * width };
  const boxH = (box.width * 9) / 16;
  const alone = ENDSCREEN_SLOTS.subscribeAlone;
  const slot = showVideo ? ENDSCREEN_SLOTS.subscribe : alone;
  const d = slot.diameter * height;
  const cx = slot.cx * width;
  const cy = showVideo ? box.top + boxH / 2 : alone.cy * height;

  return (
    <AbsoluteFill style={props.card ? { background: "#0B0B0E", color: "#FFFFFF", fontFamily: handFont() } : undefined}>
      <div
        style={{
          position: "absolute",
          left: 0,
          width,
          top: height * 0.12,
          textAlign: "center",
          ...fadeUp(title, 3 * u),
        }}
      >
        <div
          style={{
            fontSize: 2.4 * u,
            fontWeight: 800,
            letterSpacing: "0.18em",
            color: palette.accent2,
          }}
        >
          {showVideo ? "WATCH NEXT" : "THANKS FOR WATCHING"}
        </div>
        <div style={{ fontSize: 6.4 * u, fontWeight: 900, lineHeight: 1.1, marginTop: 1 * u }}>
          {props.title}
        </div>
      </div>

      {showVideo && (
        <svg
          width={box.width + 2 * u}
          height={boxH + 2 * u}
          style={{
            position: "absolute",
            left: box.left - u,
            top: box.top - u,
            opacity: boxIn,
            transform: `scale(${0.9 + 0.1 * boxIn})`,
            overflow: "visible",
          }}
        >
          <rect
            x={u}
            y={u}
            width={box.width}
            height={boxH}
            rx={1.6 * u}
            fill={alpha(palette.accent, 0.12)}
            stroke={palette.accent}
            strokeWidth={0.5 * u}
            strokeDasharray={`${2.4 * u} ${1.4 * u}`}
            strokeDashoffset={-dash}
            style={{ filter: `drop-shadow(0 0 ${2 * u}px ${alpha(palette.accent, 0.5)})` }}
          />
          <path
            d={`M ${u + box.width / 2 - 3 * u} ${u + boxH / 2 - 4 * u} l ${7.5 * u} ${4 * u} l ${-7.5 * u} ${4 * u} z`}
            fill={alpha(palette.text, 0.35)}
          />
        </svg>
      )}

      <div
        style={{
          position: "absolute",
          left: cx - d / 2,
          top: cy - d / 2,
          width: d,
          height: d,
          borderRadius: "50%",
          background: alpha(palette.accent2, 0.1),
          border: `${0.6 * u}px solid ${palette.accent2}`,
          boxShadow: `0 0 ${(2 + 2 * pulse) * u}px ${alpha(palette.accent2, 0.35 + 0.25 * pulse)}`,
          opacity: circleIn,
          transform: `scale(${(0.85 + 0.15 * circleIn) * (1 + 0.02 * pulse)})`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: cx - 20 * u,
          width: 40 * u,
          top: cy + d / 2 + 2 * u,
          textAlign: "center",
          fontSize: 2.8 * u,
          fontWeight: 800,
          letterSpacing: "0.08em",
          color: palette.text,
          opacity: circleIn,
        }}
      >
        SUBSCRIBE
      </div>

      {showVideo && <Sfx at={ctx.enter + 8} name="pop" />}
      <Sfx at={ctx.enter + (showVideo ? 16 : 8)} name="pop" />
    </AbsoluteFill>
  );
};
