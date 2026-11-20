import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { ChatProps } from "../../schema";
import { clamp01, POP, revealTimes, type SceneCtx, SMOOTH, springAt } from "../anim";
import { Character, characterStates, deskColors } from "../Character";
import { Emoji } from "../Emoji";
import { useLayout } from "../layout";
import { Sfx } from "../Sfx";
import { alpha, mix, useTheme } from "../theme";
import { beatFrames, talkLoudness } from "./Story";

const TYPING_FRAMES = 16;

/** A phone chat that plays out message by message, scrolling when it overflows. */
export const Chat: React.FC<{ props: ChatProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();

  const withCharacter = Boolean(props.character) && !portrait;
  const phoneH = content.height * (portrait ? 1 : 1.02);
  const phoneW = phoneH * (portrait ? 0.6 : 0.62);
  const charH = content.height;
  const charW = (charH * 200) / 280;
  const phoneLeft = withCharacter
    ? content.left + charW + (content.width - charW - phoneW) / 2
    : content.left + (content.width - phoneW) / 2;
  const phoneTop = content.top + (content.height - phoneH) / 2;

  const font = phoneW * 0.066;
  const bezel = phoneW * 0.035;
  const screenW = phoneW - bezel * 2;
  const headerH = phoneW * 0.2;
  const pad = phoneW * 0.045;
  const gap = font * 0.55;
  const bubbleMax = screenW * 0.78;

  // First message waits for the phone to land; the rest follow the narration.
  const raw = revealTimes(
    props.messages.map((m) => m.at ?? m.text),
    ctx,
    0.85,
  );
  const times = raw.map((t, i) => Math.max(t, ctx.enter + 14 + i * 8) + (props.messages[i]?.from === "them" ? TYPING_FRAMES : 0));

  // Estimated bubble heights → how far the thread has to scroll.
  const heights = props.messages.map((m) => {
    const perLine = Math.max(8, Math.floor((bubbleMax - font * 1.6) / (font * 0.52)));
    const lines = Math.ceil(m.text.length / perLine);
    return lines * font * 1.28 + font * 1.1 + gap;
  });
  const visible = phoneH - bezel * 2 - headerH - pad * 2;
  let scroll = 0;
  let total = 0;
  props.messages.forEach((_, i) => {
    total += heights[i] ?? 0;
    const typingNext = props.messages[i + 1]?.from === "them" ? font * 2.6 : 0;
    const need = Math.max(0, total + typingNext - visible);
    const at = times[i] ?? 0;
    scroll = Math.max(scroll, need * springAt(frame, fps, at, SMOOTH));
  });

  const phoneIn = springAt(frame, fps, ctx.enter, { damping: 15, stiffness: 120 });
  const states = props.character ? characterStates(props.character, beatFrames(props.character, ctx)) : [];

  return (
    <AbsoluteFill>
      {withCharacter && props.character && (
        <div style={{ position: "absolute", left: content.left + u, top: content.top + content.height - charH }}>
          <Character
            who={props.character.who}
            states={states}
            height={charH}
            loudness={talkLoudness(props.character, ctx, frame)}
            desk={deskColors(palette)}
          />
        </div>
      )}

      <div
        style={{
          position: "absolute",
          left: phoneLeft,
          top: phoneTop,
          width: phoneW,
          height: phoneH,
          borderRadius: phoneW * 0.12,
          background: "#1D2140",
          padding: bezel,
          boxShadow: `0 ${2 * u}px ${6 * u}px ${alpha("#1D2140", 0.3)}`,
          transform: `translateY(${(1 - phoneIn) * 30 * u}px) rotate(${(1 - phoneIn) * 6}deg)`,
          opacity: clamp01(phoneIn * 2),
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            borderRadius: phoneW * 0.09,
            background: "#F3F5FA",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: headerH,
              background: palette.surface,
              display: "flex",
              alignItems: "center",
              gap: font * 0.6,
              padding: `${headerH * 0.18}px ${pad}px 0`,
              boxShadow: `0 1px 0 ${alpha("#1D2140", 0.08)}`,
              zIndex: 2,
            }}
          >
            <div
              style={{
                width: headerH * 0.5,
                height: headerH * 0.5,
                borderRadius: "50%",
                background: mix(palette.surface, palette.accent, 0.15),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {props.avatar ? <Emoji name={props.avatar} size={headerH * 0.4} /> : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: font * 1.05, fontWeight: 900, color: palette.text }}>{props.title}</div>
              <div style={{ fontSize: font * 0.7, fontWeight: 700, color: palette.positive }}>online</div>
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              left: pad,
              right: pad,
              top: headerH + pad - scroll,
              display: "flex",
              flexDirection: "column",
              gap,
            }}
          >
            {props.messages.map((m, i) => {
              const at = times[i] ?? 0;
              const me = m.from === "me";
              const s = springAt(frame, fps, at, POP);
              const typingFrom = at - TYPING_FRAMES;
              const typing = !me && frame >= typingFrom && frame < at;
              if (frame < (me ? at : typingFrom)) return null;
              return (
                <div key={`${i}-${m.text}`} style={{ display: "flex", justifyContent: me ? "flex-end" : "flex-start" }}>
                  {typing ? (
                    <div
                      style={{
                        padding: `${font * 0.55}px ${font * 0.8}px`,
                        borderRadius: font * 1.1,
                        background: palette.surface,
                        display: "flex",
                        gap: font * 0.3,
                      }}
                    >
                      {[0, 1, 2].map((d) => (
                        <div
                          key={d}
                          style={{
                            width: font * 0.42,
                            height: font * 0.42,
                            borderRadius: "50%",
                            background: palette.muted,
                            opacity: 0.4 + 0.6 * Math.max(0, Math.sin((frame - d * 3) / 2.5)),
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        maxWidth: bubbleMax,
                        padding: `${font * 0.5}px ${font * 0.8}px`,
                        borderRadius: font * 1.05,
                        borderBottomRightRadius: me ? font * 0.25 : font * 1.05,
                        borderBottomLeftRadius: me ? font * 1.05 : font * 0.25,
                        background: me ? palette.accent : palette.surface,
                        color: me ? "#FFFFFF" : palette.text,
                        fontSize: font,
                        fontWeight: 700,
                        lineHeight: 1.28,
                        boxShadow: `0 ${font * 0.12}px ${font * 0.4}px ${alpha("#1D2140", 0.08)}`,
                        transform: `scale(${0.6 + 0.4 * s})`,
                        transformOrigin: me ? "right bottom" : "left bottom",
                        opacity: clamp01(s * 2),
                      }}
                    >
                      {m.text}
                    </div>
                  )}
                  <Sfx at={at} name={me ? "pop" : "notify"} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
