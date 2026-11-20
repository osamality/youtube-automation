import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { DocumentProps } from "../../schema";
import { clamp01, type SceneCtx, springAt } from "../anim";
import { useLayout } from "../layout";
import { Logo } from "../Logo";
import { Highlighted, phraseTime } from "../Photo";
import { alpha } from "../theme";

/**
 * An official statement on a page. The page rises in, then the camera moves in on the paragraph that
 * holds the highlighted passage as the narrator reaches it.
 */
export const DocumentScene: React.FC<{ props: DocumentProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, width, height } = useLayout();

  const pageW = portrait ? width * 0.9 : Math.min(118 * u, width * 0.66);
  const pad = (portrait ? 5 : 5.5) * u;
  const body = (portrait ? 3.5 : 2.55) * u;
  const lineH = body * 1.6;
  const titleSize = (portrait ? 5 : 3.8) * u;

  // Paragraph heights, estimated from characters per line (Montserrat averages ~0.55 em per character).
  const perLine = Math.max(10, Math.floor((pageW - 2 * pad) / (body * 0.55)));
  const headH = pad + titleSize * 1.3 + (props.from ? body * 1.6 : 0) + (props.logo ? 7 * u : 0) + 3 * u;
  const tops: number[] = [];
  let y = headH;
  for (const p of props.paragraphs) {
    tops.push(y);
    y += Math.ceil(p.length / perLine) * lineH + 2.2 * u;
  }
  const pageH = Math.max(y + pad, height * 1.05);
  const target = props.highlight ? props.paragraphs.findIndex((p) => p.includes(props.highlight as string)) : -1;
  const targetY = target >= 0 ? (tops[target] ?? 0) + (Math.ceil((props.paragraphs[target]?.length ?? 0) / perLine) * lineH) / 2 : pageH / 3;

  const hlAt = props.highlight
    ? phraseTime(props.highlight, ctx, ctx.voiceStart + Math.round(ctx.voiceFrames * 0.35))
    : ctx.voiceStart + ctx.voiceFrames;
  const rise = springAt(frame, fps, ctx.enter, { damping: 18, stiffness: 90 });
  // Zoom from the top of the page towards the highlighted paragraph, arriving as it is read.
  const move = Easing.inOut(Easing.cubic)(clamp01((frame - (hlAt - 30)) / 36));
  const zoom = interpolate(move, [0, 1], [1, portrait ? 1.12 : 1.3]);
  // The page is scaled about the target paragraph, so that paragraph lands at targetY + focusY on screen.
  const focusY = interpolate(move, [0, 1], [height * 0.08, height * 0.5 - targetY]);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: width / 2 - pageW / 2,
          top: 0,
          width: pageW,
          minHeight: pageH,
          padding: pad,
          background: "#FFFFFF",
          color: "#1B1E27",
          borderRadius: 0.5 * u,
          boxShadow: `0 ${2 * u}px ${7 * u}px ${alpha("#000000", 0.22)}`,
          transformOrigin: `50% ${targetY}px`,
          transform: `translateY(${focusY + (1 - rise) * height * 0.7}px) scale(${zoom})`,
        }}
      >
        {props.logo && (
          <div style={{ marginBottom: 2 * u }}>
            <Logo slug={props.logo} size={5 * u} />
          </div>
        )}
        <div style={{ fontWeight: 900, fontSize: titleSize, lineHeight: 1.2 }}>{props.title}</div>
        {props.from && <div style={{ fontWeight: 600, fontSize: body * 0.9, color: "#6B6F7E", marginTop: 0.8 * u }}>{props.from}</div>}
        <div style={{ height: 0.2 * u, background: "#1B1E27", opacity: 0.15, margin: `${2.4 * u}px 0` }} />
        {props.paragraphs.map((p, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: paragraphs are fixed per scene
            key={i}
            style={{ fontSize: body, lineHeight: 1.6, fontWeight: 500, marginBottom: 2.2 * u, opacity: target < 0 || i === target || move < 0.5 ? 1 : 0.55 }}
          >
            <Highlighted text={p} passage={i === target ? props.highlight : undefined} at={hlAt} />
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
