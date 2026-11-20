import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChapterProps } from "../../schema";
import { BOUNCY, clamp01, type SceneCtx, SMOOTH, springAt } from "../anim";
import { Emoji } from "../Emoji";
import { fitFont, useLayout } from "../layout";
import { Logo } from "../Logo";
import { Sfx } from "../Sfx";
import { alpha, useTheme } from "../theme";

/** Chapter card: a colour wipe, a huge drifting year, the chapter number and a title that rises word by word. */
export const Chapter: React.FC<{ props: ChapterProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, width, height, content } = useLayout();
  const { palette } = useTheme();

  const start = Math.max(0, ctx.enter - 6);
  const wipe = interpolate(frame, [start, start + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const pill = springAt(frame, fps, start + 8, BOUNCY);
  const icon = springAt(frame, fps, start + 4, BOUNCY);
  const rule = springAt(frame, fps, start + 22, SMOOTH);
  const titleAt = start + 12;
  const words = props.title.split(/\s+/);
  const titleSize = fitFont(props.title, portrait ? 10 * u : 8.6 * u, portrait ? 16 : 26, 0.6);
  const yearSize = portrait ? 34 * u : 42 * u;
  const drift = -frame * 0.12 * u;
  const iconSize = portrait ? 20 * u : 16 * u;
  const float = Math.sin(frame / 16) * 1.2 * u;

  return (
    <AbsoluteFill>
      {props.year && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: content.top + content.height * (portrait ? 0.3 : 0.5),
            transform: `translate(${drift + (1 - wipe) * 20 * u}px, -50%)`,
            textAlign: "center",
            fontSize: yearSize,
            fontWeight: 900,
            letterSpacing: "-0.04em",
            lineHeight: 1,
            whiteSpace: "nowrap",
            color: "transparent",
            WebkitTextStroke: `${0.25 * u}px ${alpha(palette.text, 0.16)}`,
            opacity: wipe,
          }}
        >
          {props.year}
        </div>
      )}

      {/* Two colour bands sweep across the screen like a page turn. */}
      {[palette.accent, palette.accent2].map((color, i) => {
        // The skew pushes the band's corners sideways, so travel further on tall frames.
        const reach = 1.1 + (height / width) * 0.25;
        const p = interpolate(frame, [start + i * 3, start + 16 + i * 3], [-reach, reach], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.inOut(Easing.cubic),
        });
        return (
          <div
            key={color}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width,
              height,
              background: color,
              opacity: 0.92,
              transform: `translateX(${p * width}px) skewX(-12deg)`,
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          left: content.left,
          top: content.top,
          width: content.width,
          height: content.height,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: (portrait ? 3.4 : 2.6) * u,
          textAlign: "center",
        }}
      >
        {(props.emoji || props.logo) && (
          <div
            style={{
              transform: `translateY(${float}px) scale(${icon}) rotate(${(1 - icon) * -25}deg)`,
              opacity: clamp01(icon * 2),
              filter: `drop-shadow(0 ${1.2 * u}px ${2 * u}px ${alpha("#000000", 0.3)})`,
            }}
          >
            {props.emoji ? (
              <Emoji name={props.emoji} size={iconSize} />
            ) : (
              <Logo slug={props.logo ?? ""} size={iconSize * 0.85} />
            )}
          </div>
        )}
        <div
          style={{
            padding: `${0.8 * u}px ${2.6 * u}px`,
            borderRadius: 999,
            background: palette.accent,
            color: "#FFFFFF",
            fontSize: (portrait ? 3.4 : 2.6) * u,
            fontWeight: 900,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            transform: `scale(${0.5 + 0.5 * pill})`,
            opacity: clamp01(pill * 2),
            boxShadow: `0 ${0.8 * u}px ${2.6 * u}px ${alpha(palette.accent, 0.45)}`,
          }}
        >
          Chapter {props.number}
        </div>
        <div
          style={{
            fontSize: titleSize,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            maxWidth: content.width * (portrait ? 1 : 0.86),
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            columnGap: titleSize * 0.26,
          }}
        >
          {words.map((w, i) => {
            const s = springAt(frame, fps, titleAt + i * 3, { damping: 14, stiffness: 140 });
            return (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: words can repeat
                key={i}
                style={{
                  display: "inline-block",
                  transform: `translateY(${(1 - s) * 4 * u}px)`,
                  opacity: clamp01(s * 1.6),
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
        <div
          style={{
            height: 0.6 * u,
            width: rule * (portrait ? 24 : 18) * u,
            borderRadius: u,
            background: `linear-gradient(90deg, ${palette.accent}, ${palette.accent2})`,
          }}
        />
      </div>
      <Sfx at={titleAt} name="boom" volume={0.8} />
      <Sfx at={start + 8} name="sparkle" volume={0.6} />
    </AbsoluteFill>
  );
};
