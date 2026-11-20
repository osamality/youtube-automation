import { useCurrentFrame, useVideoConfig } from "remotion";
import { fadeUp, type SceneCtx, SMOOTH, springAt } from "../anim";
import { fitFont, useLayout } from "../layout";
import { useTheme } from "../theme";

/** Scene heading with an accent underline that grows in. Height: 10u landscape, 11u portrait. */
export const SceneTitle: React.FC<{ text: string; ctx: SceneCtx }> = ({ text, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();
  const s = springAt(frame, fps, ctx.enter, SMOOTH);
  const size = fitFont(text, portrait ? 5.8 * u : 4.6 * u, portrait ? 24 : 42);

  return (
    <div
      style={{
        position: "absolute",
        left: content.left,
        top: content.top,
        width: content.width,
        textAlign: "center",
        fontSize: size,
        fontWeight: 900,
        lineHeight: 1.1,
        letterSpacing: "-0.015em",
        ...fadeUp(s, 3 * u),
      }}
    >
      {text}
      <div
        style={{
          margin: `${1.3 * u}px auto 0`,
          height: 0.55 * u,
          width: s * 10 * u,
          borderRadius: u,
          background: palette.accent,
        }}
      />
    </div>
  );
};

export const titleSpace = (portrait: boolean, u: number) => (portrait ? 12 : 10.5) * u;
