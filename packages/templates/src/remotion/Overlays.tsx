import { useCurrentFrame, useVideoConfig } from "remotion";
import { isPaperScene, loudnessAt, sceneAt, type Timeline } from "../timeline";
import { springAt } from "./anim";
import { useLayout } from "./layout";
import { blinkAt, Robot } from "./Robot";
import { alpha, useTheme } from "./theme";

/** Scenes that fill the frame themselves: the corner mascot steps aside. */
const FULL_FRAME = new Set(["mascot", "place", "chapter", "endscreen", "photo", "document", "sketch", "card", "manga"]);

/** Scenes where a channel with mascot_corner: hooks shows its corner mascot. */
export const HOOK_SCENES: ReadonlySet<string> = new Set(["hook", "tip"]);

/**
 * Corner mascot that talks along with the narration. Steps aside during full-frame scenes, and
 * outside the `only` templates when that is given.
 */
export const MascotOverlay: React.FC<{ timeline: Timeline; only?: ReadonlySet<string> | null }> = ({
  timeline,
  only,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, width, height } = useLayout();

  // Average visibility over the last 8 frames → smooth hide/show around mascot scenes.
  let visible = 0;
  for (let k = 0; k < 8; k++) {
    const template = sceneAt(timeline, frame - k)?.scene.template ?? "";
    visible += FULL_FRAME.has(template) || (only && !only.has(template)) ? 0 : 1;
  }
  visible /= 8;
  const enter = springAt(frame, fps, 14, { damping: 11, stiffness: 140 });
  const shown = visible * enter;
  if (shown <= 0.01) return null;

  const talk = loudnessAt(timeline, frame);
  const talkSmooth = (talk + loudnessAt(timeline, frame - 2) + loudnessAt(timeline, frame - 4)) / 3;
  const size = portrait ? 20 * u : 17 * u;
  const bob = Math.sin(frame / 14) * 0.7 * u;

  const style: React.CSSProperties = portrait
    ? { left: 6 * u, top: height * 0.74 }
    : { left: width - size - 3 * u, top: height - size * 1.25 - 1.5 * u };

  return (
    <div
      style={{
        position: "absolute",
        ...style,
        transform: `translateY(${bob + (1 - shown) * 12 * u}px) rotate(${Math.sin(frame / 32) * 2}deg) scale(${0.6 + 0.4 * shown})`,
        transformOrigin: "bottom center",
        opacity: shown,
      }}
    >
      <Robot
        size={size}
        pose={{
          mouth: talk,
          blink: blinkAt(frame, 17),
          arm: 18 + talkSmooth * 55 * (0.6 + 0.4 * Math.sin(frame / 7)),
          glow: 0.5 + 0.5 * Math.sin(frame / 10),
        }}
      />
    </div>
  );
};

/** Thin progress bar along the top edge, plus the channel name (or current chapter) in landscape. */
export const Chrome: React.FC<{ timeline: Timeline; channelName: string }> = ({
  timeline,
  channelName,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, width } = useLayout();
  const { palette } = useTheme();
  const done = Math.min(1, frame / Math.max(1, timeline.durationInFrames - 1));
  const badge = springAt(frame, fps, 20, { damping: 200 });
  // Paper scenes are full pictures: nothing is laid over them.
  if (isPaperScene(sceneAt(timeline, frame)?.scene)) return null;

  // Long videos: the current chapter instead of the channel name, once the first chapter has started.
  let chapter: { number: number; title: string } | null = null;
  for (const s of timeline.scenes) {
    if (s.from > frame) break;
    if (s.scene.template === "chapter") chapter = { number: s.scene.props.number, title: s.scene.props.title };
  }

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          height: 0.55 * u,
          width,
          background: alpha(palette.text, 0.08),
        }}
      >
        <div
          style={{
            height: "100%",
            width: width * done,
            background: `linear-gradient(90deg, ${palette.accent}, ${palette.accent2})`,
          }}
        />
      </div>
      {!portrait && (
        <div
          style={{
            position: "absolute",
            left: 3 * u,
            top: 2.2 * u,
            display: "flex",
            alignItems: "center",
            gap: 1 * u,
            padding: `${0.5 * u}px ${1.6 * u}px ${0.5 * u}px ${1.2 * u}px`,
            borderRadius: 999,
            background: alpha(palette.bg, 0.55),
            fontSize: 1.9 * u,
            fontWeight: 700,
            letterSpacing: "0.04em",
            color: alpha(palette.text, 0.85),
            opacity: badge,
            transform: `translateX(${(1 - badge) * -3 * u}px)`,
          }}
        >
          <div
            style={{ width: 1 * u, height: 1 * u, borderRadius: "50%", background: palette.accent }}
          />
          {chapter ? (
            <span>
              <span style={{ color: palette.accent2, fontWeight: 900 }}>{chapter.number}</span>
              {"  "}
              {chapter.title}
            </span>
          ) : (
            channelName
          )}
        </div>
      )}
    </>
  );
};
