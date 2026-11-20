import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { PlaceProps } from "../../schema";
import { BOUNCY, clamp01, POP, revealTimes, type SceneCtx, SMOOTH, springAt } from "../anim";
import { FLOOR_Y, PLACE_ART, VIEW_H, VIEW_W } from "../Backdrops";
import { Character, characterStates } from "../Character";
import { Emoji } from "../Emoji";
import { Icon } from "../Icon";
import { useLayout } from "../layout";
import { Sfx } from "../Sfx";
import { alpha, mix, useTheme } from "../theme";
import { beatFrames, Bubble, talkLoudness } from "./Story";

/** Character desk height as a share of the character box (Character.tsx draws it at y 244–280 of 280). */
const DESK_TOP = 244 / 280;

/** An illustrated location (full frame) with up to three cast members at its table, desk or podium. */
export const Place: React.FC<{ props: PlaceProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, width, height, content } = useLayout();
  const { palette } = useTheme();
  const art = PLACE_ART[props.place];

  // The art's floor line sits where the characters' furniture meets the floor.
  const floorY = portrait ? content.top + content.height : height * 0.9;
  const scale = Math.max(width / VIEW_W, floorY / FLOOR_Y);
  const artW = VIEW_W * scale;
  const artH = VIEW_H * scale;
  const artLeft = (width - artW) / 2;
  const artTop = floorY - FLOOR_Y * scale;

  const cast = props.characters ?? [];
  const n = cast.length;
  const charH = portrait ? content.height * (n > 2 ? 0.52 : n > 1 ? 0.62 : 0.74) : height * (n > 2 ? 0.52 : 0.6);
  const charW = (charH * 200) / 280;
  const spacing = charW * (n > 2 ? 1.02 : 1.12);
  const centre = width / 2;
  const xs = cast.map((_, i) => centre + (i - (n - 1) / 2) * spacing);
  const deskTop = floorY - charH * (1 - DESK_TOP);

  const enter = springAt(frame, fps, ctx.enter - 6, SMOOTH);
  const tag = springAt(frame, fps, ctx.enter + 6, POP);
  const tagChars = props.caption ? Math.ceil(clamp01((frame - ctx.enter - 8) / 22) * props.caption.length) : 0;

  const flying = props.props ?? [];
  const propTimes = revealTimes(
    flying.map((p) => p.at ?? p.emoji.replace(/-/g, " ")),
    ctx,
    0.8,
  );
  const tableSpan = Math.max(spacing * n, width * 0.5);
  const propSpots = [0.08, 0.92, 0.3, 0.7];

  const bubble = props.bubble;
  const bubbleOwner = bubble ? Math.min(n, bubble.who ?? 1) - 1 : -1;
  const bubbleAt = bubble ? (revealTimes([bubble.at ?? bubble.text], ctx, 0.3)[0] ?? ctx.enter + 8) : 0;

  const Back = art.back;
  const Front = art.front;
  const artProps = { frame, screen: props.screen, trend: props.trend };

  return (
    <AbsoluteFill
      style={{
        // Portrait frames are taller than the art: the floor continues and darkens towards the bottom.
        background: `linear-gradient(180deg, ${art.floor} 0%, ${art.floor} ${(floorY / height) * 100}%, ${mix(art.floor, "#05060C", 0.6)} 100%)`,
        overflow: "hidden",
      }}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        width={artW}
        height={artH}
        style={{ position: "absolute", left: artLeft, top: artTop, opacity: clamp01(enter * 1.4) }}
      >
        <Back {...artProps} />
      </svg>

      {cast.map((c, i) => {
        const s = springAt(frame, fps, ctx.enter + i * 5, { damping: 15, stiffness: 120 });
        const x = xs[i] ?? centre;
        const states = characterStates(c, beatFrames(c, ctx));
        // Characters on the right half face left, towards the others.
        const flip = n > 1 && x > centre + 1;
        return (
          <div
            key={`${c.who}-${i}`}
            style={{
              position: "absolute",
              left: x - charW / 2,
              top: floorY - charH + (1 - s) * 10 * u,
              opacity: clamp01(s * 1.6),
            }}
          >
            <Character
              who={c.who}
              states={states}
              height={charH}
              flip={flip}
              loudness={talkLoudness(c, ctx, frame)}
              desk={art.desk}
            />
          </div>
        );
      })}

      {cast.map((c, i) => {
        if (!c.label) return null;
        const base = (portrait ? 2.8 : 2.2) * u;
        const size = Math.min(base, (spacing * 0.92) / (c.label.length * 0.62 + 2.6));
        return (
          <div
            key={`label-${c.who}-${i}`}
            style={{
              position: "absolute",
              left: xs[i] ?? centre,
              top: floorY - charH * 0.035,
              transform: `translate(-50%, -100%) scale(${0.7 + 0.3 * tag})`,
              opacity: clamp01(tag * 2),
              padding: `${0.5 * u}px ${1.3 * size}px`,
              borderRadius: 999,
              background: alpha("#FFFFFF", 0.94),
              color: "#1D2140",
              fontSize: size,
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            {c.label}
          </div>
        );
      })}

      {flying.map((p, i) => {
        const at = propTimes[i] ?? 0;
        const s = springAt(frame, fps, at, BOUNCY);
        const size = (portrait ? 10 : 8) * u;
        const fx = propSpots[i % propSpots.length] ?? 0.5;
        const x = centre + (fx - 0.5) * tableSpan;
        return (
          <div
            key={`${p.emoji}-${i}`}
            style={{
              position: "absolute",
              left: x - size / 2,
              top: deskTop - size * 0.82 - (1 - s) * 12 * u,
              transform: `scale(${0.4 + 0.6 * s})`,
              transformOrigin: "bottom center",
              opacity: clamp01(s * 3),
              filter: `drop-shadow(0 ${0.5 * u}px ${0.8 * u}px ${alpha("#000000", 0.3)})`,
            }}
          >
            <Emoji name={p.emoji} size={size} />
            <Sfx at={at} name="pop" volume={0.7} />
          </div>
        );
      })}

      {Front && (
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          width={artW}
          height={artH}
          style={{ position: "absolute", left: artLeft, top: artTop }}
        >
          <Front {...artProps} />
        </svg>
      )}

      {bubble && bubbleOwner >= 0 && (
        <div
          style={{
            position: "absolute",
            left: xs[bubbleOwner] ?? centre,
            top: floorY - charH * 0.98,
            transform: "translate(-50%, -100%)",
          }}
        >
          <Bubble
            text={bubble.text}
            kind={bubble.kind ?? "speech"}
            at={bubbleAt}
            tail="bottom"
            fontSize={(portrait ? 4.2 : 3.4) * u}
            maxWidth={(portrait ? 80 : 56) * u}
          />
        </div>
      )}

      {props.caption && (
        <div
          style={{
            position: "absolute",
            left: portrait ? content.left : 3 * u,
            top: portrait ? content.top - 2 * u : 7 * u,
            display: "flex",
            alignItems: "center",
            gap: 1 * u,
            padding: `${0.9 * u}px ${2 * u}px ${0.9 * u}px ${1.4 * u}px`,
            borderRadius: 999,
            background: alpha("#0B0F1F", 0.78),
            color: "#FFFFFF",
            fontSize: (portrait ? 3.2 : 2.4) * u,
            fontWeight: 800,
            letterSpacing: "0.02em",
            transform: `translateX(${(1 - tag) * -4 * u}px)`,
            opacity: clamp01(tag * 2),
            boxShadow: `0 ${0.6 * u}px ${2 * u}px ${alpha("#000000", 0.3)}`,
          }}
        >
          <Icon name="map-pin" size={(portrait ? 3.4 : 2.6) * u} color={palette.accent2} strokeWidth={2.6} />
          <span>
            {props.caption.slice(0, tagChars)}
            <span style={{ opacity: 0 }}>{props.caption.slice(tagChars)}</span>
          </span>
          <Sfx at={ctx.enter + 8} name="click" />
        </div>
      )}
    </AbsoluteFill>
  );
};
