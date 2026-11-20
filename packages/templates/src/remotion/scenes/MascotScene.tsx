import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { MascotProps } from "../../schema";
import { clamp01, type SceneCtx, springAt } from "../anim";
import { fitFont, useLayout } from "../layout";
import { blinkAt, Robot } from "../Robot";
import { alpha, useTheme } from "../theme";

/** The mascot, large, saying a line in a speech bubble that types along with the voice. */
export const MascotScene: React.FC<{ props: MascotProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();

  const talk = ctx.envelope[frame - ctx.voiceStart] ?? 0;
  const enter = springAt(frame, fps, ctx.enter, { damping: 11, stiffness: 130 });
  const bubbleIn = springAt(frame, fps, ctx.enter + 8, { damping: 13, stiffness: 160 });
  const typedShare = clamp01((frame - ctx.voiceStart) / Math.max(1, ctx.voiceFrames * 0.85));
  const typed = Math.floor(props.text.length * typedShare);
  const waving = frame - ctx.enter < 40;
  const arm = waving ? 115 + 22 * Math.sin(frame / 3.5) : 25 + talk * 50;

  const robotSize = portrait ? 40 * u : 34 * u;
  const fontSize = fitFont(props.text, portrait ? 6 * u : 5 * u, 60);

  const robot = (
    <div
      style={{
        transform: `translateY(${(1 - enter) * 20 * u + Math.sin(frame / 14) * u}px) scale(${0.7 + 0.3 * enter})`,
        opacity: clamp01(enter * 1.5),
      }}
    >
      <Robot
        size={robotSize}
        pose={{ mouth: talk, blink: blinkAt(frame, 41), arm, glow: 0.5 + 0.5 * Math.sin(frame / 8) }}
      />
    </div>
  );

  const tailSize = 3 * u;
  const bubble = (
    <div
      style={{
        position: "relative",
        maxWidth: portrait ? content.width : content.width * 0.58,
        padding: `${3.6 * u}px ${4.2 * u}px`,
        borderRadius: 4 * u,
        background: palette.surface,
        border: `${0.3 * u}px solid ${alpha(palette.accent, 0.55)}`,
        boxShadow: `0 ${1.5 * u}px ${5 * u}px ${alpha("#000000", 0.3)}`,
        fontSize,
        fontWeight: 800,
        lineHeight: 1.22,
        transform: `scale(${0.6 + 0.4 * bubbleIn})`,
        transformOrigin: portrait ? "bottom center" : "left center",
        opacity: clamp01(bubbleIn * 1.5),
      }}
    >
      <div
        style={{
          position: "absolute",
          width: tailSize,
          height: tailSize,
          background: palette.surface,
          borderLeft: `${0.3 * u}px solid ${alpha(palette.accent, 0.55)}`,
          borderBottom: `${0.3 * u}px solid ${alpha(palette.accent, 0.55)}`,
          ...(portrait
            ? { left: "50%", bottom: -tailSize / 2, transform: "translateX(-50%) rotate(-45deg)" }
            : { left: -tailSize / 2, top: "50%", transform: "translateY(-50%) rotate(45deg)" }),
        }}
      />
      <span>{props.text.slice(0, typed)}</span>
      <span style={{ opacity: 0 }}>{props.text.slice(typed)}</span>
    </div>
  );

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
          gap: (portrait ? 5 : 6) * u,
        }}
      >
        {portrait ? bubble : robot}
        {portrait ? robot : bubble}
      </div>
    </AbsoluteFill>
  );
};
