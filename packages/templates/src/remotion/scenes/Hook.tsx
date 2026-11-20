import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { HookProps } from "../../schema";
import { clamp01, POP, progress, type SceneCtx, SMOOTH, springAt } from "../anim";
import { fitFont, useLayout } from "../layout";
import { Sfx } from "../Sfx";
import { alpha, mix, useTheme } from "../theme";

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9$%]/g, "");

/** Indexes of the title words that form the `highlight` phrase. */
function highlightIndexes(words: string[], highlight?: string): Set<number> {
  if (!highlight) return new Set();
  const target = highlight.split(/\s+/).map(norm);
  const plain = words.map(norm);
  for (let i = 0; i + target.length <= plain.length; i++) {
    if (target.every((t, k) => plain[i + k] === t)) {
      return new Set(target.map((_, k) => i + k));
    }
  }
  return new Set();
}

/** Opening line: kicker types in, title words pop in one by one, highlight gets a marker sweep. */
export const Hook: React.FC<{ props: HookProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();

  const words = props.title.split(/\s+/);
  const marked = highlightIndexes(words, props.highlight);
  const markedOrder = [...marked].sort((a, b) => a - b);
  const size = fitFont(props.title, portrait ? 11.5 * u : 9.5 * u, portrait ? 18 : 28);
  const gap = size * 0.26;

  const start = ctx.enter;
  const kicker = props.kicker?.toUpperCase() ?? "";
  const typed = kicker.slice(0, Math.max(0, Math.floor((frame - start) * 1.8)));
  const caretOn = typed.length < kicker.length || Math.floor(frame / 9) % 2 === 0;
  const wordsStart = start + (kicker ? 10 : 2);
  const markStart = wordsStart + words.length * 3 + 6;

  const cx = content.left + content.width / 2;
  const cy = content.top + content.height / 2;

  return (
    <AbsoluteFill>
      {[0, 1, 2].map((i) => {
        const local = frame - start - i * 30;
        if (local < 0) return null;
        const p = (local % 90) / 90;
        const r = (14 + p * 75) * u;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx - r,
              top: cy - r,
              width: 2 * r,
              height: 2 * r,
              borderRadius: "50%",
              border: `${0.3 * u}px solid ${alpha(palette.accent, 0.28 * (1 - p))}`,
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          left: content.left,
          top: content.top,
          width: content.width,
          height: content.height,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: (portrait ? 4 : 3) * u,
        }}
      >
        {kicker && (
          <div
            style={{
              fontSize: (portrait ? 3.3 : 2.3) * u,
              fontWeight: 800,
              letterSpacing: "0.18em",
              color: palette.accent,
              padding: `${0.9 * u}px ${2.2 * u}px`,
              border: `${0.25 * u}px solid ${alpha(palette.accent, 0.55)}`,
              borderRadius: 99 * u,
              background: alpha(palette.accent, 0.1),
              opacity: springAt(frame, fps, start, SMOOTH),
            }}
          >
            {typed}
            <span style={{ opacity: caretOn ? 1 : 0, marginLeft: 0.2 * u }}>▍</span>
          </div>
        )}

        <div
          style={{
            fontSize: size,
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: "-0.025em",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            columnGap: gap,
          }}
        >
          {words.map((word, i) => {
            const s = springAt(frame, fps, wordsStart + i * 3, POP);
            const hl = marked.has(i);
            const order = markedOrder.indexOf(i);
            const mark = hl ? progress(frame, markStart + order * 4, 10) : 0;
            const joinNext = hl && marked.has(i + 1);
            const joinPrev = hl && marked.has(i - 1);
            const r = 0.08 * size;
            return (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: words can repeat
                key={i}
                style={{
                  position: "relative",
                  display: "inline-block",
                  opacity: clamp01(s * 1.5),
                  transform: `translateY(${(1 - s) * size * 0.5}px) scale(${0.75 + 0.25 * s})`,
                  color: hl ? palette.accent : palette.text,
                }}
              >
                {hl && (
                  <span
                    style={{
                      position: "absolute",
                      // Joined words share one bar: square inner ends, 1px overlap, solid colour
                      // (a transparent colour would show a darker seam where the bars overlap).
                      left: joinPrev ? 0 : -0.06 * size,
                      right: joinNext ? -gap - 1 : -0.06 * size,
                      bottom: 0.05 * size,
                      height: 0.3 * size,
                      borderRadius: `${joinPrev ? 0 : r}px ${joinNext ? 0 : r}px ${joinNext ? 0 : r}px ${joinPrev ? 0 : r}px`,
                      background: mix(palette.bg, palette.accent2, palette.dark ? 0.4 : 0.45),
                      transform: `scaleX(${mark})`,
                      transformOrigin: "left center",
                    }}
                  />
                )}
                <span style={{ position: "relative" }}>{word}</span>
              </span>
            );
          })}
        </div>
      </div>
      <Sfx at={wordsStart} name="boom" />
      {props.highlight ? <Sfx at={markStart} name="sparkle" volume={0.7} /> : null}
    </AbsoluteFill>
  );
};
