import type { PropKind } from "../../paper";
import { clamp01 } from "../anim";
import { fit, Hand, INK, STROKE, tone as toneOf } from "./ink";
import type { PropSpec } from "./Props";

/**
 * Health channel props in the paper look. Same contract as Props.tsx: bottom centre at (0, 0),
 * roughly 150–400 units wide (the bus is a big one), `age` is frames since it appeared.
 */

export const HEALTH_PROP_KINDS: ReadonlySet<PropKind> = new Set<PropKind>([
  "dumbbell",
  "glass",
  "glasses",
  "bottle",
  "drop",
  "shoe",
  "heart",
  "fruit",
  "clock",
  "moon",
  "sun",
  "coffee",
  "bus",
  "stairs",
  "sofa",
  "mat",
  "thermometer",
]);

/** Health props that stand still (furniture and things on a surface); the rest float a little. */
export const HEALTH_STILL: readonly PropKind[] = [
  "dumbbell",
  "glass",
  "glasses",
  "bottle",
  "shoe",
  "fruit",
  "clock",
  "coffee",
  "bus",
  "stairs",
  "sofa",
  "mat",
  "thermometer",
];

const line = { stroke: INK, strokeWidth: STROKE, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const WATER = "#7CC4F0";
const WATER_TOP = "#B8E2FA";
const ease = (age: number, length: number) => 1 - (1 - clamp01(age / length)) ** 3;

/** A glass, tapered, with water at `level` (0–1). Bottom centre at (0, 0), 150 tall. */
const Glass: React.FC<{ level: number }> = ({ level }) => {
  const h = 150;
  const wl = h * level;
  const half = (y: number) => 42 + 13 * (y / h);
  return (
    <g>
      <path d={`M -55 ${-h} L -42 0 L 42 0 L 55 ${-h} Z`} fill="#FFFFFF" fillOpacity={0.7} />
      {level > 0.01 && (
        <g>
          <path d={`M ${-half(wl)} ${-wl} L -42 0 L 42 0 L ${half(wl)} ${-wl} Z`} fill={WATER} />
          <ellipse cx={0} cy={-wl} rx={half(wl)} ry={7} fill={WATER_TOP} stroke={INK} strokeWidth={2} />
        </g>
      )}
      <line x1={-30} y1={-h + 18} x2={-24} y2={-18} stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" opacity={0.8} />
      <path d={`M -55 ${-h} L -42 0 L 42 0 L 55 ${-h}`} fill="none" {...line} />
      <ellipse cx={0} cy={-h} rx={55} ry={9} fill="none" stroke={INK} strokeWidth={3} />
    </g>
  );
};

export const HealthPropArt: React.FC<{ p: PropSpec; frame: number; age: number }> = ({ p, frame, age }) => {
  const tn = toneOf(p.tone);
  const text = p.text ?? "";
  const label = (y: number, width = 300, max = 46) =>
    text ? (
      <Hand y={y} size={fit(text, width, max)} fill={p.tone ? tn.text : INK} outline="#FBF6E9">
        {text}
      </Hand>
    ) : null;
  const under = (y: number, width = 300, max = 40) =>
    p.text2 ? (
      <Hand y={y} size={fit(p.text2, width, max)} fill={p.tone ? tn.text : INK} outline="#FBF6E9">
        {p.text2}
      </Hand>
    ) : null;

  switch (p.kind) {
    case "dumbbell": {
      const c = p.tone ? tn.line : "#3D6BB3";
      return (
        <g>
          <rect x={-84} y={-50} width={168} height={18} rx={7} fill="#B9B4AA" {...line} />
          {[-1, 1].map((s) => (
            <g key={s}>
              <rect x={s > 0 ? 60 : -96} y={-86} width={36} height={86} rx={10} fill={c} {...line} />
              <rect x={s > 0 ? 98 : -122} y={-72} width={24} height={58} rx={8} fill={c} {...line} />
            </g>
          ))}
          {label(-128, 240)}
        </g>
      );
    }
    case "glass":
      return (
        <g>
          <Glass level={(p.value ?? 0.85) * ease(age, 26)} />
          {label(-196)}
          {under(40)}
        </g>
      );
    case "glasses": {
      // A row of glasses that fill one after another.
      const n = Math.max(1, Math.min(10, Math.round(p.value ?? 8)));
      const gap = 92;
      return (
        <g>
          {Array.from({ length: n }, (_, i) => {
            const t = ease(age - i * 5, 14);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed row
              <g key={i} transform={`translate(${(i - (n - 1) / 2) * gap} 0) scale(${0.55 * (0.4 + 0.6 * t)})`} opacity={clamp01(t * 3)}>
                <Glass level={0.85 * ease(age - i * 5 - 6, 18)} />
              </g>
            );
          })}
          {label(-130, n * gap, 54)}
          {under(44, n * gap, 40)}
        </g>
      );
    }
    case "bottle":
      return (
        <g>
          <rect x={-44} y={-250} width={88} height={250} rx={30} fill={WATER} fillOpacity={0.55} {...line} />
          <rect x={-44} y={-180} width={88} height={180} rx={30} fill={WATER} />
          <rect x={-44} y={-250} width={88} height={250} rx={30} fill="none" {...line} />
          <rect x={-26} y={-292} width={52} height={46} rx={8} fill={p.tone ? tn.line : "#3D6BB3"} {...line} />
          <rect x={-44} y={-150} width={88} height={64} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
          {text && (
            <Hand y={-118} size={fit(text, 76, 30)}>
              {text}
            </Hand>
          )}
          <line x1={-26} y1={-228} x2={-26} y2={-30} stroke="#FFFFFF" strokeWidth={7} strokeLinecap="round" opacity={0.6} />
        </g>
      );
    case "drop":
      return (
        <g>
          <path d="M 0 -300 C 40 -230 112 -170 112 -112 A 112 112 0 0 1 -112 -112 C -112 -170 -40 -230 0 -300 Z" fill={WATER} {...line} />
          <path d="M -62 -130 Q -66 -80 -34 -56" fill="none" stroke="#FFFFFF" strokeWidth={10} strokeLinecap="round" opacity={0.75} />
          {text && (
            <Hand y={-112} size={fit(text, 170, 70)} fill="#FFFFFF" outline={INK} outlineWidth={6}>
              {text}
            </Hand>
          )}
          {under(46)}
        </g>
      );
    case "shoe": {
      const c = p.tone ? tn.line : "#E8504A";
      return (
        <g>
          <path d="M -104 -22 L -104 -70 Q -96 -98 -50 -96 L -16 -74 L 44 -58 Q 100 -48 106 -22 Z" fill={c} {...line} />
          <path d="M -40 -88 L -20 -74 M -26 -94 L -6 -78 M -10 -98 L 8 -82" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" />
          <rect x={-110} y={-26} width={222} height={26} rx={12} fill="#FFFFFF" {...line} />
          {label(-140, 240)}
        </g>
      );
    }
    case "heart": {
      const beat = 1 + 0.07 * Math.max(0, Math.sin(frame / 4.5)) ** 4;
      return (
        <g transform={`translate(0 -95) scale(${beat}) translate(0 95)`}>
          <path
            d="M 0 0 C -128 -78 -126 -196 -58 -196 C -24 -196 0 -170 0 -150 C 0 -170 24 -196 58 -196 C 126 -196 128 -78 0 0 Z"
            fill={p.tone ? tn.line : "#E8504A"}
            {...line}
          />
          <path d="M -70 -160 Q -92 -140 -86 -112" fill="none" stroke="#FFFFFF" strokeWidth={9} strokeLinecap="round" opacity={0.7} />
          {text && (
            <Hand y={-100} size={fit(text, 150, 56)} fill="#FFFFFF" outline={INK} outlineWidth={5}>
              {text}
            </Hand>
          )}
          {under(44)}
        </g>
      );
    }
    case "fruit":
      return (
        <g>
          {/* Watermelon slice */}
          <g transform="translate(-80 0)">
            <path d="M -120 -120 A 120 120 0 0 0 120 -120 Z" fill="#3F8A4B" {...line} />
            <path d="M -104 -120 A 104 104 0 0 0 104 -120 Z" fill="#FF6B6B" />
            {[-60, -20, 20, 60].map((x) => (
              <ellipse key={x} cx={x} cy={-80 + Math.abs(x) * 0.3} rx={5} ry={8} fill={INK} />
            ))}
          </g>
          {/* Orange */}
          <g transform="translate(110 -70)">
            <circle r={70} fill="#F7A23B" {...line} />
            <circle r={52} fill="#FFC56B" stroke="#F7A23B" strokeWidth={3} />
            {[0, 60, 120].map((a) => (
              <line key={a} x1={-52 * Math.cos((a * Math.PI) / 180)} y1={-52 * Math.sin((a * Math.PI) / 180)} x2={52 * Math.cos((a * Math.PI) / 180)} y2={52 * Math.sin((a * Math.PI) / 180)} stroke="#F7A23B" strokeWidth={3} />
            ))}
            <circle r={70} fill="none" {...line} />
          </g>
          {label(-180, 360)}
        </g>
      );
    case "clock": {
      // An alarm clock. `value` is the time in hours (7.5 = 7:30). A negative tone makes it ring.
      const hours = p.value ?? 7;
      const ring = p.tone === "negative";
      const shake = ring ? Math.sin(frame * 1.9) * 6 : 0;
      const ha = ((hours % 12) / 12) * 360;
      const ma = (hours % 1) * 360;
      const sa = Math.floor(age / 15) * 6;
      return (
        <g transform={`rotate(${shake} 0 -130)`}>
          <line x1={-60} y1={-20} x2={-80} y2={0} {...line} strokeWidth={8} />
          <line x1={60} y1={-20} x2={80} y2={0} {...line} strokeWidth={8} />
          <circle cx={-66} cy={-220} r={30} fill={p.tone ? tn.line : "#E8504A"} {...line} />
          <circle cx={66} cy={-220} r={30} fill={p.tone ? tn.line : "#E8504A"} {...line} />
          <circle cx={0} cy={-125} r={105} fill={p.tone ? tn.line : "#E8504A"} {...line} />
          <circle cx={0} cy={-125} r={84} fill="#FFFFFF" {...line} />
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed ticks
              <line key={i} x1={Math.sin(a) * 70} y1={-125 - Math.cos(a) * 70} x2={Math.sin(a) * 78} y2={-125 - Math.cos(a) * 78} stroke={INK} strokeWidth={i % 3 ? 3 : 6} strokeLinecap="round" />
            );
          })}
          <line x1={0} y1={-125} x2={0} y2={-170} stroke={INK} strokeWidth={8} strokeLinecap="round" transform={`rotate(${ha} 0 -125)`} />
          <line x1={0} y1={-125} x2={0} y2={-190} stroke={INK} strokeWidth={5} strokeLinecap="round" transform={`rotate(${ma} 0 -125)`} />
          <line x1={0} y1={-125} x2={0} y2={-195} stroke="#E8504A" strokeWidth={2.5} strokeLinecap="round" transform={`rotate(${sa} 0 -125)`} />
          <circle cx={0} cy={-125} r={7} fill={INK} />
          {ring &&
            [-1, 1].map((s) => (
              <g key={s} stroke={INK} strokeWidth={6} strokeLinecap="round" opacity={0.5 + 0.5 * Math.sin(frame / 2)}>
                <line x1={s * 130} y1={-250} x2={s * 160} y2={-275} />
                <line x1={s * 140} y1={-205} x2={s * 178} y2={-212} />
              </g>
            ))}
          {label(-290, 320)}
          {under(44)}
        </g>
      );
    }
    case "moon":
      return (
        <g>
          <path d="M 30 -205 A 95 95 0 1 0 30 -15 A 45 95 0 0 1 30 -205 Z" fill="#FFE9A8" {...line} />
          {(
            [
            [110, -230, 16],
            [150, -120, 11],
            [-100, -250, 12],
          ] as const
          ).map(([x, y, r], i) => {
            const tw = 0.6 + 0.4 * Math.sin(frame / 9 + i * 2);
            return (
              <path
                key={`${x}-${y}`}
                d={`M ${x} ${y - r} L ${x + r * 0.3} ${y - r * 0.3} L ${x + r} ${y} L ${x + r * 0.3} ${y + r * 0.3} L ${x} ${y + r} L ${x - r * 0.3} ${y + r * 0.3} L ${x - r} ${y} L ${x - r * 0.3} ${y - r * 0.3} Z`}
                fill="#FFD84A"
                stroke={INK}
                strokeWidth={2.5}
                opacity={tw}
              />
            );
          })}
          {label(-300)}
        </g>
      );
    case "sun":
      return (
        <g transform="translate(0 -140)">
          <g transform={`rotate(${frame * 0.6})`}>
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2;
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed rays
                <line key={i} x1={Math.cos(a) * 100} y1={Math.sin(a) * 100} x2={Math.cos(a) * 134} y2={Math.sin(a) * 134} stroke="#F2A20C" strokeWidth={11} strokeLinecap="round" />
              );
            })}
          </g>
          <circle r={82} fill="#FFD84A" {...line} />
          {text && (
            <Hand size={fit(text, 130, 50)} fill={INK}>
              {text}
            </Hand>
          )}
        </g>
      );
    case "coffee": {
      const c = p.tone ? tn.fill : "#FFFFFF";
      return (
        <g>
          {[-26, 0, 26].map((x, i) => {
            const t = ((age + i * 14) % 42) / 42;
            return (
              <path
                key={x}
                d={`M ${x} ${-150 - t * 60} q 12 -16 0 -32 q -12 -16 0 -32`}
                fill="none"
                stroke="#B7AFA4"
                strokeWidth={6}
                strokeLinecap="round"
                opacity={Math.sin(t * Math.PI) * 0.9}
              />
            );
          })}
          <path d="M 58 -110 q 52 0 52 38 q 0 38 -52 38" fill="none" stroke={INK} strokeWidth={16} strokeLinecap="round" />
          <path d="M 58 -110 q 52 0 52 38 q 0 38 -52 38" fill="none" stroke={c} strokeWidth={8} strokeLinecap="round" />
          <rect x={-66} y={-150} width={132} height={150} rx={18} fill={c} {...line} />
          <ellipse cx={0} cy={-148} rx={60} ry={10} fill="#6B4A36" stroke={INK} strokeWidth={3} />
          {text && (
            <Hand y={-70} size={fit(text, 110, 40)} fill={p.tone ? tn.text : INK}>
              {text}
            </Hand>
          )}
          {under(44)}
        </g>
      );
    }
    case "bus": {
      // A red double-decker seen from the side, facing right, open platform at the back (left).
      const red = "#D9342B";
      const spin = (age * 4) % 360;
      return (
        <g>
          <rect x={-380} y={-440} width={760} height={400} rx={36} fill={red} {...line} />
          <rect x={-380} y={-258} width={760} height={22} fill="#F3EFE4" stroke={INK} strokeWidth={3} />
          {Array.from({ length: 5 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed windows
            <rect key={`u${i}`} x={-300 + i * 124} y={-410} width={100} height={110} rx={10} fill="#BFE3F2" stroke={INK} strokeWidth={3} />
          ))}
          {Array.from({ length: 4 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed windows
            <rect key={`l${i}`} x={-176 + i * 124} y={-220} width={100} height={100} rx={10} fill="#BFE3F2" stroke={INK} strokeWidth={3} />
          ))}
          {/* Rear platform with the stairs the conductor climbed */}
          <rect x={-370} y={-226} width={160} height={186} fill="#F3EFE4" stroke={INK} strokeWidth={3} />
          <path d="M -360 -60 L -330 -60 L -330 -100 L -300 -100 L -300 -140 L -270 -140 L -270 -180 L -240 -180 L -240 -220" fill="none" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
          <line x1={-215} y1={-226} x2={-215} y2={-40} stroke="#C9A227" strokeWidth={8} />
          <rect x={300} y={-226} width={60} height={110} rx={8} fill="#BFE3F2" stroke={INK} strokeWidth={3} />
          <rect x={180} y={-470} width={190} height={40} rx={6} fill="#2B2A33" {...line} />
          {text && (
            <Hand x={275} y={-450} size={fit(text, 170, 28)} fill="#FFD84A">
              {text}
            </Hand>
          )}
          {[-250, 230].map((x) => (
            <g key={x} transform={`translate(${x} -48)`}>
              <circle r={50} fill="#2B2A33" {...line} />
              <circle r={22} fill="#C9CED6" stroke={INK} strokeWidth={3} />
              <line x1={-22} y1={0} x2={22} y2={0} stroke={INK} strokeWidth={3} transform={`rotate(${spin})`} />
            </g>
          ))}
          {under(50, 500, 44)}
        </g>
      );
    }
    case "stairs": {
      const n = Math.max(3, Math.min(10, Math.round(p.value ?? 6)));
      const sw = 64;
      const sh = 48;
      const x0 = (-n * sw) / 2;
      const d = `M ${x0} 0 ${Array.from({ length: n }, (_, i) => `L ${x0 + i * sw} ${-(i + 1) * sh} L ${x0 + (i + 1) * sw} ${-(i + 1) * sh}`).join(" ")} L ${x0 + n * sw} 0 Z`;
      return (
        <g>
          <path d={d} fill="#D9C2A0" {...line} />
          <path d={`M ${x0 + 20} ${-sh - 90} L ${x0 + n * sw - 20} ${-n * sh - 90}`} stroke={INK} strokeWidth={6} strokeLinecap="round" />
          {[0.15, 0.5, 0.85].map((t) => {
            const x = x0 + 20 + t * (n * sw - 40);
            const y = -sh - 90 + t * (-(n - 1) * sh);
            const stepIndex = Math.min(n - 1, Math.floor((x - x0) / sw));
            return <line key={t} x1={x} y1={y} x2={x} y2={-(stepIndex + 1) * sh} stroke={INK} strokeWidth={4} />;
          })}
          {label(-n * sh - 140, n * sw)}
        </g>
      );
    }
    case "sofa": {
      const c = p.tone ? tn.line : "#5B8DD6";
      return (
        <g>
          <rect x={-200} y={-230} width={400} height={150} rx={30} fill={c} {...line} />
          <rect x={-190} y={-120} width={190} height={56} rx={16} fill={c} {...line} />
          <rect x={0} y={-120} width={190} height={56} rx={16} fill={c} {...line} />
          <rect x={-250} y={-170} width={70} height={150} rx={26} fill={c} {...line} />
          <rect x={180} y={-170} width={70} height={150} rx={26} fill={c} {...line} />
          <rect x={-200} y={-70} width={400} height={50} fill={c} {...line} />
          <rect x={-226} y={-20} width={16} height={20} fill={INK} />
          <rect x={210} y={-20} width={16} height={20} fill={INK} />
          {label(-280)}
        </g>
      );
    }
    case "mat":
      return (
        <g>
          <rect x={-240} y={-18} width={470} height={18} rx={6} fill={p.tone ? tn.line : "#5DBB63"} {...line} />
          <circle cx={238} cy={-32} r={32} fill={p.tone ? tn.line : "#5DBB63"} {...line} />
          <circle cx={238} cy={-32} r={14} fill="none" stroke={INK} strokeWidth={3} />
          {label(-80, 400)}
        </g>
      );
    case "thermometer": {
      const level = clamp01(p.value ?? 0.8) * ease(age, 30);
      const top = -300;
      const bottom = -70;
      const y = bottom - (bottom - top - 20) * level;
      return (
        <g>
          <rect x={-22} y={top} width={44} height={bottom - top + 20} rx={22} fill="#FFFFFF" {...line} />
          <rect x={-10} y={y} width={20} height={bottom - y + 10} fill="#E8504A" />
          <circle cx={0} cy={-44} r={42} fill="#E8504A" {...line} />
          {Array.from({ length: 6 }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed ticks
            <line key={i} x1={22} y1={top + 30 + i * 36} x2={40} y2={top + 30 + i * 36} stroke={INK} strokeWidth={3} />
          ))}
          {text && (
            <Hand x={60} y={top + 30} anchor="start" size={fit(text, 220, 54)} outline="#FBF6E9">
              {text}
            </Hand>
          )}
        </g>
      );
    }
    default:
      return null;
  }
};
