import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { HeadlineProps } from "../../schema";
import { clamp01, type SceneCtx, springAt } from "../anim";
import { serifFont } from "../fonts";
import { fitFont, useLayout } from "../layout";
import { Logo } from "../Logo";
import { CartoonBust, Highlighted, PhotoFill, phraseTime } from "../Photo";
import { Sfx } from "../Sfx";
import { usePhoto } from "../stage";
import { alpha, mix, useTheme } from "../theme";
import { beatFrames } from "./Story";

const PAPER = "#FFFDF7";
const INK = "#16181F";

/** A newspaper clipping slides in; a pinned photo drops beside it; the highlighter sweeps as it is read. */
export const Headline: React.FC<{ props: HeadlineProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, width, content } = useLayout();
  const photo = usePhoto(props.photo);
  const { palette } = useTheme();
  const hasPin = Boolean(props.photo || props.logo || props.character);

  const card = springAt(frame, fps, ctx.enter, { damping: 16, stiffness: 110 });
  const pinAt = ctx.enter + 9;
  const pin = springAt(frame, fps, pinAt, { damping: 11, stiffness: 150 });
  const inExcerpt = Boolean(props.highlight && props.excerpt?.includes(props.highlight));
  const hlAt = props.highlight
    ? phraseTime(props.highlight, ctx, ctx.voiceStart + Math.round(ctx.voiceFrames * 0.4))
    : 0;
  // A slow drift so the still page keeps moving.
  const drift = interpolate(frame, [0, ctx.duration], [0, 1]);

  const cardW = portrait ? content.width : hasPin ? width * 0.56 : Math.min(content.width, 120 * u);
  const headSize = fitFont(props.headline, portrait ? 5.6 * u : 5.4 * u, portrait ? 44 : 64, 0.6);
  const excerptSize = portrait ? 3.1 * u : 2.9 * u;

  const clipping = (
    <div
      style={{
        width: cardW,
        padding: portrait ? `${3.4 * u}px ${3.8 * u}px` : `${4 * u}px ${4.4 * u}px ${4.4 * u}px`,
        background: PAPER,
        color: INK,
        borderRadius: 0.6 * u,
        boxShadow: `0 ${1.8 * u}px ${5 * u}px ${alpha("#000000", 0.22)}, inset 0 0 ${6 * u}px ${alpha("#C8B88A", 0.18)}`,
        transform: `translateX(${(1 - card) * -60 * u}px) rotate(${-1.6 + (1 - card) * -5 + drift * 0.4}deg)`,
        opacity: clamp01(card * 2),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 2 * u,
          borderBottom: `${0.25 * u}px solid ${INK}`,
          paddingBottom: 1.2 * u,
          marginBottom: 2.2 * u,
        }}
      >
        <div style={{ fontFamily: serifFont(), fontWeight: 900, fontSize: (portrait ? 4 : 3.3) * u }}>{props.outlet}</div>
        {props.date && <div style={{ fontWeight: 700, fontSize: (portrait ? 2.8 : 2.2) * u, color: "#6B6F7E" }}>{props.date}</div>}
      </div>
      <div style={{ fontFamily: serifFont(), fontWeight: 800, fontSize: headSize, lineHeight: 1.16, letterSpacing: "-0.01em" }}>
        <Highlighted text={props.headline} passage={inExcerpt ? undefined : props.highlight} at={hlAt} />
      </div>
      {props.excerpt && (
        <div style={{ marginTop: 2.4 * u, fontSize: excerptSize, fontWeight: 500, lineHeight: 1.55, color: "#2B2E38" }}>
          <Highlighted text={props.excerpt} passage={inExcerpt ? props.highlight : undefined} at={hlAt} />
        </div>
      )}
    </div>
  );

  const pinW = portrait ? content.width * 0.42 : width * 0.27;
  const pinH = pinW * (photo || props.character ? (portrait ? 0.8 : 0.9) : 0.7);
  const pinned = hasPin && (
    <div
      style={{
        position: "relative",
        padding: `${1.2 * u}px ${1.2 * u}px ${4.2 * u}px`,
        background: "#FFFFFF",
        boxShadow: `0 ${1.6 * u}px ${4.5 * u}px ${alpha("#000000", 0.25)}`,
        transform: `translateY(${(1 - pin) * -40 * u}px) rotate(${4 - drift * 0.6}deg)`,
        opacity: clamp01(pin * 2),
        flex: "none",
      }}
    >
      {props.character ? (
        <CartoonBust
          character={props.character}
          beats={beatFrames(props.character, ctx)}
          width={pinW}
          height={pinH}
          background={`linear-gradient(160deg, ${mix(palette.accent2, "#FFFFFF", 0.45)}, ${palette.accent2})`}
        />
      ) : photo ? (
        <PhotoFill photo={photo} width={pinW} height={pinH} zoom={1.05 + 0.05 * drift} />
      ) : (
        <div style={{ width: pinW, height: pinH, display: "flex", alignItems: "center", justifyContent: "center", background: "#F3F4F7" }}>
          {props.logo && <Logo slug={props.logo} size={pinH * 0.5} />}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: -1.4 * u,
          width: 3.2 * u,
          height: 3.2 * u,
          marginLeft: -1.6 * u,
          borderRadius: "50%",
          background: "radial-gradient(circle at 35% 35%, #FF7A7A, #C81E1E 60%, #8E1010)",
          boxShadow: `0 ${0.5 * u}px ${0.8 * u}px ${alpha("#000000", 0.35)}`,
        }}
      />
      <Sfx at={pinAt} name="pop" />
    </div>
  );

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: content.left,
          top: content.top - (portrait ? 0 : 1.5 * u),
          width: content.width,
          height: content.height + (portrait ? 0 : 3 * u),
          display: "flex",
          flexDirection: portrait ? "column-reverse" : "row",
          alignItems: "center",
          justifyContent: "center",
          gap: (portrait ? 3 : 5) * u,
        }}
      >
        {clipping}
        {pinned}
      </div>
    </AbsoluteFill>
  );
};
