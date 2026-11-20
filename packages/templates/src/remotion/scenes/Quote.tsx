import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { QuoteProps } from "../../schema";
import { clamp01, type SceneCtx, SMOOTH, springAt } from "../anim";
import { Character, characterStates, deskColors } from "../Character";
import { fitFont, useLayout } from "../layout";
import { Cutout } from "../Photo";
import { Sfx } from "../Sfx";
import { usePhoto } from "../stage";
import { alpha, mix, useTheme } from "../theme";
import { beatFrames, talkLoudness } from "./Story";

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * When each word of `text` is spoken. Words are matched in order against the narration;
 * words the narrator doesn't say (or says differently) are spread between their neighbours.
 */
export function quoteWordTimes(text: string, ctx: SceneCtx): number[] {
  const words = text.split(/\s+/);
  const spoken = ctx.words.map((w) => ({ key: norm(w.text), start: w.start }));
  const found: (number | null)[] = [];
  let cursor = 0;
  for (const w of words) {
    const key = norm(w);
    let hit: number | null = null;
    for (let j = cursor; j < Math.min(spoken.length, cursor + 6); j++) {
      if (key && spoken[j]?.key === key) {
        hit = spoken[j]?.start ?? null;
        cursor = j + 1;
        break;
      }
    }
    found.push(hit);
  }
  // Nothing matched: reveal evenly over the voice.
  if (found.every((f) => f === null)) {
    return words.map((_, i) => ctx.voiceStart + Math.round((ctx.voiceFrames * 0.85 * i) / words.length));
  }
  const out: number[] = [];
  for (let i = 0; i < found.length; i++) {
    const f = found[i];
    if (f !== null && f !== undefined) {
      out.push(f);
      continue;
    }
    const prev = out[i - 1] ?? ctx.voiceStart;
    let k = i + 1;
    while (k < found.length && (found[k] === null || found[k] === undefined)) k++;
    const next = found[k] ?? prev + 6 * (k - i + 1);
    out.push(Math.round(prev + (next - prev) / (k - i + 1)));
  }
  for (let i = 1; i < out.length; i++) out[i] = Math.max(out[i] ?? 0, out[i - 1] ?? 0);
  return out;
}

/** A sourced quote on a card: words light up as the narrator reads them, the attribution slides in after. */
export const Quote: React.FC<{ props: QuoteProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();

  const photo = usePhoto(props.photo);
  const withPhoto = Boolean(props.photo) && !portrait;
  const withCharacter = Boolean(props.character) && !portrait && !withPhoto;
  const charH = content.height * 0.9;
  const charW = (charH * 200) / 280;
  const gap = 6 * u;
  const photoW = content.width * 0.34;
  const cardW = withCharacter
    ? Math.min(content.width - charW - gap, 96 * u)
    : withPhoto
      ? Math.min(content.width - photoW - gap, 96 * u)
      : Math.min(content.width, 130 * u);
  const photoIn = springAt(frame, fps, ctx.enter, { damping: 15, stiffness: 120 });
  const words = props.text.split(/\s+/);
  const times = quoteWordTimes(props.text, ctx);
  const hl = new Set((props.highlight ?? "").split(/\s+/).map(norm).filter(Boolean));
  const size = fitFont(props.text, portrait ? 6.4 * u : 5.4 * u, portrait ? 60 : 80, 0.62);
  const card = springAt(frame, fps, ctx.enter, { damping: 16, stiffness: 120 });
  const lastWord = times[times.length - 1] ?? ctx.enter;
  const byAt = Math.min(lastWord + 10, ctx.voiceStart + ctx.voiceFrames);
  const by = springAt(frame, fps, byAt, SMOOTH);
  const mark = springAt(frame, fps, ctx.enter + 4, { damping: 9, stiffness: 140 });

  const quoteCard = (
    <div
      style={{
        position: "relative",
        width: cardW,
        padding: portrait ? `${7 * u}px ${5 * u}px ${5 * u}px` : `${6 * u}px ${6 * u}px ${5 * u}px`,
        borderRadius: 4 * u,
        background: palette.surface,
        boxShadow: `0 ${1.6 * u}px ${6 * u}px ${alpha("#000000", palette.dark ? 0.4 : 0.14)}`,
        border: `${0.3 * u}px solid ${alpha(palette.accent, 0.35)}`,
        transform: `translateY(${(1 - card) * 8 * u}px) rotate(${(1 - card) * -2}deg)`,
        opacity: clamp01(card * 1.5),
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 3.4 * u,
          top: -6.4 * u,
          fontSize: 20 * u,
          lineHeight: 1,
          fontWeight: 900,
          fontFamily: "Georgia, serif",
          color: palette.accent,
          transform: `scale(${mark})`,
          transformOrigin: "left bottom",
          textShadow: `0 ${0.8 * u}px ${2 * u}px ${alpha(palette.accent, 0.4)}`,
        }}
      >
        “
      </div>
      <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.25, letterSpacing: "-0.01em" }}>
        {words.map((w, i) => {
          const t = times[i] ?? 0;
          const lit = clamp01((frame - t + 2) / 5);
          const hot = hl.has(norm(w));
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: words can repeat
              key={i}
              style={{
                color: hot && lit > 0 ? mix(palette.text, palette.accent2, lit) : palette.text,
                opacity: 0.22 + 0.78 * lit,
                textDecorationLine: hot && lit > 0.9 ? "underline" : "none",
                textDecorationColor: palette.accent2,
                textDecorationThickness: 0.4 * u,
                textUnderlineOffset: 0.6 * u,
              }}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 3 * u,
          display: "flex",
          alignItems: "center",
          gap: 1.6 * u,
          transform: `translateX(${(1 - by) * -4 * u}px)`,
          opacity: by,
        }}
      >
        <div style={{ width: 4 * u, height: 0.5 * u, background: palette.accent, borderRadius: u }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: (portrait ? 4 : 3.2) * u, fontWeight: 900 }}>{props.by}</div>
          {props.context && (
            <div style={{ fontSize: (portrait ? 3 : 2.4) * u, fontWeight: 700, color: palette.muted }}>{props.context}</div>
          )}
        </div>
      </div>
      <Sfx at={byAt} name="click" />
    </div>
  );

  const states = props.character ? characterStates(props.character, beatFrames(props.character, ctx)) : [];

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
          gap,
        }}
      >
        {portrait && props.photo && (
          <div
            style={{
              width: 30 * u,
              height: 30 * u,
              flex: "none",
              borderRadius: "50%",
              overflow: "hidden",
              background: `linear-gradient(160deg, ${mix(palette.accent2, "#FFFFFF", 0.3)}, ${palette.accent2})`,
              boxShadow: `0 0 0 ${0.8 * u}px #FFFFFF, 0 ${1.2 * u}px ${4 * u}px ${alpha("#000000", 0.2)}`,
              transform: `scale(${0.7 + 0.3 * photoIn})`,
              opacity: clamp01(photoIn * 2),
            }}
          >
            <Cutout photo={photo} width={30 * u} height={30 * u} faceWidth={0.5} faceY={0.45} />
          </div>
        )}
        {withPhoto && (
          <div
            style={{
              alignSelf: "stretch",
              flex: "none",
              borderRadius: 4 * u,
              overflow: "hidden",
              background: `linear-gradient(160deg, ${mix(palette.accent2, "#FFFFFF", 0.3)}, ${palette.accent2})`,
              boxShadow: `0 ${1.6 * u}px ${6 * u}px ${alpha("#000000", 0.18)}`,
              transform: `translateX(${(1 - photoIn) * -10 * u}px)`,
              opacity: clamp01(photoIn * 2),
            }}
          >
            <Cutout photo={photo} width={photoW} height={content.height} faceWidth={0.46} faceY={0.36} />
          </div>
        )}
        {withCharacter && props.character && (
          <div style={{ alignSelf: "flex-end", flex: "none" }}>
            <Character
              who={props.character.who}
              states={states}
              height={charH}
              loudness={talkLoudness(props.character, ctx, frame)}
              desk={deskColors(palette)}
            />
          </div>
        )}
        {quoteCard}
      </div>
    </AbsoluteFill>
  );
};
