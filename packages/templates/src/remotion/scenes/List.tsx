import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { ListProps } from "../../schema";
import { clamp01, POP, revealTimes, type SceneCtx, springAt } from "../anim";
import { Icon } from "../Icon";
import { useLayout } from "../layout";
import { Sfx } from "../Sfx";
import { alpha, useTheme } from "../theme";
import { SceneTitle, titleSpace } from "./common";

/** Numbered list that builds as the narration reaches each item. The current item is highlighted. */
export const List: React.FC<{ props: ListProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();

  const items = props.items;
  const n = items.length;
  const times = revealTimes(
    items.map((i) => i.text),
    ctx,
  );
  const at = (i: number) => times[i] ?? 0;

  const top = content.top + titleSpace(portrait, u);
  const areaH = content.top + content.height - top;
  const gap = (portrait ? 2.2 : 1.8) * u;
  const rowH = Math.min((portrait ? 11 : 9.5) * u, (areaH - gap * (n - 1)) / n);
  const listW = portrait ? content.width : Math.min(content.width, 120 * u);
  const left = content.left + (content.width - listW) / 2;
  const startY = top + (areaH - (rowH * n + gap * (n - 1))) / 2;
  const badge = rowH * 0.62;

  return (
    <AbsoluteFill>
      <SceneTitle text={props.title} ctx={ctx} />
      {items.map((item, i) => {
        const s = springAt(frame, fps, at(i), POP);
        const current = frame >= at(i) && (i === n - 1 || frame < at(i + 1));
        const passed = i < n - 1 && frame >= at(i + 1);
        return (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: items are positional
            key={i}
            style={{
              position: "absolute",
              left,
              top: startY + i * (rowH + gap),
              width: listW,
              height: rowH,
              display: "flex",
              alignItems: "center",
              gap: 2.6 * u,
              padding: `0 ${2.6 * u}px`,
              borderRadius: 2.2 * u,
              background: current ? palette.surface : alpha(palette.surface, 0.5),
              borderLeft: `${0.7 * u}px solid ${current ? palette.accent : "transparent"}`,
              boxShadow: current ? `0 ${u}px ${4 * u}px ${alpha(palette.accent, 0.25)}` : "none",
              opacity: clamp01(s * 1.4) * (passed ? 0.78 : 1),
              transform: `translateX(${(1 - s) * -8 * u}px)`,
            }}
          >
            <div
              style={{
                flex: "none",
                width: badge,
                height: badge,
                borderRadius: "50%",
                background: current ? palette.accent : alpha(palette.accent, 0.18),
                color: current ? "#FFFFFF" : palette.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: badge * 0.48,
                fontWeight: 900,
              }}
            >
              {item.icon ? (
                <Icon
                  name={item.icon}
                  size={badge * 0.5}
                  color={current ? "#FFFFFF" : palette.accent}
                />
              ) : (
                i + 1
              )}
            </div>
            <div
              style={{ fontSize: (portrait ? 4.2 : 3.4) * u, fontWeight: 800, lineHeight: 1.15 }}
            >
              {item.text}
            </div>
          </div>
        );
      })}
      {times.map((t, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: one sound per item
        <Sfx key={i} at={t} name="pop" />
      ))}
    </AbsoluteFill>
  );
};
