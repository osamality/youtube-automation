import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import type { ProfileProps } from "../../schema";
import { clamp01, revealTimes, type SceneCtx, springAt } from "../anim";
import { impactFont, typedFont } from "../fonts";
import { useLayout } from "../layout";
import { CartoonBust, PhotoFill, Stamp } from "../Photo";
import { Sfx } from "../Sfx";
import { usePhoto } from "../stage";
import { alpha } from "../theme";

const FOLDER = "#EFD39B";
const FOLDER_EDGE = "#D9B46C";

/** A case file: photo (or a blank silhouette) clipped to a folder, facts typed in as they are spoken, then a stamp. */
export const Profile: React.FC<{ props: ProfileProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const photo = usePhoto(props.photo);

  const open = springAt(frame, fps, ctx.enter, { damping: 17, stiffness: 110 });
  const times = revealTimes(
    props.facts.map((f) => f.at ?? f.value),
    ctx,
    0.75,
  );
  const lastFact = times[times.length - 1] ?? ctx.enter;
  const stampAt = Math.min(lastFact + 22, ctx.voiceStart + ctx.voiceFrames - 4);

  const folderW = portrait ? content.width : Math.min(content.width, 150 * u);
  const folderH = portrait ? content.height * 1.08 : content.height * 1.05;
  const photoW = portrait ? folderW * 0.3 : folderW * 0.3;
  const photoH = photoW * 1.25;
  const label = (portrait ? 2.3 : 2.1) * u;
  const value = (portrait ? 3.1 : 3) * u;

  const portraitBox = (
    <div
      style={{
        position: "relative",
        padding: 1 * u,
        background: "#FFFFFF",
        boxShadow: `0 ${1 * u}px ${3 * u}px ${alpha("#000000", 0.25)}`,
        transform: "rotate(-3deg)",
        flex: "none",
      }}
    >
      {props.character ? (
        <CartoonBust
          character={props.character}
          width={photoW}
          height={photoH}
          background="linear-gradient(180deg, #DDE3EA 0%, #B9C3CF 100%)"
        />
      ) : photo ? (
        <PhotoFill photo={photo} width={photoW} height={photoH} zoom={1.15} filter="grayscale(0.25) contrast(1.05)" />
      ) : (
        <Silhouette width={photoW} height={photoH} />
      )}
      {/* Paper clip */}
      <div
        style={{
          position: "absolute",
          top: -2.6 * u,
          left: photoW * 0.18,
          width: 3 * u,
          height: 8 * u,
          border: `${0.55 * u}px solid #9AA1AE`,
          borderRadius: 2 * u,
        }}
      />
    </div>
  );

  const facts = props.facts.map((f, i) => {
            const at = times[i] ?? ctx.enter;
            const typed = Math.floor(clamp01((frame - at) / Math.max(8, f.value.length * 0.9)) * f.value.length);
            return (
              <div
                key={f.label + f.value}
                style={{
                  borderTop: `${0.2 * u}px dashed ${alpha("#6E5326", 0.45)}`,
                  paddingTop: 1 * u,
                  opacity: frame >= at - 2 ? 1 : 0,
                }}
              >
                <div style={{ fontFamily: typedFont(), fontWeight: 700, fontSize: label, color: "#7A5E2C", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {f.label}
                </div>
                <div style={{ fontFamily: typedFont(), fontWeight: 700, fontSize: value, color: "#1D1A14", minHeight: value * 1.25 }}>
                  {f.value.slice(0, typed)}
                  {typed < f.value.length && frame >= at && <span style={{ opacity: Math.floor(frame / 4) % 2 ? 1 : 0 }}>▌</span>}
                </div>
                <Sfx at={at} name="click" />
              </div>
            );
  });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: content.left + (content.width - folderW) / 2,
          top: content.top + (content.height - folderH) / 2 + 1 * u,
          width: folderW,
          height: folderH,
          background: `linear-gradient(170deg, ${FOLDER} 0%, #E8C886 100%)`,
          borderRadius: 1.4 * u,
          border: `${0.3 * u}px solid ${FOLDER_EDGE}`,
          boxShadow: `0 ${2 * u}px ${6 * u}px ${alpha("#000000", 0.2)}`,
          transform: `translateY(${(1 - open) * 40 * u}px) rotate(${(1 - open) * 4 - 0.6}deg)`,
          opacity: clamp01(open * 2),
          padding: portrait ? `${4 * u}px ${4 * u}px` : `${4.5 * u}px ${5 * u}px`,
          display: "flex",
          flexDirection: "row",
          flexWrap: portrait ? "wrap" : "nowrap",
          alignItems: "flex-start",
          alignContent: "flex-start",
          gap: (portrait ? 3.5 : 5) * u,
        }}
      >
        {/* Folder tab */}
        <div
          style={{
            position: "absolute",
            left: 6 * u,
            top: -4.2 * u,
            width: 26 * u,
            height: 4.6 * u,
            background: FOLDER,
            border: `${0.3 * u}px solid ${FOLDER_EDGE}`,
            borderBottom: "none",
            borderRadius: `${1.2 * u}px ${1.2 * u}px 0 0`,
            fontFamily: typedFont(),
            fontWeight: 700,
            fontSize: 2 * u,
            color: "#6E5326",
            display: "flex",
            alignItems: "center",
            paddingLeft: 2 * u,
          }}
        >
          FILE
        </div>
        {portraitBox}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1.6 * u, alignSelf: portrait ? "center" : undefined }}>
          <div style={{ fontFamily: impactFont(), fontSize: (portrait ? 6.4 : 6.6) * u, lineHeight: 1, color: "#1D1A14", textTransform: "uppercase" }}>
            {props.name}
          </div>
          {props.subtitle && (
            <div style={{ fontFamily: typedFont(), fontWeight: 700, fontSize: value * 0.9, color: "#5A4520", marginBottom: 1 * u }}>
              {props.subtitle}
            </div>
          )}
          {!portrait && facts}
        </div>
        {portrait && <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 1.2 * u }}>{facts}</div>}
        {props.stamp && (
          <div style={{ position: "absolute", right: 5 * u, bottom: 5 * u }}>
            <Stamp text={props.stamp} at={stampAt} size={(portrait ? 7 : 6) * u} rotate={-12} />
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/** A blank head-and-shoulders shape with a question mark, for people with no free photo. */
const Silhouette: React.FC<{ width: number; height: number }> = ({ width, height }) => (
  <div
    style={{
      position: "relative",
      width,
      height,
      overflow: "hidden",
      background: "linear-gradient(180deg, #5C6273 0%, #3A3F4C 100%)",
    }}
  >
    <div
      style={{
        position: "absolute",
        left: width * 0.3,
        top: height * 0.17,
        width: width * 0.4,
        height: width * 0.46,
        borderRadius: "50%",
        background: "#20232B",
      }}
    />
    <div
      style={{
        position: "absolute",
        left: width * 0.1,
        top: height * 0.58,
        width: width * 0.8,
        height: height * 0.6,
        borderRadius: `${width * 0.4}px ${width * 0.4}px 0 0`,
        background: "#20232B",
      }}
    />
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: impactFont(),
        fontSize: width * 0.42,
        color: "#FFD43B",
        textShadow: `0 ${width * 0.02}px ${width * 0.06}px rgba(0,0,0,0.5)`,
      }}
    >
      ?
    </div>
  </div>
);
