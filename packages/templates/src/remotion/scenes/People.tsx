import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { PeopleProps } from "../../schema";
import { clamp01, revealTimes, type SceneCtx, springAt } from "../anim";
import { impactFont } from "../fonts";
import { useLayout } from "../layout";
import { Cutout } from "../Photo";
import { Sfx } from "../Sfx";
import { useStage } from "../stage";
import { alpha, mix, useTheme } from "../theme";
import { SceneTitle, titleSpace } from "./common";

/** Real people on coloured cards, cut out of their photos, each popping in as they are named. */
export const People: React.FC<{ props: PeopleProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();
  const { photos } = useStage();
  const pops = palette.pops ?? [palette.accent, palette.accent2, palette.positive, palette.negative];
  const n = props.people.length;
  const times = revealTimes(
    props.people.map((p) => p.at ?? p.name),
    ctx,
    0.7,
  );

  const top = content.top + (props.title ? titleSpace(portrait, u) : 0);
  const areaH = content.height - (props.title ? titleSpace(portrait, u) : 0);
  const cols = portrait && n > 2 ? 2 : n;
  const rows = Math.ceil(n / cols);
  const gap = (props.versus ? 12 : 3.4) * u;
  const cardW = Math.min((content.width - gap * (cols - 1)) / cols, (portrait ? 44 : 46) * u);
  const cardH = Math.min((areaH - gap * (rows - 1)) / rows, cardW * 1.32);
  const nameH = cardH * 0.24;

  return (
    <AbsoluteFill>
      {props.title && <SceneTitle text={props.title} ctx={ctx} />}
      <div
        style={{
          position: "absolute",
          left: content.left,
          top,
          width: content.width,
          height: areaH,
          display: "flex",
          flexWrap: "wrap",
          alignContent: "center",
          justifyContent: "center",
          columnGap: gap,
          rowGap: gap,
        }}
      >
        {props.people.map((person, i) => {
          const at = times[i] ?? ctx.enter;
          const p = springAt(frame, fps, at, { damping: 12, stiffness: 150, mass: 0.7 });
          const color = pops[i % pops.length] as string;
          return (
            <div
              key={person.photo + person.name}
              style={{
                position: "relative",
                width: cardW,
                height: cardH,
                borderRadius: 3 * u,
                overflow: "hidden",
                background: `linear-gradient(160deg, ${mix(color, "#FFFFFF", 0.25)} 0%, ${color} 70%)`,
                boxShadow: `0 ${1.4 * u}px ${4.5 * u}px ${alpha("#000000", 0.2)}`,
                transform: `translateY(${(1 - p) * 10 * u}px) scale(${0.85 + 0.15 * p})`,
                opacity: clamp01(p * 2),
              }}
            >
              <Cutout
                photo={photos[person.photo] ?? null}
                width={cardW}
                height={cardH - nameH * 0.6}
                faceWidth={0.44}
                faceY={0.4}
              />
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: nameH,
                  background: "#FFFFFF",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: `0 ${1.2 * u}px`,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: Math.min(3.6 * u, cardW / 9), color: "#14182B", textAlign: "center", lineHeight: 1.1 }}>
                  {person.name}
                </div>
                {person.role && (
                  <div style={{ fontWeight: 700, fontSize: Math.min(2.3 * u, cardW / 15), color: palette.muted, textAlign: "center", marginTop: 0.4 * u }}>
                    {person.role}
                  </div>
                )}
              </div>
              <Sfx at={at} name="pop" />
            </div>
          );
        })}
      </div>
      {props.versus && n === 2 && <Versus at={(times[1] ?? ctx.enter) + 4} top={top + areaH / 2} />}
    </AbsoluteFill>
  );
};

const Versus: React.FC<{ at: number; top: number }> = ({ at, top }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, width } = useLayout();
  const p = springAt(frame, fps, at, { damping: 10, stiffness: 200 });
  const size = 13 * u;
  return (
    <div
      style={{
        position: "absolute",
        left: width / 2 - size / 2,
        top: top - size / 2,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "#14182B",
        color: "#FFD43B",
        fontFamily: impactFont(),
        fontSize: 6 * u,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${p}) rotate(${(1 - p) * -40}deg)`,
        boxShadow: `0 0 0 ${0.8 * u}px #FFFFFF`,
      }}
    >
      VS
    </div>
  );
};
