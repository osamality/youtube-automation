import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { CharacterRef, StoryProps } from "../../schema";
import { BOUNCY, clamp01, POP, revealTimes, type SceneCtx, springAt } from "../anim";
import { Character, characterStates, deskColors } from "../Character";
import { Emoji } from "../Emoji";
import { Logo } from "../Logo";
import { useLayout } from "../layout";
import { Sfx } from "../Sfx";
import { alpha, mix, useTheme } from "../theme";

/** Frames when each beat of a character happens (keyword-synced). */
export function beatFrames(ch: CharacterRef, ctx: SceneCtx): { at: number; pose?: CharacterRef["pose"]; mood?: CharacterRef["mood"] }[] {
  const beats = ch.beats ?? [];
  const times = revealTimes(
    beats.map((b) => b.at),
    ctx,
    0.9,
  );
  return beats.map((b, i) => ({ ...b, at: times[i] ?? 0 }));
}

/** Mouth loudness for a talking character at a scene-local frame. */
export function talkLoudness(ch: CharacterRef, ctx: SceneCtx, frame: number): number {
  if (!ch.talking) return 0;
  return ctx.envelope[frame - ctx.voiceStart] ?? 0;
}

export const Bubble: React.FC<{
  text: string;
  kind: "speech" | "thought";
  at: number;
  /** Where the tail points. */
  tail: "left" | "right" | "bottom";
  fontSize: number;
  maxWidth: number;
}> = ({ text, kind, at, tail, fontSize, maxWidth }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette } = useTheme();
  const { u } = useLayout();
  const s = springAt(frame, fps, at, BOUNCY);
  const words = text.split(/\s+/);
  const shown = Math.ceil(clamp01((frame - at) / 16) * words.length);
  const r = kind === "thought" ? 6 * u : 3.2 * u;

  const tailStyle: React.CSSProperties =
    tail === "left"
      ? { left: -2.2 * u, top: "50%", borderWidth: `${1.6 * u}px ${2.4 * u}px ${1.6 * u}px 0`, borderColor: `transparent ${palette.surface} transparent transparent` }
      : tail === "right"
        ? { right: -2.2 * u, top: "50%", borderWidth: `${1.6 * u}px 0 ${1.6 * u}px ${2.4 * u}px`, borderColor: `transparent transparent transparent ${palette.surface}` }
        : { bottom: -2.2 * u, left: "50%", borderWidth: `${2.4 * u}px ${1.6 * u}px 0 ${1.6 * u}px`, borderColor: `${palette.surface} transparent transparent transparent` };

  return (
    <div
      style={{
        position: "relative",
        maxWidth,
        background: palette.surface,
        borderRadius: r,
        padding: `${2.6 * u}px ${3.4 * u}px`,
        boxShadow: `0 ${1.2 * u}px ${4 * u}px ${alpha("#1D2140", 0.16)}`,
        fontSize,
        fontWeight: 800,
        lineHeight: 1.22,
        transform: `scale(${0.6 + 0.4 * s})`,
        transformOrigin: tail === "left" ? "left center" : tail === "right" ? "right center" : "center bottom",
        opacity: clamp01(s * 2),
      }}
    >
      {kind === "speech" ? (
        <div style={{ position: "absolute", width: 0, height: 0, borderStyle: "solid", transform: tail === "bottom" ? "translateX(-50%)" : "translateY(-50%)", ...tailStyle }} />
      ) : (
        [1, 2].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: (2.4 - i * 0.7) * u,
              height: (2.4 - i * 0.7) * u,
              borderRadius: "50%",
              background: palette.surface,
              ...(tail === "left"
                ? { left: -i * 2.4 * u, top: `${60 + i * 8}%` }
                : tail === "right"
                  ? { right: -i * 2.4 * u, top: `${60 + i * 8}%` }
                  : { bottom: -i * 2.6 * u, left: `${50 - i * 4}%` }),
            }}
          />
        ))
      )}
      {words.map((w, i) => (
        <span key={`${i}-${w}`} style={{ opacity: i < shown ? 1 : 0 }}>
          {w}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
      <Sfx at={at} name="pop" />
    </div>
  );
};

export const Chip: React.FC<{
  text: string;
  emoji?: string;
  logo?: string;
  tone?: "positive" | "negative" | "neutral";
  at: number;
  fontSize: number;
}> = ({ text, emoji, logo, tone, at, fontSize }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { palette } = useTheme();
  const { u } = useLayout();
  const s = springAt(frame, fps, at, BOUNCY);
  const color = tone === "positive" ? palette.positive : tone === "negative" ? palette.negative : palette.accent;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1.4 * u,
        padding: `${1 * u}px ${2.6 * u}px ${1 * u}px ${emoji || logo ? 1.4 * u : 2.6 * u}px`,
        borderRadius: 999,
        background: mix(palette.surface, color, 0.12),
        border: `${0.45 * u}px solid ${color}`,
        color: mix(color, palette.text, 0.35),
        fontSize,
        fontWeight: 900,
        whiteSpace: "nowrap",
        boxShadow: `0 ${0.8 * u}px ${2.4 * u}px ${alpha(color, 0.25)}`,
        transform: `scale(${0.4 + 0.6 * s}) rotate(${(1 - s) * -8}deg)`,
        opacity: clamp01(s * 2),
      }}
    >
      {emoji && <Emoji name={emoji} size={fontSize * 1.5} />}
      {logo && !emoji && <Logo slug={logo} size={fontSize * 1.5} shadow={false} />}
      {text}
      <Sfx at={at} name="pop" volume={0.9} />
    </div>
  );
};

/** Spots around the character (fractions of its box) where flying props land. */
const PROP_SPOTS: [number, number][] = [
  [0.0, 0.1],
  [0.86, 0.04],
  [-0.04, 0.4],
  [0.94, 0.34],
  [0.2, -0.1],
  [0.7, -0.12],
];

export const Story: React.FC<{ props: StoryProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();

  const side = props.side ?? "left";
  const chips = props.chips ?? [];
  const flying = props.props ?? [];

  const bubbleAt = props.bubble
    ? (revealTimes([props.bubble.at ?? props.bubble.text], ctx, 0.3)[0] ?? ctx.enter + 8)
    : 0;
  const chipTimes = revealTimes(
    chips.map((c) => c.at ?? c.text),
    ctx,
    0.75,
  );
  const propTimes = revealTimes(
    flying.map((p) => p.at ?? p.emoji.replace(/-/g, " ")),
    ctx,
    0.8,
  );

  const hasPanel = Boolean(props.bubble) || chips.length > 0;
  const charH = portrait ? content.height * (hasPanel ? 0.6 : 0.85) : content.height;
  const charW = (charH * 200) / 280;
  const gap = (portrait ? 3 : 6) * u;
  const panelMax = portrait ? content.width : content.width - charW - gap;
  const enter = springAt(frame, fps, ctx.enter - 4, { damping: 16, stiffness: 110 });
  const states = characterStates(props.character, beatFrames(props.character, ctx));
  const textSize = portrait ? 4.6 * u : 4.2 * u;
  const chipSize = portrait ? 3.8 * u : 3.8 * u;
  const label = springAt(frame, fps, ctx.enter + 10, POP);

  const character = (
    <div
      style={{
        position: "relative",
        width: charW,
        height: charH,
        flex: "none",
        alignSelf: portrait ? "center" : "flex-end",
        transform: `translateY(${(1 - enter) * 12 * u}px)`,
        opacity: clamp01(enter * 1.5),
      }}
    >
      <Character
        who={props.character.who}
        states={states}
        height={charH}
        flip={!portrait && side === "right"}
        loudness={talkLoudness(props.character, ctx, frame)}
        desk={deskColors(palette)}
      />
      {props.label && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: charH * 0.035,
            transform: `translateX(-50%) scale(${0.7 + 0.3 * label})`,
            opacity: clamp01(label * 2),
            padding: `${0.6 * u}px ${2 * u}px`,
            borderRadius: 999,
            background: palette.text,
            color: palette.surface,
            fontSize: (portrait ? 2.8 : 2.4) * u,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          {props.label}
        </div>
      )}
      {flying.map((p, i) => {
        const at = propTimes[i] ?? 0;
        const s = springAt(frame, fps, at, BOUNCY);
        const [fx, fy] = PROP_SPOTS[i % PROP_SPOTS.length] as [number, number];
        const size = (portrait ? 11 : 9) * u;
        return (
          <div
            key={`${p.emoji}-${i}`}
            style={{
              position: "absolute",
              left: fx * charW - size / 2,
              top: fy * charH + Math.sin((frame + i * 17) / 14) * 1.2 * u - (1 - s) * 6 * u,
              transform: `scale(${s}) rotate(${Math.sin((frame + i * 23) / 20) * 10}deg)`,
              opacity: clamp01(s * 2),
              filter: `drop-shadow(0 ${0.8 * u}px ${1.2 * u}px ${alpha("#1D2140", 0.18)})`,
            }}
          >
            <Emoji name={p.emoji} size={size} />
            <Sfx at={at} name="pop" volume={0.7} />
          </div>
        );
      })}
    </div>
  );

  const panel = hasPanel ? (
    <div
      style={{
        maxWidth: panelMax,
        display: "flex",
        flexDirection: "column",
        alignItems: portrait ? "center" : side === "left" ? "flex-start" : "flex-end",
        gap: (portrait ? 2.6 : 3.2) * u,
      }}
    >
      {props.bubble && (
        <Bubble
          text={props.bubble.text}
          kind={props.bubble.kind ?? "speech"}
          at={bubbleAt}
          tail={portrait ? "bottom" : side === "left" ? "left" : "right"}
          fontSize={textSize}
          maxWidth={panelMax}
        />
      )}
      {chips.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: portrait ? "row" : "column",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: portrait ? "center" : side === "left" ? "flex-start" : "flex-end",
            gap: (portrait ? 1.6 : 2.2) * u,
          }}
        >
          {chips.map((c, i) => (
            <Chip
              key={`${c.text}-${i}`}
              text={c.text}
              emoji={c.emoji}
              logo={c.logo}
              tone={c.tone}
              at={chipTimes[i] ?? 0}
              fontSize={chipSize}
            />
          ))}
        </div>
      )}
    </div>
  ) : null;

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
          flexDirection: portrait ? "column" : side === "left" ? "row" : "row-reverse",
          alignItems: "center",
          justifyContent: portrait ? "space-between" : "center",
          gap,
        }}
      >
        {portrait ? panel : character}
        {portrait ? character : panel}
      </div>
    </AbsoluteFill>
  );
};
