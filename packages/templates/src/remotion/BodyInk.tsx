import type { CastMember } from "../cast";
import { BONES, BOX, type BodyPose, FLOOR, type Limb, MAT, type MoveSet, PROPS, type Pt, skeleton } from "../moves";
import { FaceArt, Hair } from "./paper/Figure";
import { INK } from "./paper/ink";

/**
 * The exercise figure in the paper look: the same skeleton as Body.tsx, drawn like the sketch cast
 * (ink stick limbs, a bean body in the cast member's colours, a big round head with their hair and face)
 * in a hand-drawn living room. Box units (480 × 400, moves.ts).
 */

/** Head radius. The sketch figure's head art is drawn for 56, so it is scaled by K. */
const R = 40;
const K = R / 56;
const LIMB = 9;
const LINE = 3.2;
const FAR = "#8F847A";
const BODY_W = 60;

const WALL = "#F6EEDD";
const FLOOR_FILL = "#E9CFA3";
const WOOD = "#C99A5B";

const along = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const stroke = { stroke: INK, strokeWidth: LINE, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function Limb2({ limb, color }: { limb: Limb; color: string }) {
  const [r, j, e] = [limb.root, limb.joint, limb.end];
  return (
    <path
      d={`M ${r[0]} ${r[1]} L ${j[0]} ${j[1]} L ${e[0]} ${e[1]}`}
      fill="none"
      stroke={color}
      strokeWidth={LIMB}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function Foot({ leg, dir, color }: { leg: Limb; dir: Pt; color: string }) {
  const mid: Pt = [leg.end[0] + (dir[0] * (BONES.foot - BONES.heel)) / 2, leg.end[1] + (dir[1] * (BONES.foot - BONES.heel)) / 2];
  const angle = (Math.atan2(dir[1], dir[0]) * 180) / Math.PI;
  return (
    <ellipse
      cx={mid[0]}
      cy={mid[1] + 3}
      rx={(BONES.foot + BONES.heel) / 2 + 2}
      ry={7.5}
      fill={color}
      transform={`rotate(${angle} ${mid[0]} ${mid[1] + 3})`}
    />
  );
}

function Hand({ at, skin }: { at: Pt; skin: string }) {
  return <circle cx={at[0]} cy={at[1]} r={8.5} fill={skin} stroke={INK} strokeWidth={2.6} />;
}

/** Window, plant, skirting and floor, drawn in ink. Repeats every 440 units when walking in place. */
function InkRoom({ set, scroll }: { set: MoveSet; scroll: number }) {
  const period = 440;
  const offset = ((scroll % period) + period) % period;
  const copies = scroll !== 0 ? [-2, -1, 0, 1, 2, 3] : [0];
  const seams = 14;
  return (
    <g>
      <rect x={-600} y={-600} width={BOX.width + 1200} height={FLOOR + 600} fill={WALL} />
      {copies.map((k) => (
        <g key={k} transform={`translate(${k * period - offset} 0)`}>
          {/* Window */}
          <rect x={14} y={40} width={104} height={140} fill="#BFE3F2" {...stroke} />
          <ellipse cx={46} cy={78} rx={20} ry={8} fill="#FFFFFF" />
          <circle cx={92} cy={66} r={11} fill="#FFD84A" stroke={INK} strokeWidth={2.2} />
          <path d="M 14 150 Q 60 124 118 146 L 118 180 L 14 180 Z" fill="#A9DA8E" />
          <rect x={14} y={40} width={104} height={140} fill="none" {...stroke} />
          <path d="M 66 40 L 66 180 M 14 110 L 118 110" fill="none" {...stroke} />
          <rect x={6} y={180} width={120} height={9} rx={3} fill="#FFFFFF" {...stroke} />
          {/* Picture */}
          <rect x={300} y={70} width={70} height={54} fill="#FFFFFF" {...stroke} />
          <path d="M 306 118 L 326 92 L 340 108 L 350 98 L 364 118 Z" fill="#7FC7A0" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
          {/* Plant */}
          {set !== "mat" && (
            <g transform={`translate(62 ${FLOOR})`}>
              {[
                [-18, -78, -34],
                [16, -82, 30],
                [-2, -96, -4],
                [-26, -58, -60],
                [26, -60, 56],
              ].map(([dx, dy, rot]) => (
                <ellipse key={`${dx}`} cx={dx} cy={dy} rx={10} ry={25} transform={`rotate(${rot} ${dx} ${dy})`} fill="#5DBB63" stroke={INK} strokeWidth={2.4} />
              ))}
              <path d="M -22 -46 L 22 -46 L 16 0 L -16 0 Z" fill="#E07A4F" {...stroke} />
            </g>
          )}
        </g>
      ))}
      <rect x={-600} y={FLOOR - 14} width={BOX.width + 1200} height={14} fill="#FFFFFF" />
      <path d={`M -600 ${FLOOR - 14} L ${BOX.width + 600} ${FLOOR - 14}`} stroke={INK} strokeWidth={2} />
      <rect x={-600} y={FLOOR} width={BOX.width + 1200} height={240} fill={FLOOR_FILL} />
      <g stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.3}>
        {Array.from({ length: seams }, (_, i) => {
          const x = ((((i * 120 - scroll) % (seams * 120)) + seams * 120) % (seams * 120)) - 600;
          return <path key={i} d={`M ${x} ${FLOOR + 8} l -10 34`} />;
        })}
      </g>
      <path d={`M -600 ${FLOOR} L ${BOX.width + 600} ${FLOOR}`} {...stroke} />
    </g>
  );
}

function InkChair({ backX, backTop, seatX, seatY }: { backX: number; backTop: number; seatX: Pt; seatY: number }) {
  const [x0, x1] = seatX;
  const front = backX === x0 ? x1 - 10 : x0;
  return (
    <g>
      <rect x={backX} y={backTop} width={10} height={FLOOR - backTop} rx={3} fill={WOOD} {...stroke} />
      <rect x={backX - 3} y={backTop} width={16} height={46} rx={4} fill={WOOD} {...stroke} />
      <rect x={front} y={seatY} width={10} height={FLOOR - seatY} rx={3} fill={WOOD} {...stroke} />
      <rect x={x0 - 4} y={seatY - 6} width={x1 - x0 + 8} height={13} rx={5} fill={WOOD} {...stroke} />
    </g>
  );
}

function InkSet({ set, scroll }: { set: MoveSet; scroll: number }) {
  return (
    <g>
      <InkRoom set={set} scroll={scroll} />
      {set === "wall" && (
        <g>
          <rect x={PROPS.wallX} y={-600} width={600} height={FLOOR + 600} fill="#EADFC8" />
          <path d={`M ${PROPS.wallX} -600 L ${PROPS.wallX} ${FLOOR}`} {...stroke} />
        </g>
      )}
      {set === "mat" && <rect x={22} y={MAT} width={BOX.width - 44} height={FLOOR - MAT + 2} rx={3} fill="#F2A65A" {...stroke} />}
      {set === "chair-behind" && <InkChair {...PROPS.chairBehind} />}
      {set === "chair-front" && <InkChair {...PROPS.chairFront} />}
    </g>
  );
}

export const BodyInk: React.FC<{
  c: CastMember;
  pose: BodyPose;
  set: MoveSet;
  frame: number;
  scroll: number;
  view: [number, number, number, number];
  width: number;
  height: number;
}> = ({ c, pose, set, frame, scroll, view, width, height }) => {
  const sk = skeleton(pose);
  const ground = set === "mat" ? MAT : FLOOR;
  // The bean body runs a little past the hip and the shoulder.
  const a = along(sk.hip, sk.shoulder, -0.16);
  const b = along(sk.hip, sk.shoulder, 1.12);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  const mid = along(a, b, 0.5);
  // The bigger head sits on the shoulders along the neck, and never sinks into the floor.
  const nx = sk.head[0] - sk.shoulder[0];
  const ny = sk.head[1] - sk.shoulder[1];
  const nl = Math.hypot(nx, ny) || 1;
  const reach = BONES.neck + R - 6;
  const head: Pt = [sk.shoulder[0] + (nx / nl) * reach, Math.min(sk.shoulder[1] + (ny / nl) * reach, ground - R - 1)];
  const blink = (frame + c.name.length * 37) % 130 < 4;

  return (
    <svg width={width} height={height} viewBox={view.join(" ")} style={{ overflow: "visible" }}>
      <title>{c.name}</title>
      <InkSet set={set} scroll={scroll} />
      <ellipse cx={sk.hip[0]} cy={ground + 3} rx={80} ry={6} fill="#000000" opacity={0.12} />

      {/* Far side */}
      <Limb2 limb={sk.arms[1]} color={FAR} />
      <Hand at={sk.arms[1].end} skin={c.skin} />
      <Limb2 limb={sk.legs[1]} color={FAR} />
      <Foot leg={sk.legs[1]} dir={sk.feet[1]} color={FAR} />

      {/* Near leg, body, head, near arm */}
      <Limb2 limb={sk.legs[0]} color={INK} />
      <Foot leg={sk.legs[0]} dir={sk.feet[0]} color={INK} />
      <g transform={`translate(${mid[0]} ${mid[1]}) rotate(${angle})`}>
        <rect x={-len / 2} y={-BODY_W / 2} width={len} height={BODY_W} rx={BODY_W / 2} fill={c.top} {...stroke} />
      </g>
      <g transform={`translate(${head[0]} ${head[1]}) rotate(${sk.face * 0.6}) scale(${K})`}>
        <Hair look={c} back cy={0} />
        <circle r={56} fill={c.skin} stroke={INK} strokeWidth={LINE / K} />
        {c.beard && (
          <path d="M -52 16 Q 0 92 52 16 Q 28 44 10 44 Q -20 44 -52 16 Z" fill={c.beard} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        )}
        <Hair look={c} cy={0} />
        <FaceArt face="happy" cy={0} loud={0} blink={blink} glasses={c.glasses} frame={frame} />
      </g>
      <Limb2 limb={sk.arms[0]} color={INK} />
      <Hand at={sk.arms[0].end} skin={c.skin} />
    </svg>
  );
};
