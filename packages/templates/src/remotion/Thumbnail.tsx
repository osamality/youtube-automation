import { useMemo } from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import type { RenderInput, ThumbnailSpec } from "../schema";
import { Character } from "./Character";
import { Emoji } from "./Emoji";
import { impactFont } from "./fonts";
import { Logo } from "./Logo";
import { SketchStill } from "./scenes/Sketch";
import { makeStage, StageProvider, useStage } from "./stage";
import { alpha, fontFamilyFor, mix, paletteFor, ThemeProvider } from "./theme";

/** YouTube's recommended thumbnail size. */
export const THUMBNAIL = { width: 1280, height: 720 } as const;
/** Test & compare takes up to three thumbnails. */
export const MAX_THUMBNAILS = 3;

const norm = (w: string) => w.toLowerCase().replace(/[^a-z0-9$%]/g, "");

/** Splits the words into `count` lines of similar length. */
function lines(words: string[], count: number): string[][] {
  const target = words.join(" ").length / count;
  const out: string[][] = [[]];
  let len = 0;
  for (const w of words) {
    const cur = out[out.length - 1] as string[];
    if (cur.length && len + w.length / 2 > target && out.length < count) {
      out.push([w]);
      len = w.length + 1;
    } else {
      cur.push(w);
      len += w.length + 1;
    }
  }
  return out;
}

/** One to three lines, whichever gives the biggest letters inside the box. */
function fitText(words: string[], boxW: number, boxH: number): { rows: string[][]; size: number } {
  let best = { rows: [words], size: 0 };
  for (let n = 1; n <= Math.min(3, words.length); n++) {
    const rows = lines(words, n);
    const longest = Math.max(...rows.map((r) => r.join(" ").length));
    const size = Math.min(boxW / (longest * 0.7), boxH / n, 210);
    if (size > best.size * 1.05) best = { rows, size };
  }
  return best;
}

/** Positions of the words in `text` that make up `highlight`. */
function highlighted(words: string[], highlight?: string): Set<number> {
  if (!highlight) return new Set();
  const target = highlight.split(/\s+/).map(norm);
  const plain = words.map(norm);
  for (let i = 0; i + target.length <= plain.length; i++) {
    if (target.every((t, k) => plain[i + k] === t)) return new Set(target.map((_, k) => i + k));
  }
  return new Set();
}

const OUTLINE = "#07070F";
/** Height of the row above the words: logo, emoji and badge. */
const HEADER = 112;
/** A thick dark outline plus a hard drop shadow, so the words read at phone size. */
const outline = (w: number) =>
  [
    ...Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      return `${(Math.cos(a) * w).toFixed(1)}px ${(Math.sin(a) * w).toFixed(1)}px 0 ${OUTLINE}`;
    }),
    `${w * 1.6}px ${w * 1.9}px 0 ${OUTLINE}`,
  ].join(", ");

/**
 * Words across the top in heavy capitals; one large cartoon below them (about half the frame) with a
 * strong mood; the story prop (emoji, logo or both) beside it.
 */
const TopBody: React.FC<{ spec: ThumbnailSpec }> = ({ spec }) => {
  const { width: W, height: H } = THUMBNAIL;
  const words = spec.text.toUpperCase().split(/\s+/);
  const marked = highlighted(words, spec.highlight);
  const { rows, size } = fitText(words, W * 0.94, H * 0.36);
  // The head spans about 17–51% of the character's height; put it just under the words, filling the lower 60%.
  const charH = H * 1.75;
  const charW = (charH * 200) / 280;
  const prop = H * 0.4;
  let index = 0;
  return (
    <>
      {spec.character && (
        <div style={{ position: "absolute", left: W * 0.63 - charW / 2, top: H * 0.37 - charH * 0.17 }}>
          <Character
            who={spec.character.who}
            height={charH}
            states={[{ from: 0, pose: spec.character.pose ?? "worried", mood: spec.character.mood ?? "surprised" }]}
            flip
          />
        </div>
      )}
      {(spec.emoji || spec.logo) && (
        <div
          style={{
            position: "absolute",
            left: W * 0.07,
            top: H * 0.44,
            display: "flex",
            alignItems: "center",
            gap: 20,
            transform: "rotate(-8deg)",
          }}
        >
          {spec.emoji && (
            <Emoji name={spec.emoji} size={prop} style={{ filter: "drop-shadow(0 12px 18px rgba(0,0,0,0.6))" }} />
          )}
          {spec.logo && (
            <Logo slug={spec.logo} size={spec.emoji ? prop * 0.5 : prop * 0.8} style={{ boxShadow: `6px 6px 0 ${OUTLINE}` }} />
          )}
        </div>
      )}
      {spec.badge && (
        <div
          style={{
            position: "absolute",
            left: W * 0.07,
            bottom: 34,
            padding: "8px 22px",
            borderRadius: 999,
            background: "#FFFFFF",
            color: OUTLINE,
            fontSize: 34,
            fontWeight: 900,
            transform: "rotate(-2deg)",
            boxShadow: `6px 6px 0 ${OUTLINE}`,
          }}
        >
          {spec.badge}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: W * 0.03,
          top: 18,
          width: W * 0.94,
          height: H * 0.38,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          fontSize: size,
          fontWeight: 900,
          lineHeight: 0.98,
          letterSpacing: "-0.01em",
          textShadow: outline(size * 0.06),
        }}
      >
        {rows.map((row) => (
          <div key={row.join(" ")} style={{ whiteSpace: "nowrap" }}>
            {row.map((w, k) => {
              const at = index++;
              return (
                <span key={`${w}-${at}`} data-hl={marked.has(at) || undefined}>
                  {k ? " " : ""}
                  {w}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
};

const Body: React.FC<{ spec: ThumbnailSpec }> = ({ spec }) => {
  if (spec.layout === "top" && !spec.photos?.length) return <TopBody spec={spec} />;
  const { width: W, height: H } = THUMBNAIL;
  const words = spec.text.toUpperCase().split(/\s+/);
  const marked = highlighted(words, spec.highlight);
  const people = spec.photos ?? [];
  const row = people.length >= 3;
  const textW = W * (row ? 0.92 : people.length ? 0.54 : spec.character ? 0.6 : 0.86);
  const header = spec.logo || spec.emoji || spec.badge ? HEADER + 18 : 0;
  const { rows, size } = fitText(words, textW, (row ? H * 0.34 : H * 0.82) - header);
  const charH = H * 1.7;
  const charW = (charH * 200) / 280;
  let index = 0;

  return (
    <>
      {people.length > 0 && <Faces ids={people} />}
      {!people.length && spec.character && (
        <div style={{ position: "absolute", left: W - charW * 0.8, top: -H * 0.03 }}>
          <Character
            who={spec.character.who}
            height={charH}
            states={[
              {
                from: 0,
                pose: spec.character.pose ?? "idle",
                mood: spec.character.mood ?? "surprised",
              },
            ]}
            flip
          />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: row ? (W - textW) / 2 : 52,
          top: row ? 14 : 0,
          bottom: row ? H * 0.6 : 0,
          width: textW,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: row ? "center" : undefined,
          textAlign: row ? "center" : undefined,
          gap: 18,
        }}
      >
        {(spec.logo || spec.emoji || spec.badge) && (
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            {spec.logo && (
              <Logo
                slug={spec.logo}
                size={HEADER}
                style={{ transform: "rotate(-6deg)", boxShadow: `6px 6px 0 ${OUTLINE}` }}
              />
            )}
            {spec.emoji && (
              <Emoji
                name={spec.emoji}
                size={HEADER}
                style={{ filter: "drop-shadow(0 8px 14px rgba(0,0,0,0.55))" }}
              />
            )}
            {spec.badge && (
              <div
                style={{
                  padding: "8px 22px",
                  borderRadius: 999,
                  background: "#FFFFFF",
                  color: OUTLINE,
                  fontSize: 34,
                  fontWeight: 900,
                  transform: "rotate(-2deg)",
                  boxShadow: `6px 6px 0 ${OUTLINE}`,
                }}
              >
                {spec.badge}
              </div>
            )}
          </div>
        )}
        <div
          style={{
            fontSize: size,
            fontWeight: 900,
            lineHeight: 0.98,
            letterSpacing: "-0.01em",
            textShadow: outline(size * 0.06),
          }}
        >
          {rows.map((row) => (
            <div key={row.join(" ")} style={{ whiteSpace: "nowrap" }}>
              {row.map((w, k) => {
                const at = index++;
                return (
                  <span key={`${w}-${at}`} data-hl={marked.has(at) || undefined}>
                    {k ? " " : ""}
                    {w}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

/** Where each cut-out person goes: face centre (fractions of the thumbnail) and face width. */
const FACE_SLOTS: Record<number, { x: number; y: number; w: number }[]> = {
  1: [{ x: 0.74, y: 0.4, w: 0.25 }],
  2: [
    { x: 0.66, y: 0.42, w: 0.21 },
    { x: 0.9, y: 0.3, w: 0.15 },
  ],
  3: [
    { x: 0.5, y: 0.6, w: 0.17 },
    { x: 0.18, y: 0.66, w: 0.13 },
    { x: 0.82, y: 0.66, w: 0.13 },
  ],
};

/**
 * Real people cut out of their photos, with a white rim and a hard shadow. One or two stand on the
 * right next to the words; three stand in a row under them. Everyone runs off the bottom edge.
 */
const Faces: React.FC<{ ids: string[] }> = ({ ids }) => {
  const { width: W, height: H } = THUMBNAIL;
  const { photos } = useStage();
  const slots = FACE_SLOTS[ids.length] ?? FACE_SLOTS[1] ?? [];
  const rim = `drop-shadow(0 0 2px #FFFFFF) drop-shadow(0 0 2px #FFFFFF) drop-shadow(0 0 1px #FFFFFF) drop-shadow(10px 12px 0 ${OUTLINE})`;
  const drawn = ids
    .map((id, i) => ({ id, slot: slots[i], photo: photos[id] }))
    .filter((d) => d.slot && d.photo?.cut && d.photo.face)
    .reverse();
  return (
    <>
      {drawn.map(({ id, slot, photo }) => {
        const p = photo as NonNullable<typeof photo>;
        const face = p.face as NonNullable<typeof p.face>;
        const s = slot as NonNullable<typeof slot>;
        const fcx = face.x + face.w / 2;
        const fcy = face.y + face.h / 2;
        const cy = s.y * H;
        // Big enough for the face width, and tall enough that the photo's bottom edge is off-frame.
        const scale = Math.max((s.w * W) / (face.w * p.width), (H - cy + 4) / (p.height * (1 - fcy)));
        const w = p.width * scale;
        const h = p.height * scale;
        return (
          <Img
            key={id}
            src={staticFile(p.cut as string)}
            style={{
              position: "absolute",
              left: s.x * W - fcx * w,
              top: cy - fcy * h,
              width: w,
              height: h,
              maxWidth: "none",
              filter: rim,
            }}
          />
        );
      })}
    </>
  );
};

/** Paper look: a whole cartoon scene as the picture, with the words in tall capitals across the top. */
const SketchThumb: React.FC<{ spec: ThumbnailSpec }> = ({ spec }) => {
  if (!spec.sketch) return null;
  const words = spec.text.toUpperCase().split(/\s+/);
  const hl = highlighted(words, spec.highlight);
  const size = Math.min(176, 1210 / (spec.text.length * 0.46));
  return (
    <AbsoluteFill style={{ background: "#111111" }}>
      <SketchStill props={spec.sketch} hideTitle />
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.25) 26%, rgba(0,0,0,0) 42%)" }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 14,
          textAlign: "center",
          fontFamily: impactFont(),
          fontSize: size,
          lineHeight: 1.08,
          letterSpacing: "0.012em",
          WebkitTextStroke: `${size * 0.1}px ${OUTLINE}`,
          paintOrder: "stroke fill",
          textShadow: `0 ${size * 0.06}px 0 ${OUTLINE}`,
          whiteSpace: "nowrap",
        }}
      >
        {words.map((w, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: words can repeat
          <span key={i} style={{ color: hl.has(i) ? "#FF4B36" : "#FFFFFF" }}>
            {i ? " " : ""}
            {w}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/** One thumbnail from plan.upload.thumbnails (or just the title when the plan has none). */
export const Thumbnail: React.FC<{ input: RenderInput; thumb: number }> = ({ input, thumb }) => {
  const palette = paletteFor(input.theme.palette);
  const theme = useMemo(
    () => ({ palette, fontFamily: fontFamilyFor(input.theme.font), sfx: false }),
    [palette, input.theme.font],
  );
  const stage = useMemo(
    () => makeStage(input.plan.cast, input.logos ?? {}, input.photos ?? {}, input.plan.art),
    [input.plan.cast, input.logos, input.photos],
  );
  const spec: ThumbnailSpec = input.plan.upload?.thumbnails[thumb] ?? { text: input.plan.title };
  // White text needs a strong background: light palettes without their own thumb colours get navy.
  const look =
    palette.thumb ??
    (palette.dark
      ? { bg: palette.bg, glow: palette.accent, highlight: palette.accent2 }
      : { bg: "#14213D", glow: palette.accent, highlight: "#FFC23C" });
  const glow = look.glow;
  // The glow and rays sit behind the character.
  const center = spec.layout === "top" ? "63% 66%" : "78% 42%";

  return (
    <ThemeProvider value={theme}>
      <StageProvider value={stage}>
        <AbsoluteFill
          style={{
            fontFamily: theme.fontFamily,
            color: "#FFFFFF",
            backgroundColor: look.bg,
            backgroundImage: `radial-gradient(circle at ${center}, ${alpha(glow, 0.85)} 0%, ${alpha(glow, 0.25)} 34%, ${look.bg} 68%)`,
            overflow: "hidden",
          }}
        >
          <AbsoluteFill
            style={{
              background: `repeating-conic-gradient(from 0deg at ${center}, ${alpha("#FFFFFF", 0.07)} 0deg 7deg, transparent 7deg 18deg)`,
            }}
          />
          <AbsoluteFill
            style={{
              background: `radial-gradient(circle at 8% 100%, ${alpha(look.highlight, 0.22)} 0%, transparent 42%)`,
            }}
          />
          {spec.sketch ? <SketchThumb spec={spec} /> : <Body spec={spec} />}
          <style>{`[data-hl] { color: ${look.highlight}; }`}</style>
          <AbsoluteFill
            style={{
              boxShadow: `inset 0 0 160px ${alpha(mix(look.bg, "#000000", 0.6), 0.9)}`,
              pointerEvents: "none",
            }}
          />
        </AbsoluteFill>
      </StageProvider>
    </ThemeProvider>
  );
};
