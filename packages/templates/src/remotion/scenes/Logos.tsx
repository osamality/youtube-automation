import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { LogosProps } from "../../schema";
import { BOUNCY, clamp01, fadeUp, revealTimes, type SceneCtx, SMOOTH, springAt } from "../anim";
import { useLayout } from "../layout";
import { Logo } from "../Logo";
import { Sfx } from "../Sfx";
import { useStage } from "../stage";
import { alpha, useTheme } from "../theme";
import { SceneTitle, titleSpace } from "./common";

/** Company logos in a grid. Each pops in when its name is spoken. */
export const Logos: React.FC<{ props: LogosProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();
  const { logos } = useStage();

  const items = props.items;
  const n = items.length;
  const names = items.map((it) => it.label ?? logos[it.logo]?.title ?? it.logo);
  const times = revealTimes(
    items.map((it, i) => it.at ?? names[i] ?? it.logo),
    ctx,
    0.8,
  );
  const cols = portrait ? (n <= 4 ? 2 : 3) : n <= 4 ? n : Math.ceil(n / 2);
  const rows = Math.ceil(n / cols);
  const top = content.top + titleSpace(portrait, u);
  const noteH = props.note ? 7 * u : 0;
  const areaH = content.top + content.height - top - noteH;
  const cellW = content.width / cols;
  const cellH = areaH / rows;
  const tile = Math.min(cellW * 0.6, cellH * 0.66, (portrait ? 24 : 19) * u);
  const labelSize = (portrait ? 3.6 : 2.8) * u;
  const note = springAt(frame, fps, (times[n - 1] ?? ctx.enter) + 14, SMOOTH);

  return (
    <AbsoluteFill>
      <SceneTitle text={props.title} ctx={ctx} />
      {items.map((it, i) => {
        const row = Math.floor(i / cols);
        const inRow = Math.min(cols, n - row * cols);
        const col = i % cols;
        // Centre a short last row.
        const x = content.left + (content.width - inRow * cellW) / 2 + cellW * (col + 0.5);
        const y = top + cellH * (row + 0.5) - labelSize * 0.6;
        const at = times[i] ?? 0;
        const s = springAt(frame, fps, at, BOUNCY);
        const float = Math.sin((frame + i * 23) / 18) * 0.8 * u;
        return (
          <div
            key={`${it.logo}-${i}`}
            style={{
              position: "absolute",
              left: x,
              top: y + float,
              transform: `translate(-50%, -50%) scale(${s}) rotate(${(1 - s) * (i % 2 ? 18 : -18)}deg)`,
              opacity: clamp01(s * 2),
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1.6 * u,
            }}
          >
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  inset: -tile * 0.18,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${alpha(palette.accent, 0.35)} 0%, ${alpha(palette.accent, 0)} 70%)`,
                }}
              />
              <Logo slug={it.logo} size={tile} />
            </div>
            <div style={{ fontSize: labelSize, fontWeight: 800, whiteSpace: "nowrap" }}>{names[i]}</div>
            <Sfx at={at} name="pop" />
          </div>
        );
      })}
      {props.note && (
        <div
          style={{
            position: "absolute",
            left: content.left,
            width: content.width,
            top: content.top + content.height - noteH * 0.8,
            textAlign: "center",
            fontSize: (portrait ? 3.4 : 2.8) * u,
            fontWeight: 700,
            color: palette.muted,
            ...fadeUp(note, 2 * u),
          }}
        >
          {props.note}
        </div>
      )}
    </AbsoluteFill>
  );
};
