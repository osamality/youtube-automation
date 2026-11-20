import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { CardProps, ChapterProps } from "../../schema";
import { clamp01, type SceneCtx, SMOOTH, springAt } from "../anim";
import { handFont } from "../fonts";
import { fitFont, useLayout } from "../layout";
import { Sfx } from "../Sfx";

const BLACK = "#0B0B0E";

/** A black card: one line written by hand while it is spoken. */
export const Card: React.FC<{ props: CardProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { portrait, u, width } = useLayout();
  const text = props.text;
  // Written at the pace of the voice, finishing a little before it does.
  const t = clamp01((frame - ctx.voiceStart) / Math.max(1, ctx.voiceFrames * 0.85));
  const shown = Math.ceil(t * text.length);
  const size = fitFont(text, (portrait ? 8.5 : 7.4) * u, portrait ? 26 : 44, 0.6);
  const hiStart = props.highlight ? text.indexOf(props.highlight) : -1;
  const hiEnd = hiStart >= 0 ? hiStart + (props.highlight?.length ?? 0) : -1;

  const parts: { text: string; hi: boolean; on: boolean }[] = [];
  const cut = (from: number, to: number, hi: boolean) => {
    if (to <= from) return;
    const split = Math.min(to, Math.max(from, shown));
    if (split > from) parts.push({ text: text.slice(from, split), hi, on: true });
    if (to > split) parts.push({ text: text.slice(split, to), hi, on: false });
  };
  if (hiStart >= 0) {
    cut(0, hiStart, false);
    cut(hiStart, hiEnd, true);
    cut(hiEnd, text.length, false);
  } else cut(0, text.length, false);

  return (
    <AbsoluteFill style={{ background: BLACK, alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          width: width * (portrait ? 0.84 : 0.72),
          fontFamily: handFont(),
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1.28,
          color: "#FFFFFF",
          textAlign: "center",
          transform: "rotate(-1deg)",
        }}
      >
        {parts.map((p, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed order
          <span key={i} style={{ opacity: p.on ? 1 : 0, color: p.hi ? "#FF4B36" : "#FFFFFF" }}>
            {p.text}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** A chapter opening in the paper look: number, title and a hand-drawn underline on black. */
export const ChapterCard: React.FC<{ props: ChapterProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, width } = useLayout();
  const s = springAt(frame, fps, ctx.enter, SMOOTH);
  const draw = clamp01((frame - ctx.enter - 8) / 18);
  const size = fitFont(props.title, (portrait ? 13 : 14) * u, portrait ? 12 : 18, 0.5);
  const lineW = Math.min(width * 0.7, props.title.length * size * 0.56);

  return (
    <AbsoluteFill style={{ background: BLACK, alignItems: "center", justifyContent: "center", fontFamily: handFont(), color: "#FFFFFF" }}>
      <div style={{ fontSize: 3.6 * u, fontWeight: 700, letterSpacing: "0.22em", color: "#FF4B36", opacity: s, transform: `translateY(${(1 - s) * 2 * u}px)` }}>
        {`PART ${props.number}`}
      </div>
      <div
        style={{
          marginTop: 1.4 * u,
          fontSize: size,
          fontWeight: 700,
          lineHeight: 1.05,
          textAlign: "center",
          maxWidth: width * 0.86,
          opacity: clamp01(s * 1.4),
          transform: `rotate(-1.5deg) scale(${0.92 + 0.08 * s})`,
        }}
      >
        {props.title}
      </div>
      <svg width={lineW} height={3 * u} viewBox="0 0 400 30" preserveAspectRatio="none" style={{ marginTop: 0.6 * u }}>
        <path d="M 6 18 Q 100 4 200 16 T 394 12" fill="none" stroke="#FF4B36" strokeWidth={7} strokeLinecap="round" strokeDasharray={420} strokeDashoffset={420 * (1 - draw)} />
      </svg>
      {props.year && <div style={{ marginTop: 1.6 * u, fontSize: 3.4 * u, fontWeight: 400, opacity: 0.7 * s }}>{props.year}</div>}
      <Sfx at={ctx.enter} name="boom" volume={0.6} />
    </AbsoluteFill>
  );
};
