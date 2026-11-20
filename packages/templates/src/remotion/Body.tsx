import type { CastMember } from "../cast";
import {
  BONES,
  BOX,
  type BodyPose,
  FLOOR,
  type Limb,
  MAT,
  type MoveSet,
  PROPS,
  type Pt,
  skeleton,
} from "../moves";
import type { Palette } from "../palettes";
import { BodyInk } from "./BodyInk";
import { useCastMember } from "./stage";
import { mix } from "./theme";

/**
 * Full-body cartoon person seen from the side, facing right, in workout clothes,
 * drawn in the 480 × 400 box of moves.ts. Colours come from the cast member.
 */

const INK = "#2A2135";
const LEGGINGS = "#2E3350";
const SHOE = "#F7F7FB";
const SOLE = "#C9CCDA";
const WOOD = "#C8874E";
const WOOD_DARK = "#9C6136";

const line = (a: Pt, b: Pt) => `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}`;
const along = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

function Leg({ leg, dir, color }: { leg: Limb; dir: Pt; color: string }) {
  const [ax, ay] = leg.end;
  // The sole sits a little below the ankle, on the side the foot faces down.
  const n: Pt = [-dir[1] * 4, dir[0] * 4];
  const heel: Pt = [ax - dir[0] * BONES.heel + n[0], ay - dir[1] * BONES.heel + n[1]];
  const toe: Pt = [ax + dir[0] * BONES.foot + n[0], ay + dir[1] * BONES.foot + n[1]];
  const soleN: Pt = [n[0] * 1.6, n[1] * 1.6];
  return (
    <g strokeLinecap="round" fill="none">
      <path d={line(leg.root, leg.joint)} stroke={color} strokeWidth={30} />
      <path d={line(leg.joint, leg.end)} stroke={color} strokeWidth={24} />
      <path d={line(heel, toe)} stroke={SHOE} strokeWidth={13} />
      <path
        d={line([heel[0] + soleN[0], heel[1] + soleN[1]], [toe[0] + soleN[0], toe[1] + soleN[1]])}
        stroke={SOLE}
        strokeWidth={4}
      />
    </g>
  );
}

function Arm({ arm, skin, sleeve }: { arm: Limb; skin: string; sleeve: string }) {
  return (
    <g strokeLinecap="round" fill="none">
      <path d={line(arm.root, arm.joint)} stroke={skin} strokeWidth={17} />
      <path d={line(arm.joint, arm.end)} stroke={skin} strokeWidth={15} />
      <path d={line(arm.root, along(arm.root, arm.joint, 0.5))} stroke={sleeve} strokeWidth={22} />
      <circle cx={arm.end[0]} cy={arm.end[1]} r={9.5} fill={skin} />
    </g>
  );
}

/** Hair in the head's own frame: centre at 0,0, face towards +x. */
function Hair({ c }: { c: CastMember }) {
  const h = c.hairColor;
  const cap =
    "M -27 8 C -32 -20, -10 -35, 10 -31 C 22 -28, 28 -18, 26 -11 C 14 -19, 0 -18, -8 -9 C -12 -3, -16 3, -18 11 Z";
  switch (c.hair) {
    case "short":
      return <path d={cap} fill={h} />;
    case "spiky":
      return (
        <path
          d="M -27 8 C -30 -14, -24 -26, -14 -30 L -12 -40 L -2 -32 L 4 -42 L 10 -31 L 20 -36 L 20 -26 C 26 -22, 28 -16, 26 -11 C 14 -19, 0 -18, -8 -9 C -12 -3, -16 3, -18 11 Z"
          fill={h}
        />
      );
    case "curly":
      return (
        <g fill={h}>
          {[
            [-24, 6],
            [-26, -8],
            [-20, -20],
            [-8, -28],
            [6, -30],
            [18, -24],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={11} />
          ))}
        </g>
      );
    case "bun":
      return (
        <g fill={h}>
          <circle cx={-24} cy={-22} r={11} />
          <path d={cap} />
        </g>
      );
    case "long":
      return (
        <g fill={h}>
          <path d="M -24 -10 C -36 6, -34 28, -26 40 C -20 30, -16 12, -12 -2 Z" />
          <path d={cap} />
        </g>
      );
    case "bob":
      return (
        <path
          d="M -28 20 C -36 -20, -8 -37, 12 -31 C 24 -27, 29 -17, 26 -10 C 12 -18, -2 -16, -8 -6 L -8 22 C -14 25, -22 24, -28 20 Z"
          fill={h}
        />
      );
    case "bald":
      return <ellipse cx={-21} cy={4} rx={7} ry={11} fill={h} />;
    case "hijab":
      return null;
  }
}

function Head({ c, at, face, blink }: { c: CastMember; at: Pt; face: number; blink: number }) {
  const skinShade = mix(c.skin, "#000000", 0.16);
  const hijab = c.hair === "hijab";
  return (
    <g transform={`translate(${at[0]} ${at[1]}) rotate(${face})`}>
      {hijab && <path d="M -32 6 C -36 36, -6 50, 22 38 L 14 18 Z" fill={c.hairColor} />}
      <circle r={BONES.head} fill={c.skin} />
      {hijab ? (
        <path
          d="M -31 14 C -38 -24, -6 -40, 16 -31 C 25 -27, 29 -21, 30 -15 C 20 -19, 9 -16, 4 -8 C 0 2, 0 16, 6 26 C -8 30, -22 26, -31 14 Z"
          fill={c.hairColor}
        />
      ) : (
        <ellipse cx={-3} cy={3} rx={5} ry={7} fill={skinShade} />
      )}
      <Hair c={c} />
      {c.beard && <path d="M -4 9 C 0 27, 18 31, 27 12 C 20 19, 10 19, 4 12 Z" fill={c.beard} />}
      <circle cx={12} cy={8} r={4.5} fill="#FF6F7D" opacity={0.25} />
      <g transform={`translate(13 -3) scale(1 ${1 - 0.9 * blink})`}>
        <ellipse rx={3.2} ry={4.2} fill={INK} />
        <circle cx={1} cy={-1.4} r={1.1} fill="#FFFFFF" />
      </g>
      <path
        d="M 8 -11 L 19 -12"
        stroke={hijab || c.hair === "bald" ? mix(c.skin, INK, 0.7) : mix(c.hairColor, INK, 0.4)}
        strokeWidth={2.8}
        strokeLinecap="round"
      />
      <path d="M 25 -3 Q 32 4 25 7" fill={c.skin} stroke={skinShade} strokeWidth={2} />
      <path d="M 14 14 Q 19 17 23 13" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      {c.glasses && (
        <g fill="none" stroke="#2A2A33" strokeWidth={2.2}>
          <circle cx={14} cy={-3} r={7.5} fill="#FFFFFF" fillOpacity={0.15} />
          <path d="M 6.5 -4 L -4 -3" />
        </g>
      )}
    </g>
  );
}

/** Chair seen from the side. `back` is the x of the backrest post; the seat extends towards `seat`. */
function Chair({ backX, backTop, seatX, seatY }: { backX: number; backTop: number; seatX: Pt; seatY: number }) {
  const [x0, x1] = seatX;
  const front = backX === x0 ? x1 - 10 : x0;
  return (
    <g>
      <rect x={backX} y={backTop} width={10} height={FLOOR - backTop} rx={4} fill={WOOD_DARK} />
      <rect x={backX - 3} y={backTop} width={16} height={46} rx={5} fill={WOOD} />
      <rect x={front} y={seatY} width={10} height={FLOOR - seatY} rx={4} fill={WOOD_DARK} />
      <rect x={x0 - 4} y={seatY - 6} width={x1 - x0 + 8} height={13} rx={6} fill={WOOD} />
    </g>
  );
}

const SKY_TOP = "#BFE4FF";
const SKY_BOTTOM = "#EEF8FF";
const POT = "#D9774A";
const LEAF = "#2FA36B";
const LEAF_LIGHT = "#5CC48A";
const FLOOR_WOOD = "#F0D3A8";
const FLOOR_EDGE = "#D7A86F";
const FLOOR_SEAM = "#E2BA88";

/** A window with sky, sun and a hill, and a curtain. Top-left corner at x, y. */
function Window({ x, y, palette }: { x: number; y: number; palette: Palette }) {
  const w = 96;
  const h = 132;
  return (
    <g>
      <rect x={x - 6} y={y - 6} width={w + 12} height={h + 12} rx={7} fill="#FFFFFF" />
      <rect x={x} y={y} width={w} height={h} rx={3} fill="url(#sky)" />
      <circle cx={x + w - 24} cy={y + 28} r={13} fill={palette.accent2} />
      <ellipse cx={x + 30} cy={y + 46} rx={18} ry={7} fill="#FFFFFF" opacity={0.9} />
      <ellipse cx={x + 42} cy={y + 41} rx={12} ry={8} fill="#FFFFFF" opacity={0.9} />
      <path d={`M ${x} ${y + h - 26} Q ${x + w * 0.45} ${y + h - 52} ${x + w} ${y + h - 30} L ${x + w} ${y + h} L ${x} ${y + h} Z`} fill={LEAF_LIGHT} opacity={0.8} />
      <path d={`M ${x + w / 2} ${y} L ${x + w / 2} ${y + h} M ${x} ${y + h / 2} L ${x + w} ${y + h / 2}`} stroke="#FFFFFF" strokeWidth={5} />
      <rect x={x - 12} y={y + h + 4} width={w + 24} height={9} rx={4} fill="#FFFFFF" />
      <path
        d={`M ${x - 16} ${y - 12} L ${x + 18} ${y - 12} C ${x + 10} ${y + 40}, ${x + 22} ${y + 90}, ${x + 12} ${y + h + 2} L ${x - 16} ${y + h + 2} Z`}
        fill={mix(palette.accent, "#FFFFFF", 0.55)}
      />
      <rect x={x - 24} y={y - 18} width={w + 48} height={7} rx={3.5} fill={mix(palette.text, "#FFFFFF", 0.55)} />
    </g>
  );
}

/** A pot plant standing on the floor, centred on x. */
function Plant({ x }: { x: number }) {
  const leaves: [number, number, number][] = [
    [-20, -62, -38],
    [16, -66, 34],
    [-6, -78, -8],
    [-28, -40, -62],
    [26, -44, 58],
  ];
  return (
    <g>
      {leaves.map(([dx, dy, rot], i) => (
        <ellipse
          key={`${dx}-${dy}`}
          cx={x + dx}
          cy={FLOOR - 40 + dy}
          rx={9}
          ry={24}
          transform={`rotate(${rot} ${x + dx} ${FLOOR - 40 + dy})`}
          fill={i % 2 ? LEAF_LIGHT : LEAF}
        />
      ))}
      <path d={`M ${x - 22} ${FLOOR - 44} L ${x + 22} ${FLOOR - 44} L ${x + 16} ${FLOOR} L ${x - 16} ${FLOOR} Z`} fill={POT} />
      <rect x={x - 25} y={FLOOR - 50} width={50} height={10} rx={4} fill={mix(POT, "#000000", 0.12)} />
    </g>
  );
}

/**
 * A bright living room behind the figure: wall, panelling, skirting, wooden floor, a window and a plant.
 * When the figure walks in place the room scrolls with the floor.
 */
function Room({ set, palette, scroll }: { set: MoveSet; palette: Palette; scroll: number }) {
  // mix() returns rgb(), so both colours mix straight from the palette's hex values.
  const wall = mix(palette.surface2, palette.accent2, 0.1);
  const panel = mix(palette.surface2, palette.accent, 0.1);
  const walking = scroll !== 0;
  const period = 440;
  const offset = ((scroll % period) + period) % period;
  const copies = walking ? [-2, -1, 0, 1, 2, 3] : [0];
  const seams = 14;
  return (
    <g>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={SKY_TOP} />
          <stop offset="1" stopColor={SKY_BOTTOM} />
        </linearGradient>
      </defs>
      {/* Wall, floor and panelling run far past the box; the scene's stage card clips them. */}
      <rect x={-600} y={-600} width={BOX.width + 1200} height={FLOOR + 600} fill={wall} />
      <rect x={-600} y={FLOOR - 74} width={BOX.width + 1200} height={74} fill={panel} />
      <rect x={-600} y={FLOOR - 78} width={BOX.width + 1200} height={6} rx={3} fill="#FFFFFF" opacity={0.9} />
      {copies.map((k) => {
        const dx = k * period - offset;
        return (
          <g key={k} transform={`translate(${dx} 0)`}>
            <Window x={18} y={44} palette={palette} />
            {set !== "mat" && <Plant x={58} />}
          </g>
        );
      })}
      <rect x={-600} y={FLOOR - 12} width={BOX.width + 1200} height={12} fill="#FFFFFF" />
      <rect x={-600} y={FLOOR} width={BOX.width + 1200} height={240} fill={FLOOR_WOOD} />
      <g stroke={FLOOR_SEAM} strokeWidth={3} strokeLinecap="round">
        {Array.from({ length: seams }, (_, i) => {
          const x = ((((i * 120 - scroll) % (seams * 120)) + seams * 120) % (seams * 120)) - 600;
          return <path key={i} d={`M ${x} ${FLOOR + 6} l -10 34`} />;
        })}
        <path d={`M -600 ${FLOOR + 22} L ${BOX.width + 600} ${FLOOR + 22}`} />
      </g>
      <path d={`M -600 ${FLOOR} L ${BOX.width + 600} ${FLOOR}`} stroke={FLOOR_EDGE} strokeWidth={4} />
    </g>
  );
}

function Set({ set, palette, scroll }: { set: MoveSet; palette: Palette; scroll: number }) {
  return (
    <g>
      <Room set={set} palette={palette} scroll={scroll} />
      {set === "wall" && (
        <g>
          <rect x={PROPS.wallX} y={-600} width={600} height={FLOOR + 600} fill={mix(palette.surface2, palette.text, 0.08)} />
          <rect x={PROPS.wallX} y={FLOOR - 16} width={600} height={16} fill={mix(palette.surface2, palette.text, 0.18)} />
          <path d={`M ${PROPS.wallX} -600 L ${PROPS.wallX} ${FLOOR}`} stroke={mix(palette.surface2, palette.text, 0.24)} strokeWidth={4} />
        </g>
      )}
      {set === "mat" && (
        <g>
          <rect x={22} y={MAT} width={BOX.width - 44} height={FLOOR - MAT + 2} rx={4} fill={mix(palette.accent, "#000000", 0.12)} />
          <rect x={22} y={MAT} width={BOX.width - 44} height={3} rx={1.5} fill={mix(palette.accent, "#FFFFFF", 0.25)} />
        </g>
      )}
      {set === "chair-behind" && <Chair {...PROPS.chairBehind} />}
      {set === "chair-front" && <Chair {...PROPS.chairFront} />}
    </g>
  );
}

export const Body: React.FC<{
  who: string;
  pose: BodyPose;
  set: MoveSet;
  palette: Palette;
  /** Scene frame, for blinking. */
  frame: number;
  /** Floor scroll in box units (walking in place). */
  scroll?: number;
  /** Part of the box to show, [x, y, width, height]; the whole box by default. */
  view?: [number, number, number, number];
  width: number;
  height: number;
  /** Paper look: ink stick figure in the sketch cast's style, in a hand-drawn room. */
  ink?: boolean;
}> = ({ who, pose, set, palette, frame, scroll = 0, view, width, height, ink }) => {
  const c = useCastMember(who);
  if (ink) {
    const box: [number, number, number, number] = view ?? [0, 0, BOX.width, BOX.height];
    return <BodyInk c={c} pose={pose} set={set} frame={frame} scroll={scroll} view={box} width={width} height={height} />;
  }
  const sk = skeleton(pose);
  const farSkin = mix(c.skin, "#000000", 0.14);
  const farTop = mix(c.top, "#000000", 0.2);
  const farLegs = mix(LEGGINGS, "#000000", 0.25);
  const inBlink = (frame + who.length * 37) % 130;
  const blink = inBlink < 5 ? Math.sin((inBlink / 5) * Math.PI) : 0;
  const ground = set === "mat" ? MAT : FLOOR;
  const torsoStart = along(sk.hip, sk.shoulder, 0.12);
  const neckEnd = along(sk.shoulder, sk.head, 0.6);

  return (
    <svg
      width={width}
      height={height}
      viewBox={(view ?? [0, 0, BOX.width, BOX.height]).join(" ")}
      style={{ overflow: "visible" }}
    >
      <title>{c.name}</title>
      <Set set={set} palette={palette} scroll={scroll} />
      <ellipse cx={sk.hip[0]} cy={ground + 2} rx={86} ry={6} fill="#000000" opacity={0.1} />

      <Arm arm={sk.arms[1]} skin={farSkin} sleeve={farTop} />
      <Leg leg={sk.legs[1]} dir={sk.feet[1]} color={farLegs} />

      <circle cx={sk.hip[0]} cy={sk.hip[1]} r={22} fill={LEGGINGS} />
      <path d={line(sk.shoulder, neckEnd)} stroke={mix(c.skin, "#000000", 0.16)} strokeWidth={16} strokeLinecap="round" />
      <path d={line(torsoStart, sk.shoulder)} stroke={c.top} strokeWidth={46} strokeLinecap="round" />

      <Leg leg={sk.legs[0]} dir={sk.feet[0]} color={LEGGINGS} />
      <Head c={c} at={sk.head} face={sk.face} blink={blink} />
      <Arm arm={sk.arms[0]} skin={c.skin} sleeve={c.top} />
    </svg>
  );
};
