import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { TipProps } from "../../schema";
import { BOUNCY, clamp01, fadeUp, revealTimes, type SceneCtx, SMOOTH, springAt } from "../anim";
import { Character, characterStates, deskColors } from "../Character";
import { Emoji } from "../Emoji";
import { fitFont, useLayout } from "../layout";
import { Sfx } from "../Sfx";
import { alpha, mix, useTheme } from "../theme";
import { beatFrames, talkLoudness } from "./Story";

/** One numbered tip: big number badge, title, short text, a large floating 3D emoji. */
export const Tip: React.FC<{ props: TipProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();
  const pops = palette.pops ?? [palette.accent, palette.accent2];
  const ringColor = pops[props.number % pops.length] ?? palette.accent;

  const badgeAt = ctx.enter + 2;
  const titleAt = ctx.enter + 10;
  const emojiAt = ctx.enter + 6;
  const textAt = props.text
    ? Math.max(titleAt + 14, revealTimes([props.text], ctx, 0.35)[0] ?? titleAt + 14)
    : 0;

  const badge = springAt(frame, fps, badgeAt, BOUNCY);
  const title = springAt(frame, fps, titleAt, SMOOTH);
  const text = springAt(frame, fps, textAt, SMOOTH);
  const em = springAt(frame, fps, emojiAt, BOUNCY);

  const withCharacter = Boolean(props.character) && !portrait;
  const charH = content.height;
  const charW = (charH * 200) / 280;
  const states = props.character ? characterStates(props.character, beatFrames(props.character, ctx)) : [];

  const emojiSize = portrait ? 36 * u : withCharacter ? 28 * u : 36 * u;
  const textColW = portrait ? content.width : withCharacter ? content.width * 0.42 : content.width * 0.54;
  const titleSize = fitFont(props.title, portrait ? 7 * u : 5.8 * u, 24, 0.6);
  const label = (props.label ?? "Tip").toUpperCase();

  const emojiBlock = (
    <div
      style={{
        position: "relative",
        width: emojiSize * 1.25,
        height: emojiSize * 1.25,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${em}) translateY(${Math.sin(frame / 14) * 1.4 * u}px) rotate(${Math.sin(frame / 22) * 5}deg)`,
        flex: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${alpha(ringColor, 0.3)} 0%, ${alpha(ringColor, 0.12)} 55%, transparent 70%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: emojiSize * 0.08,
          borderRadius: "50%",
          border: `${0.5 * u}px dashed ${alpha(ringColor, 0.55)}`,
          transform: `rotate(${frame * 0.6}deg)`,
        }}
      />
      <Emoji
        name={props.emoji}
        size={emojiSize}
        style={{ filter: `drop-shadow(0 ${1.6 * u}px ${2 * u}px ${alpha("#1D2140", 0.22)})` }}
      />
    </div>
  );

  const textBlock = (
    <div
      style={{
        width: textColW,
        display: "flex",
        flexDirection: "column",
        alignItems: portrait ? "center" : "flex-start",
        textAlign: portrait ? "center" : "left",
        gap: 2.2 * u,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 1.6 * u,
          transform: `scale(${0.4 + 0.6 * badge}) rotate(${(1 - badge) * -12}deg)`,
          transformOrigin: portrait ? "center" : "left center",
          opacity: clamp01(badge * 2),
        }}
      >
        <div
          style={{
            padding: `${0.8 * u}px ${2.2 * u}px`,
            borderRadius: 999,
            background: palette.text,
            color: palette.surface,
            fontSize: (portrait ? 3.4 : 2.8) * u,
            fontWeight: 900,
            letterSpacing: "0.08em",
          }}
        >
          {label}
        </div>
        <div
          style={{
            width: (portrait ? 11 : 9.5) * u,
            height: (portrait ? 11 : 9.5) * u,
            borderRadius: "50%",
            background: palette.accent,
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: (portrait ? 6.4 : 5.6) * u,
            fontWeight: 900,
            boxShadow: `0 ${0.8 * u}px 0 ${mix(palette.accent, "#000000", 0.25)}`,
          }}
        >
          {props.number}
        </div>
      </div>
      <div style={{ fontSize: titleSize, fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.015em", ...fadeUp(title, 3 * u) }}>
        {props.title}
      </div>
      {props.text && (
        <div
          style={{
            fontSize: (portrait ? 3.6 : 3.1) * u,
            fontWeight: 700,
            lineHeight: 1.35,
            color: palette.muted,
            maxWidth: textColW,
            ...fadeUp(text, 2 * u),
          }}
        >
          {props.text}
        </div>
      )}
    </div>
  );

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: content.left,
          top: content.top,
          width: withCharacter ? content.width - charW : content.width,
          height: content.height,
          display: "flex",
          flexDirection: portrait ? "column" : "row",
          alignItems: "center",
          justifyContent: portrait ? "center" : "space-around",
          gap: (portrait ? 3 : 4) * u,
        }}
      >
        {portrait ? emojiBlock : textBlock}
        {portrait ? textBlock : emojiBlock}
      </div>

      {withCharacter && props.character && (
        <div
          style={{
            position: "absolute",
            left: content.left + content.width - charW,
            top: content.top + content.height - charH,
          }}
        >
          <Character
            who={props.character.who}
            states={states}
            height={charH}
            flip
            loudness={talkLoudness(props.character, ctx, frame)}
            desk={deskColors(palette)}
          />
        </div>
      )}

      <Sfx at={badgeAt} name="ding" />
      <Sfx at={emojiAt} name="pop" />
      {props.text ? <Sfx at={textAt} name="click" volume={0.6} /> : null}
    </AbsoluteFill>
  );
};
