import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { PhotoProps } from "../../schema";
import { clamp01, type SceneCtx, springAt } from "../anim";
import { useLayout } from "../layout";
import { NameTag, PhotoFill, phraseTime, Stamp } from "../Photo";
import { usePhoto } from "../stage";
import { alpha, useTheme } from "../theme";

/**
 * A real photo. Wide photos fill the frame with a slow push towards the face and a lower-third name tag.
 * Tall photos (in landscape) sit in a white frame on the right, with the name large on the left.
 */
export const PhotoScene: React.FC<{ props: PhotoProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, width, height, content } = useLayout();
  const { palette } = useTheme();
  const photo = usePhoto(props.photo);
  const t = Easing.inOut(Easing.sin)(clamp01(frame / Math.max(1, ctx.duration)));
  const filter = props.mono ? "grayscale(1) contrast(1.08)" : undefined;
  const stampAt = props.stamp
    ? phraseTime(props.stamp.at ?? props.stamp.text, ctx, ctx.voiceStart + Math.round(ctx.voiceFrames * 0.55))
    : 0;
  const tagAt = ctx.enter + 8;
  const wide = photo ? photo.width / photo.height >= 1.25 : true;

  if (portrait || wide) {
    // Full frame: push in from 1.0 to 1.14 while the view settles on the face.
    return (
      <AbsoluteFill style={{ background: "#0B0D14" }}>
        <PhotoFill
          photo={photo}
          width={width}
          height={height}
          zoom={1 + 0.14 * t}
          pull={0.35 + 0.65 * t}
          target={{ x: 0.5, y: portrait ? 0.3 : 0.38 }}
          filter={filter}
        />
        <AbsoluteFill
          style={{
            background: `linear-gradient(to top, ${alpha("#000000", 0.55)} 0%, transparent 38%)`,
          }}
        />
        {props.caption && (
          <Caption text={props.caption} at={tagAt} style={{ right: 4 * u, top: (portrait ? 12 : 4) * u }} />
        )}
        {props.name && (
          <div
            style={{
              position: "absolute",
              left: 5 * u,
              top: portrait ? height * 0.5 : undefined,
              bottom: portrait ? undefined : height * 0.2,
            }}
          >
            <NameTag name={props.name} role={props.role} at={tagAt} accent={palette.accent} />
          </div>
        )}
        {props.stamp && (
          <div style={{ position: "absolute", left: 0, right: 0, top: height * (portrait ? 0.2 : 0.3), textAlign: "center" }}>
            <Stamp text={props.stamp.text} at={stampAt} size={(portrait ? 9 : 8) * u} />
          </div>
        )}
      </AbsoluteFill>
    );
  }

  // Tall photo in landscape: framed print on the right, name on the left.
  const frameH = content.height * 1.08;
  const frameW = Math.min(frameH * (photo ? photo.width / photo.height : 0.75), width * 0.42);
  const enter = springAt(frame, fps, ctx.enter, { damping: 15, stiffness: 120 });
  const tilt = interpolate(enter, [0, 1], [7, 2]);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          right: 9 * u,
          top: content.top + (content.height - frameH) / 2 + 1.5 * u,
          padding: 1.3 * u,
          background: "#FFFFFF",
          borderRadius: 0.8 * u,
          boxShadow: `0 ${2 * u}px ${6 * u}px ${alpha("#000000", 0.22)}`,
          transform: `translateY(${(1 - enter) * 30 * u}px) rotate(${tilt}deg)`,
          opacity: clamp01(enter * 2),
        }}
      >
        <PhotoFill photo={photo} width={frameW} height={frameH} zoom={1 + 0.1 * t} pull={0.4 + 0.6 * t} filter={filter} />
      </div>
      <div
        style={{
          position: "absolute",
          left: content.left + 2 * u,
          top: content.top,
          width: width - frameW - 26 * u - content.left,
          height: content.height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 2.4 * u,
        }}
      >
        {props.name && <NameTag name={props.name} role={props.role} at={tagAt} accent={palette.accent} size={6 * u} />}
        {props.caption && <Caption text={props.caption} at={tagAt + 10} inline />}
      </div>
      {props.stamp && (
        <div style={{ position: "absolute", right: 9 * u + frameW / 2 - 18 * u, top: height * 0.55 }}>
          <Stamp text={props.stamp.text} at={stampAt} size={7 * u} />
        </div>
      )}
    </AbsoluteFill>
  );
};

/** A small dark tag with white text: place, date or source. */
const Caption: React.FC<{ text: string; at: number; style?: React.CSSProperties; inline?: boolean }> = ({
  text,
  at,
  style,
  inline,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  const p = springAt(frame, fps, at, { damping: 200 });
  return (
    <div
      style={{
        position: inline ? "relative" : "absolute",
        alignSelf: "flex-start",
        background: alpha("#0B0D14", 0.78),
        color: "#FFFFFF",
        fontWeight: 700,
        fontSize: 2.4 * u,
        padding: `${0.7 * u}px ${1.4 * u}px`,
        borderRadius: 0.8 * u,
        opacity: p,
        transform: `translateY(${(1 - p) * 2 * u}px)`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};
