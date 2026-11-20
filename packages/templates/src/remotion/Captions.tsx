import { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { isPaperScene, sceneAt, type Timeline, type TimedWord } from "../timeline";
import { springAt } from "./anim";
import { useLayout } from "./layout";
import { alpha, useTheme } from "./theme";

interface Chunk {
  words: TimedWord[];
  start: number;
  /** Last frame the chunk stays on screen. */
  until: number;
}

/**
 * Groups words into short caption lines. Breaks after punctuation and long pauses, then splits
 * each stretch into near-equal lines of at most `maxWords` (7 words → 4 + 3, never 6 + 1).
 */
export function chunkWords(words: TimedWord[], maxWords: number): Chunk[] {
  const runs: TimedWord[][] = [];
  let run: TimedWord[] = [];
  words.forEach((word, i) => {
    run.push(word);
    const next = words[i + 1];
    const punctuation = /[.!?,;:]["')\]]*$/.test(word.text);
    const pause = next ? next.start - word.end > 8 : true;
    if (punctuation || pause) {
      runs.push(run);
      run = [];
    }
  });

  const chunks: Chunk[] = [];
  for (const r of runs) {
    const count = Math.ceil(r.length / maxWords);
    const size = r.length / count;
    for (let k = 0; k < count; k++) {
      const part = r.slice(Math.round(k * size), Math.round((k + 1) * size));
      const first = part[0];
      const last = part[part.length - 1];
      if (first && last) chunks.push({ words: part, start: first.start, until: last.end + 10 });
    }
  }
  // Never overlap the next chunk.
  for (let i = 0; i < chunks.length - 1; i++) {
    const c = chunks[i] as Chunk;
    c.until = Math.min(c.until, (chunks[i + 1] as Chunk).start - 1);
  }
  return chunks;
}

/** Word-by-word captions. The spoken word gets an accent pill. */
export const Captions: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, width, height, captionsY } = useLayout();
  const { palette } = useTheme();

  const chunks = useMemo(
    () => timeline.scenes.flatMap((s) => chunkWords(s.words, portrait ? 3 : 6)),
    [timeline, portrait],
  );
  const chunk = chunks.find((c) => frame >= c.start - 1 && frame <= c.until);
  if (!chunk) return null;
  // Paper scenes carry their own hand-written words; captions stay for Shorts, below the picture.
  if (!portrait && isPaperScene(sceneAt(timeline, frame)?.scene)) return null;

  const pop = springAt(frame, fps, chunk.start - 1, { damping: 14, stiffness: 240, mass: 0.5 });
  const size = portrait ? 6.6 * u : 4.6 * u;

  // Colourful backgrounds (and the illustrated places) sit busy shapes behind the text, so captions get their own card.
  const card = !palette.dark || Boolean(palette.scenes);

  return (
    <div
      style={{
        position: "absolute",
        left: width * (portrait ? 0.06 : 0.16),
        right: width * (portrait ? 0.06 : 0.16),
        // Under a paper scene's picture band, which sits lower in the frame than other templates' content.
        top: portrait && isPaperScene(sceneAt(timeline, frame)?.scene) ? height * 0.745 : captionsY,
        transform: `translateY(-50%) scale(${0.85 + 0.15 * pop})`,
        opacity: Math.min(1, pop * 2),
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
          gap: `${size * 0.12}px ${size * 0.22}px`,
          fontSize: size,
          fontWeight: 900,
          lineHeight: 1.15,
          textTransform: portrait ? "uppercase" : "none",
          letterSpacing: portrait ? "0.01em" : "-0.01em",
          ...(card
            ? {
                background: alpha(palette.surface, palette.dark ? 0.88 : 0.94),
                borderRadius: size * 0.45,
                padding: `${size * 0.22}px ${size * 0.35}px`,
                boxShadow: `0 ${0.6 * u}px ${2.4 * u}px ${alpha(palette.dark ? "#000000" : palette.text, palette.dark ? 0.35 : 0.14)}`,
              }
            : {}),
        }}
      >
      {chunk.words.map((w, i) => {
        const next = chunk.words[i + 1];
        const active = frame >= w.start && frame < (next ? next.start : chunk.until + 1);
        const spoken = frame >= w.start;
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: words can repeat within a chunk
            key={i}
            style={{
              padding: `${size * 0.04}px ${size * 0.16}px`,
              borderRadius: size * 0.22,
              background: active ? palette.accent : "transparent",
              color: active ? "#FFFFFF" : palette.text,
              opacity: spoken ? 1 : 0.55,
              transform: `scale(${active ? 1.07 : 1})`,
              textShadow:
                active || card
                  ? "none"
                  : `0 ${0.25 * u}px ${1.2 * u}px ${alpha(palette.dark ? "#000000" : "#FFFFFF", 0.75)}`,
              boxShadow: active ? `0 ${0.5 * u}px ${2 * u}px ${alpha(palette.accent, 0.45)}` : "none",
            }}
          >
            {w.text}
          </span>
        );
      })}
      </div>
    </div>
  );
};
