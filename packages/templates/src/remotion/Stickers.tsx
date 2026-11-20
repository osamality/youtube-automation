import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { Sticker } from "../schema";
import { BOUNCY, clamp01, revealTimes, type SceneCtx, springAt } from "./anim";
import { Emoji } from "./Emoji";
import { Logo } from "./Logo";
import { useLayout } from "./layout";
import { Sfx } from "./Sfx";
import { alpha } from "./theme";

const DEFAULT_PLACES = ["top-right", "bottom-left", "top-left", "bottom-right"] as const;
const SIZE = { s: 9, m: 13, l: 17 } as const;

/** 3D emoji (or logos) that pop in around the edges of a scene when their word is spoken, then float. */
export const StickerLayer: React.FC<{ stickers: Sticker[]; ctx: SceneCtx }> = ({ stickers, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const times = revealTimes(
    stickers.map((s) => s.at ?? (s.emoji ?? s.logo ?? "").replace(/-/g, " ")),
    ctx,
    0.7,
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {stickers.map((st, i) => {
        const size = SIZE[st.size ?? "m"] * u * (portrait ? 1.15 : 1);
        const wanted = st.place ?? DEFAULT_PLACES[i % DEFAULT_PLACES.length] ?? "top-right";
        // Portrait content spans the full width, so every sticker goes to the free band above it.
        // In landscape the chapter badge and place labels sit top-left, so stickers there move down.
        const place = portrait
          ? /left/.test(wanted)
            ? "top-left"
            : "top-right"
          : wanted === "top-left"
            ? "bottom-left"
            : wanted;
        const right = content.left + content.width;
        const bottom = content.top + content.height;
        const out = 2.5 * u;
        const [x, y] = {
          "top-left": [content.left - out, content.top - (portrait ? size * 0.75 : out)],
          "top-right": [right - size + out, content.top - (portrait ? size * 0.75 : out)],
          "bottom-left": [content.left - out, bottom - size + out],
          "bottom-right": [right - size + out, bottom - size + out],
          left: [content.left - out * 1.5, content.top + (content.height - size) / 2],
          right: [right - size + out * 1.5, content.top + (content.height - size) / 2],
        }[place] as [number, number];
        const at = times[i] ?? ctx.enter;
        const s = springAt(frame, fps, at, BOUNCY);
        const float = Math.sin((frame + i * 29) / 15) * 1.2 * u;
        const tilt = Math.sin((frame + i * 41) / 24) * 8 + (1 - s) * (i % 2 ? 40 : -40);
        return (
          <div
            key={`${st.emoji ?? st.logo}-${i}`}
            style={{
              position: "absolute",
              left: x,
              top: y + float,
              transform: `scale(${s}) rotate(${tilt}deg)`,
              opacity: clamp01(s * 2),
              filter: `drop-shadow(0 ${0.9 * u}px ${1.4 * u}px ${alpha("#1D2140", 0.2)})`,
            }}
          >
            {st.emoji ? <Emoji name={st.emoji} size={size} /> : <Logo slug={st.logo ?? ""} size={size * 0.82} />}
            <Sfx at={at} name="pop" volume={0.8} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
