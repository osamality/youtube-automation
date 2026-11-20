import type { CastMember } from "../../cast";
import type { Act, Face, Hat } from "../../paper";
import { Hand, INK, lerp, STROKE } from "./ink";

/**
 * A stick figure: big round head, bean body, thin arms and legs. Drawn facing right with its feet
 * at (0, 0); about 320 units tall. The parent places, scales and flips it.
 */

const HEAD_R = 56;
const HEAD_Y = -262;
const SHOULDER_Y = -196;
const HIP_Y = -95;
const LIMB = 9;

type P = [number, number];
interface ArmPose {
  l: P;
  r: P;
  /** How far each elbow sticks out sideways from the straight line. */
  bl: number;
  br: number;
}

const ARMS: Record<Act, ArmPose> = {
  stand: { l: [-50, -112], r: [50, -112], bl: -10, br: 10 },
  wave: { l: [-50, -112], r: [80, -292], bl: -10, br: 20 },
  point: { l: [-50, -112], r: [114, -206], bl: -10, br: -6 },
  cheer: { l: [-76, -300], r: [76, -300], bl: -16, br: 16 },
  shrug: { l: [-86, -186], r: [86, -186], bl: 26, br: -26 },
  think: { l: [-50, -112], r: [26, -220], bl: -10, br: 32 },
  phone: { l: [-50, -112], r: [46, -258], bl: -10, br: 32 },
  hold: { l: [44, -150], r: [74, -160], bl: -16, br: -12 },
  hips: { l: [-48, -128], r: [48, -128], bl: -30, br: 30 },
  facepalm: { l: [-50, -112], r: [10, -270], bl: -10, br: 36 },
  sit: { l: [14, -70], r: [48, -70], bl: -12, br: 10 },
  type: { l: [50, -148], r: [78, -150], bl: -14, br: -10 },
  sleep: { l: [-40, -112], r: [40, -112], bl: -8, br: 8 },
  drink: { l: [-50, -112], r: [40, -232], bl: -10, br: 64 },
  flex: { l: [-96, -262], r: [96, -262], bl: -110, br: 110 },
  stretch: { l: [-28, -342], r: [28, -342], bl: -6, br: 6 },
  walk: { l: [-50, -112], r: [50, -112], bl: -10, br: 10 },
};

function arm(shoulder: P, hand: P, bend: number): string {
  const dx = hand[0] - shoulder[0];
  const dy = hand[1] - shoulder[1];
  const len = Math.hypot(dx, dy) || 1;
  const ex = (shoulder[0] + hand[0]) / 2 + (-dy / len) * bend;
  const ey = (shoulder[1] + hand[1]) / 2 + (dx / len) * bend;
  return `M ${shoulder[0]} ${shoulder[1]} Q ${ex} ${ey} ${hand[0]} ${hand[1]}`;
}

export const Hair: React.FC<{ look: CastMember; back?: boolean; cy: number }> = ({ look, back, cy }) => {
  const c = look.hairColor;
  const cap = `M -57 ${cy - 6} A 57 57 0 0 1 57 ${cy - 6} Q 34 ${cy - 30} 0 ${cy - 34} Q -34 ${cy - 30} -57 ${cy - 6} Z`;
  if (back) {
    if (look.hair === "long")
      return <rect x={-62} y={cy - 40} width={124} height={128} rx={34} fill={c} stroke={INK} strokeWidth={STROKE} />;
    if (look.hair === "bob")
      return <rect x={-64} y={cy - 46} width={128} height={96} rx={38} fill={c} stroke={INK} strokeWidth={STROKE} />;
    if (look.hair === "hijab")
      return (
        <path
          d={`M -64 ${cy} A 64 64 0 0 1 64 ${cy} L 58 ${cy + 86} L -58 ${cy + 86} Z`}
          fill={c}
          stroke={INK}
          strokeWidth={STROKE}
        />
      );
    if (look.hair === "bun")
      return <circle cx={-6} cy={cy - 66} r={22} fill={c} stroke={INK} strokeWidth={STROKE} />;
    return null;
  }
  switch (look.hair) {
    case "bald":
      return null;
    case "hijab":
      return (
        <path
          fillRule="evenodd"
          d={`M -60 ${cy} a 60 60 0 1 0 120 0 a 60 60 0 1 0 -120 0 Z M -36 ${cy + 6} a 40 42 0 1 0 80 0 a 40 42 0 1 0 -80 0 Z`}
          fill={c}
          stroke={INK}
          strokeWidth={STROKE}
        />
      );
    case "curly":
      return (
        <g fill={c} stroke={INK} strokeWidth={STROKE}>
          {[-150, -125, -100, -75, -50, -25, 0, 25, -175, 5].map((deg, i) => {
            const a = ((deg - 90 + 75) * Math.PI) / 180;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed list
              <circle key={i} cx={Math.cos(a) * 52} cy={cy + Math.sin(a) * 52} r={i % 2 ? 21 : 18} />
            );
          })}
          <path d={cap} stroke="none" />
        </g>
      );
    case "spiky":
      return (
        <path
          d={`M -57 ${cy - 6} L -52 ${cy - 52} L -38 ${cy - 40} L -28 ${cy - 76} L -10 ${cy - 50} L 4 ${cy - 84} L 18 ${cy - 52} L 36 ${cy - 74} L 42 ${cy - 40} L 57 ${cy - 48} L 57 ${cy - 6} Q 30 ${cy - 30} 0 ${cy - 32} Q -30 ${cy - 30} -57 ${cy - 6} Z`}
          fill={c}
          stroke={INK}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
      );
    default:
      // short, bun, long, bob: a cap of hair over the top of the head, swept to one side.
      return (
        <path
          d={`M -58 ${cy - 4} A 58 58 0 0 1 58 ${cy - 4} Q 52 ${cy - 26} 30 ${cy - 30} Q 0 ${cy - 40} -34 ${cy - 22} Q -48 ${cy - 16} -58 ${cy - 4} Z`}
          fill={c}
          stroke={INK}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
      );
  }
};

const HatArt: React.FC<{ hat: Hat; cy: number }> = ({ hat, cy }) => {
  const top = cy - HEAD_R;
  switch (hat) {
    case "tophat":
      return (
        <g stroke={INK} strokeWidth={STROKE}>
          <rect x={-36} y={top - 62} width={72} height={70} fill="#F7F3EA" />
          <rect x={-36} y={top - 12} width={72} height={14} fill="#C8372D" />
          <rect x={-58} y={top + 2} width={116} height={13} rx={6} fill="#F7F3EA" />
        </g>
      );
    case "cap":
      return (
        <g stroke={INK} strokeWidth={STROKE}>
          <path d={`M -56 ${top + 30} A 56 52 0 0 1 56 ${top + 30} Z`} fill="#2F6FD0" />
          <path d={`M 40 ${top + 30} L 96 ${top + 34} Q 92 ${top + 20} 54 ${top + 16} Z`} fill="#2459A8" />
        </g>
      );
    case "hardhat":
      return (
        <g stroke={INK} strokeWidth={STROKE}>
          <path d={`M -54 ${top + 26} A 54 56 0 0 1 54 ${top + 26} Z`} fill="#FFC928" />
          <rect x={-66} y={top + 22} width={132} height={13} rx={6} fill="#F2A20C" />
        </g>
      );
    case "crown":
      return (
        <path
          d={`M -46 ${top + 16} L -52 ${top - 34} L -26 ${top - 8} L 0 ${top - 46} L 26 ${top - 8} L 52 ${top - 34} L 46 ${top + 16} Z`}
          fill="#FFD23F"
          stroke={INK}
          strokeWidth={STROKE}
          strokeLinejoin="round"
        />
      );
  }
};

export const FaceArt: React.FC<{
  face: Face;
  cy: number;
  loud: number;
  blink: boolean;
  glasses?: boolean;
  frame: number;
}> = ({ face, cy, loud, blink, glasses, frame }) => {
  const fx = 10;
  const ey = cy - 6;
  const my = cy + 26;
  const open = 3 + loud * 15;
  const eye = (x: number) => {
    if (face === "laugh")
      return <path d={`M ${x - 9} ${ey + 3} Q ${x} ${ey - 9} ${x + 9} ${ey + 3}`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />;
    if (blink) return <line x1={x - 7} y1={ey} x2={x + 7} y2={ey} stroke={INK} strokeWidth={4} strokeLinecap="round" />;
    const r = face === "shock" ? 7.5 : 6;
    return (
      <g>
        {face === "shock" && <circle cx={x} cy={ey} r={12} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />}
        <circle cx={x} cy={ey} r={r} fill={INK} />
        {face === "smug" && <line x1={x - 10} y1={ey - 5} x2={x + 10} y2={ey - 3} stroke={INK} strokeWidth={4} strokeLinecap="round" />}
      </g>
    );
  };
  // Brows: [inner y offset, outer y offset] from a base above the eye.
  const brow: Record<Face, [number, number] | null> = {
    neutral: null,
    happy: null,
    laugh: null,
    sad: [-6, 3],
    shock: [-8, -8],
    angry: [6, -6],
    worried: [-7, 3],
    smug: [-2, -6],
  };
  const b = brow[face];
  let mouth: React.ReactNode;
  switch (face) {
    case "happy":
      mouth =
        loud > 0.08 ? (
          <path d={`M ${fx - 17} ${my - 4} Q ${fx} ${my + open + 8} ${fx + 17} ${my - 4} Z`} fill="#7A2B2B" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
        ) : (
          <path d={`M ${fx - 17} ${my - 4} Q ${fx} ${my + 13} ${fx + 17} ${my - 4}`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        );
      break;
    case "laugh":
      mouth = <path d={`M ${fx - 20} ${my - 6} Q ${fx} ${my + 26 + Math.sin(frame / 2.2) * 3} ${fx + 20} ${my - 6} Z`} fill="#7A2B2B" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />;
      break;
    case "sad":
      mouth = <path d={`M ${fx - 15} ${my + 8} Q ${fx} ${my - 8 - loud * 4} ${fx + 15} ${my + 8}`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />;
      break;
    case "shock":
      mouth = <ellipse cx={fx} cy={my + 4} rx={10} ry={14 + loud * 4} fill="#7A2B2B" stroke={INK} strokeWidth={3.5} />;
      break;
    case "angry":
      mouth =
        loud > 0.08 ? (
          <path d={`M ${fx - 16} ${my + 8} Q ${fx} ${my - 10} ${fx + 16} ${my + 8} Q ${fx} ${my + 6 + open} ${fx - 16} ${my + 8} Z`} fill="#7A2B2B" stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
        ) : (
          <path d={`M ${fx - 15} ${my + 7} Q ${fx} ${my - 6} ${fx + 15} ${my + 7}`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        );
      break;
    case "worried":
      mouth = <path d={`M ${fx - 16} ${my + 3} Q ${fx - 8} ${my - 6} ${fx} ${my + 3} T ${fx + 16} ${my + 3}`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />;
      break;
    case "smug":
      mouth = <path d={`M ${fx - 13} ${my + 2} Q ${fx + 4} ${my + 13} ${fx + 18} ${my - 5}`} fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />;
      break;
    default:
      mouth =
        loud > 0.08 ? (
          <ellipse cx={fx} cy={my + 2} rx={9} ry={open} fill="#7A2B2B" stroke={INK} strokeWidth={3.5} />
        ) : (
          <line x1={fx - 9} y1={my + 2} x2={fx + 9} y2={my + 2} stroke={INK} strokeWidth={4} strokeLinecap="round" />
        );
  }
  return (
    <g>
      {eye(fx - 19)}
      {eye(fx + 19)}
      {b && (
        <g stroke={INK} strokeWidth={4} strokeLinecap="round">
          <line x1={fx - 30} y1={ey - 20 + b[1]} x2={fx - 10} y2={ey - 20 + b[0]} />
          <line x1={fx + 10} y1={ey - 20 + b[0]} x2={fx + 30} y2={ey - 20 + b[1]} />
        </g>
      )}
      {glasses && (
        <g fill="rgba(255,255,255,0.25)" stroke={INK} strokeWidth={3.5}>
          <circle cx={fx - 19} cy={ey} r={15} />
          <circle cx={fx + 19} cy={ey} r={15} />
          <line x1={fx - 4} y1={ey} x2={fx + 4} y2={ey} />
        </g>
      )}
      {mouth}
      {face === "worried" && (
        <path
          d={`M ${-40} ${cy - 30 + ((frame * 0.8) % 26)} q -7 12 0 16 q 7 -4 0 -16 Z`}
          fill="#9AD4F5"
          stroke={INK}
          strokeWidth={2}
          opacity={1 - ((frame * 0.8) % 26) / 30}
        />
      )}
    </g>
  );
};

export const Figure: React.FC<{
  look: CastMember;
  frame: number;
  /** Voice loudness 0–1 when this figure is the one talking, else 0. */
  loud: number;
  face: Face;
  act: Act;
  /** The pose before the current one and how far the change has gone (0–1). */
  prevAct?: Act;
  blend?: number;
  hat?: Hat;
  /** 0–1: how much the legs are walking. */
  walk?: number;
  seed?: number;
}> = ({ look, frame, loud, face, act, prevAct, blend = 1, hat, walk: walking = 0, seed = 0 }) => {
  // "walk" walks in place; otherwise the legs walk only while the figure moves.
  const walk = act === "walk" ? Math.max(walking, blend) : walking;
  const asleep = act === "sleep" && blend > 0.5;
  const sitting = act === "sit" && blend > 0.5;
  const dy = sitting ? 37 : 0;
  const bob = Math.sin((frame + seed * 17) / 11) * 1.6 + Math.abs(Math.sin(frame * 0.3)) * -6 * walk + (act === "cheer" ? -Math.abs(Math.sin(frame / 4)) * 14 : 0);
  const y0 = dy + bob;
  const cy = HEAD_Y + y0;

  const from = ARMS[prevAct ?? act];
  const to = ARMS[act];
  const mixP = (a: P, b: P): P => [lerp(a[0], b[0], blend), lerp(a[1], b[1], blend)];
  let l = mixP(from.l, to.l);
  let r = mixP(from.r, to.r);
  const bl = lerp(from.bl, to.bl, blend);
  const br = lerp(from.br, to.br, blend);
  // Small life in the hands: talking gestures, waving, typing, walking swing.
  const talk = Math.min(1, loud * 1.6);
  if (act === "wave") r = [r[0] + Math.sin(frame / 3.2) * 14, r[1]];
  if (act === "type") {
    l = [l[0], l[1] + Math.sin(frame / 1.7) * 4];
    r = [r[0], r[1] + Math.cos(frame / 1.9) * 4];
  }
  if (act === "stretch") {
    const sway = Math.sin(frame / 16) * 12;
    l = [l[0] + sway, l[1]];
    r = [r[0] + sway, r[1]];
  }
  if (act === "flex") {
    const pump = Math.sin(frame / 6) * 5;
    l = [l[0], l[1] + pump];
    r = [r[0], r[1] + pump];
  }
  if (act === "stand" || act === "point" || act === "shrug") r = [r[0] + talk * 8, r[1] - talk * 14 * (0.5 + 0.5 * Math.sin(frame / 5))];
  if (walk > 0.05) {
    const sw = Math.sin(frame * 0.3) * 22 * walk;
    l = [l[0] - sw, l[1]];
    r = [r[0] + sw, r[1]];
  }
  const sl: P = [-30, SHOULDER_Y + y0];
  const sr: P = [30, SHOULDER_Y + y0];
  l = [l[0], l[1] + y0];
  r = [r[0], r[1] + y0];

  const hip = HIP_Y + y0;
  const step = Math.sin(frame * 0.3) * 26 * walk;
  const lift = (v: number) => Math.max(0, v) * 0.35;
  const legs = sitting ? (
    <g fill="none" stroke={INK} strokeWidth={LIMB} strokeLinecap="round" strokeLinejoin="round">
      <path d={`M -10 ${hip} L 34 ${hip} L 34 -4`} />
      <path d={`M 12 ${hip} L 58 ${hip} L 58 -4`} />
      <ellipse cx={44} cy={-3} rx={15} ry={7} fill={INK} stroke="none" />
      <ellipse cx={68} cy={-3} rx={15} ry={7} fill={INK} stroke="none" />
    </g>
  ) : (
    <g fill="none" stroke={INK} strokeWidth={LIMB} strokeLinecap="round">
      <line x1={-15} y1={hip} x2={-19 + step} y2={-5 - lift(step)} />
      <line x1={15} y1={hip} x2={19 - step} y2={-5 - lift(-step)} />
      <ellipse cx={-11 + step} cy={-3 - lift(step)} rx={16} ry={7} fill={INK} stroke="none" />
      <ellipse cx={27 - step} cy={-3 - lift(-step)} rx={16} ry={7} fill={INK} stroke="none" />
    </g>
  );

  const blink = asleep || (frame + seed * 31) % 96 < 4;
  const bodyTop = -216 + y0;
  const bodyH = 216 - 86;
  const sleeve = INK;

  const body = (
    <g>
      {!asleep && <ellipse cx={sitting ? 24 : 4} cy={4} rx={sitting ? 78 : 62} ry={11} fill="rgba(0,0,0,0.18)" />}
      <Hair look={look} back cy={cy} />
      {legs}
      <path d={arm(sl, l, bl)} fill="none" stroke={sleeve} strokeWidth={LIMB} strokeLinecap="round" />
      <circle cx={l[0]} cy={l[1]} r={10} fill={look.skin} stroke={INK} strokeWidth={3} />
      <rect x={-41} y={bodyTop} width={82} height={bodyH} rx={38} fill={look.top} stroke={INK} strokeWidth={STROKE} />
      <path d={`M -15 ${bodyTop + 5} L 0 ${bodyTop + 34} L 15 ${bodyTop + 5} Z`} fill={look.top2} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
      {look.tie && <path d={`M -6 ${bodyTop + 10} L 6 ${bodyTop + 10} L 9 ${bodyTop + 56} L 0 ${bodyTop + 68} L -9 ${bodyTop + 56} Z`} fill="#C8372D" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />}
      <circle cx={0} cy={cy} r={HEAD_R} fill={look.skin} stroke={INK} strokeWidth={STROKE} />
      {look.beard && (
        <path d={`M -52 ${cy + 16} Q 0 ${cy + 92} 52 ${cy + 16} Q 28 ${cy + 44} 10 ${cy + 44} Q -20 ${cy + 44} -52 ${cy + 16} Z`} fill={look.beard} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      )}
      {!hat && <Hair look={look} cy={cy} />}
      {hat && look.hair === "hijab" && <Hair look={look} cy={cy} />}
      <FaceArt face={face} cy={cy} loud={loud} blink={blink} glasses={look.glasses} frame={frame + seed * 7} />
      {hat && <HatArt hat={hat} cy={cy} />}
      {face === "shock" && (
        <g stroke={INK} strokeWidth={6} strokeLinecap="round" opacity={0.55 + 0.45 * Math.sin(frame / 2.5)}>
          {[-52, -26, 0, 26, 52].map((deg) => {
            const r = (deg - 90) * (Math.PI / 180);
            return <line key={deg} x1={Math.cos(r) * 78} y1={cy + Math.sin(r) * 78} x2={Math.cos(r) * 104} y2={cy + Math.sin(r) * 104} />;
          })}
        </g>
      )}
      <path d={arm(sr, r, br)} fill="none" stroke={sleeve} strokeWidth={LIMB} strokeLinecap="round" />
      {act === "phone" && blend > 0.6 && <rect x={r[0] - 2} y={r[1] - 26} width={18} height={36} rx={4} fill="#2B2A33" stroke={INK} strokeWidth={2.5} transform={`rotate(12 ${r[0]} ${r[1]})`} />}
      {act === "drink" && blend > 0.6 && (
        <g transform={`translate(${r[0]} ${r[1]}) rotate(-28)`}>
          <rect x={-14} y={-38} width={28} height={48} rx={4} fill="#DDF1FC" stroke={INK} strokeWidth={2.5} />
          <rect x={-12} y={-16} width={24} height={24} rx={2} fill="#7CC4F0" />
        </g>
      )}
      <circle cx={r[0]} cy={r[1]} r={10} fill={look.skin} stroke={INK} strokeWidth={3} />
    </g>
  );
  if (!asleep) return body;
  // Asleep: lying on its back with the head to the left of the feet (give the actor flip: false), under a blanket, breathing.
  const breathe = 1 + Math.sin(frame / 22) * 0.03;
  return (
    <g>
      <g transform="translate(0 -56) rotate(-90)">{body}</g>
      <g transform={`translate(-95 0) scale(1 ${breathe}) translate(95 0)`}>
        <rect x={-218} y={-118} width={244} height={118} rx={34} fill="#F29E7E" stroke={INK} strokeWidth={STROKE} />
        <rect x={-218} y={-118} width={42} height={118} rx={16} fill="#FFFFFF" stroke={INK} strokeWidth={STROKE} />
      </g>
      {[0, 1, 2].map((i) => {
        const t = ((frame + i * 22) % 66) / 66;
        return (
          <Hand key={i} x={-226 + t * 70} y={-150 - t * 110} size={26 + i * 8} opacity={Math.sin(t * Math.PI)}>
            Z
          </Hand>
        );
      })}
    </g>
  );
};
