import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CastMember, Mood, Pose } from "../cast";
import { useCastMember } from "./stage";
import { mulberry32 } from "../timeline";
import type { Palette } from "../palettes";
import { mix } from "./theme";

/**
 * Waist-up cartoon person in a 200 × 280 box, drawn in SVG.
 * Arms use two-bone IK towards per-pose hand targets, so pose changes blend smoothly.
 */

type Point = [number, number];

const L_SHOULDER: Point = [62, 182];
const R_SHOULDER: Point = [138, 182];
const UPPER = 50;
const FORE = 48;

/** Hand targets [left, right] in the 200 × 280 box. Left = viewer's left. */
const POSE_HANDS: Record<Pose, [Point, Point]> = {
  idle: [
    [48, 270],
    [152, 270],
  ],
  wave: [
    [48, 270],
    [174, 90],
  ],
  point: [
    [48, 270],
    [196, 150],
  ],
  think: [
    [98, 226],
    [110, 146],
  ],
  shrug: [
    [26, 196],
    [174, 196],
  ],
  celebrate: [
    [36, 42],
    [164, 42],
  ],
  worried: [
    [70, 120],
    [130, 120],
  ],
  present: [
    [48, 270],
    [180, 176],
  ],
  type: [
    [82, 236],
    [118, 236],
  ],
  phone: [
    [52, 268],
    [116, 198],
  ],
};

/** Per-frame wiggle on top of the pose. */
function poseMotion(pose: Pose, frame: number): [Point, Point] {
  switch (pose) {
    case "wave":
      return [
        [0, 0],
        [Math.sin(frame / 3.2) * 9, Math.cos(frame / 3.2) * 2],
      ];
    case "celebrate": {
      const b = Math.abs(Math.sin(frame / 5)) * -8;
      return [
        [0, b],
        [0, b],
      ];
    }
    case "type":
      return [
        [0, Math.max(0, Math.sin(frame / 2.1)) * -4],
        [0, Math.max(0, Math.sin(frame / 2.1 + 1.7)) * -4],
      ];
    case "point":
      return [
        [0, 0],
        [Math.sin(frame / 6) * 3, 0],
      ];
    default:
      return [
        [0, 0],
        [0, 0],
      ];
  }
}

/** Elbow position for a two-bone arm, bending outward (away from the body). */
function solveArm(shoulder: Point, target: Point, outward: -1 | 1): { elbow: Point; hand: Point } {
  const dx = target[0] - shoulder[0];
  const dy = target[1] - shoulder[1];
  const dist = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(UPPER - FORE) + 0.5), UPPER + FORE - 0.5);
  const theta = Math.atan2(dy, dx);
  const alpha = Math.acos((UPPER * UPPER + dist * dist - FORE * FORE) / (2 * UPPER * dist));
  const options = [theta + alpha, theta - alpha].map(
    (a) => [shoulder[0] + UPPER * Math.cos(a), shoulder[1] + UPPER * Math.sin(a)] as Point,
  );
  const [a, b] = options as [Point, Point];
  const elbow = (a[0] - b[0]) * outward > 0 ? a : b;
  const hand: Point = [shoulder[0] + dist * Math.cos(theta), shoulder[1] + dist * Math.sin(theta)];
  return { elbow, hand };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Point, b: Point, t: number): Point => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

export interface CharacterState {
  /** Scene-local frame the state starts. */
  from: number;
  pose: Pose;
  mood: Mood;
}

const INK = "#2A2135";

function Face({
  mood,
  blink,
  mouthOpen,
  look,
  c,
}: {
  mood: Mood;
  blink: number;
  mouthOpen: number;
  look: Point;
  c: CastMember;
}) {
  const eyeY = 104;
  const eyeScaleY = (mood === "surprised" ? 1.25 : 1) * (1 - 0.9 * blink);
  const eye = (x: number) => (
    <g transform={`translate(${x + look[0]} ${eyeY + look[1]}) scale(1 ${eyeScaleY})`}>
      <ellipse rx={mood === "surprised" ? 5 : 4.3} ry={5.6} fill={INK} />
      <circle cx={1.4} cy={-2} r={1.4} fill="#FFFFFF" />
    </g>
  );

  // Brows: [inner y, outer y] offsets per side.
  const brow: Record<Mood, [number, number, number, number]> = {
    neutral: [0, 0, 0, 0],
    happy: [-2, -1, -2, -1],
    worried: [-5, 2, -5, 2],
    surprised: [-6, -5, -6, -5],
    thinking: [0, 0, -5, -3],
    confident: [2, -1, 2, -1],
  };
  const [li, lo, ri, ro] = brow[mood];
  const browColor = c.hair === "hijab" || c.hair === "bald" ? mix(c.skin, INK, 0.75) : mix(c.hairColor, INK, 0.45);

  let mouth: React.ReactNode;
  if (mouthOpen > 0.06) {
    const h = 3 + mouthOpen * 9;
    const w = mood === "happy" ? 11 : 8.5;
    mouth = (
      <g>
        <ellipse cx={100} cy={129} rx={w} ry={h} fill="#5A1F2B" />
        <ellipse cx={100} cy={129 + h * 0.55} rx={w * 0.6} ry={h * 0.35} fill="#E86A7A" />
      </g>
    );
  } else if (mood === "happy") {
    mouth = <path d="M 88 124 Q 100 140 112 124 Q 100 131 88 124 Z" fill="#5A1F2B" />;
  } else if (mood === "worried") {
    mouth = <path d="M 90 132 Q 95 127 100 130 Q 105 133 110 128" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />;
  } else if (mood === "surprised") {
    mouth = <ellipse cx={100} cy={130} rx={5} ry={6.5} fill="#5A1F2B" />;
  } else if (mood === "thinking") {
    mouth = <path d="M 94 130 L 108 127" stroke={INK} strokeWidth={3} strokeLinecap="round" />;
  } else if (mood === "confident") {
    mouth = <path d="M 90 127 Q 102 136 112 124" stroke={INK} strokeWidth={3.2} fill="none" strokeLinecap="round" />;
  } else {
    mouth = <path d="M 91 127 Q 100 134 109 127" stroke={INK} strokeWidth={3} fill="none" strokeLinecap="round" />;
  }

  return (
    <g>
      <circle cx={75} cy={119} r={6.5} fill="#FF6F7D" opacity={0.28} />
      <circle cx={125} cy={119} r={6.5} fill="#FF6F7D" opacity={0.28} />
      {eye(85)}
      {eye(115)}
      <path d={`M 77 ${92 + lo} L 92 ${91 + li}`} stroke={browColor} strokeWidth={3.6} strokeLinecap="round" />
      <path d={`M 108 ${91 + ri} L 123 ${92 + ro}`} stroke={browColor} strokeWidth={3.6} strokeLinecap="round" />
      <path d="M 101 107 Q 96 117 101 119" stroke={mix(c.skin, INK, 0.35)} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      {mouth}
      {mood === "worried" && (
        <path d="M 138 74 Q 134 82 138 86 Q 142 82 138 74 Z" fill="#7CC6FF" opacity={0.9} />
      )}
    </g>
  );
}

function HairBack({ c }: { c: CastMember }) {
  const h = c.hairColor;
  switch (c.hair) {
    case "long":
      return <path d="M 56 100 C 50 46, 150 46, 144 100 L 152 196 C 128 206, 72 206, 48 196 Z" fill={h} />;
    case "bob":
      return <path d="M 54 104 C 48 46, 152 46, 146 104 L 149 142 C 130 150, 70 150, 51 142 Z" fill={h} />;
    case "curly":
      return (
        <g fill={h}>
          {Array.from({ length: 13 }, (_, i) => {
            const a = Math.PI * (0.92 + (i / 12) * 1.16);
            return <circle key={i} cx={100 + Math.cos(a) * 46} cy={92 + Math.sin(a) * 44} r={17} />;
          })}
          <ellipse cx={100} cy={84} rx={48} ry={40} />
        </g>
      );
    case "bun":
      return <circle cx={100} cy={46} r={17} fill={h} />;
    case "hijab":
      return <path d="M 50 102 C 46 36, 154 36, 150 102 C 152 146, 140 178, 100 184 C 60 178, 48 146, 50 102 Z" fill={h} />;
    default:
      return null;
  }
}

function HairFront({ c }: { c: CastMember }) {
  const h = c.hairColor;
  switch (c.hair) {
    case "short":
      return <path d="M 59 100 C 54 60, 80 44, 104 46 C 128 46, 148 62, 141 100 C 137 84, 127 74, 112 72 C 96 70, 76 77, 63 96 Z" fill={h} />;
    case "spiky":
      return <path d="M 59 98 L 62 62 L 74 72 L 80 48 L 92 63 L 101 41 L 110 61 L 124 46 L 128 67 L 142 58 L 141 98 C 132 80, 112 72, 100 72 C 86 72, 67 79, 59 98 Z" fill={h} />;
    case "curly":
      return (
        <g fill={h}>
          {[64, 78, 92, 106, 120, 134].map((x, i) => (
            <circle key={x} cx={x} cy={64 + (i % 2) * 4 - (i > 1 && i < 4 ? 4 : 0)} r={11} />
          ))}
        </g>
      );
    case "bun":
      return <path d="M 60 100 C 56 56, 144 56, 140 100 C 132 78, 116 68, 100 68 C 84 68, 68 78, 60 100 Z" fill={h} />;
    case "long":
      return <path d="M 60 104 C 56 56, 144 54, 142 100 C 128 76, 104 66, 92 64 C 84 74, 70 84, 60 104 Z" fill={h} />;
    case "bob":
      return <path d="M 58 100 C 56 56, 144 56, 142 100 C 140 86, 128 74, 110 72 C 100 82, 80 86, 62 100 Z" fill={h} />;
    case "bald":
      return (
        <g fill={h}>
          <ellipse cx={61} cy={96} rx={5} ry={13} />
          <ellipse cx={139} cy={96} rx={5} ry={13} />
        </g>
      );
    case "hijab":
      return (
        <path
          d="M 62 94 C 66 62, 134 62, 138 94 C 128 74, 72 74, 62 94 Z"
          fill={mix(h, "#000000", 0.18)}
        />
      );
  }
}

export const Character: React.FC<{
  /** Built-in cast id or one from plan.cast. */
  who: string;
  /** Pose and mood over time, in scene-local frames, sorted by `from`. */
  states: CharacterState[];
  height: number;
  /** Mirror horizontally (faces the other way). */
  flip?: boolean;
  /** Loudness 0–1 for the current frame when the character is speaking, else 0. */
  loudness?: number;
  /** Draw the desk the character sits behind. */
  desk?: { color: string; edge: string };
}> = ({ who, states, height, flip, loudness = 0, desk }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const c: CastMember = useCastMember(who);

  const first = states[0] ?? { from: 0, pose: "idle" as Pose, mood: "neutral" as Mood };
  let k = 0;
  for (let i = 0; i < states.length; i++) if ((states[i]?.from ?? 0) <= frame) k = i;
  const cur = states[k] ?? first;
  const prev = states[k - 1] ?? cur;
  const t = k === 0 ? 1 : spring({ frame: frame - cur.from, fps, config: { damping: 14, stiffness: 120 } });

  const motionPrev = poseMotion(prev.pose, frame);
  const motionCur = poseMotion(cur.pose, frame);
  const [lPrev, rPrev] = POSE_HANDS[prev.pose];
  const [lCur, rCur] = POSE_HANDS[cur.pose];
  const lTarget = lerpPt(
    [lPrev[0] + motionPrev[0][0], lPrev[1] + motionPrev[0][1]],
    [lCur[0] + motionCur[0][0], lCur[1] + motionCur[0][1]],
    t,
  );
  const rTarget = lerpPt(
    [rPrev[0] + motionPrev[1][0], rPrev[1] + motionPrev[1][1]],
    [rCur[0] + motionCur[1][0], rCur[1] + motionCur[1][1]],
    t,
  );
  const left = solveArm(L_SHOULDER, lTarget, -1);
  const right = solveArm(R_SHOULDER, rTarget, 1);

  // Blink every 3–5 s, at times fixed per character.
  const rand = mulberry32(who.length * 977 + (c.skin.charCodeAt(2) || 7));
  const period = Math.round(fps * (3 + rand() * 2));
  const offset = Math.floor(rand() * period);
  const inBlink = (frame + offset) % period;
  const blink = inBlink < 5 ? Math.sin((inBlink / 5) * Math.PI) : 0;

  const bob = Math.sin(frame / 16) * 1.4;
  const tilt = Math.sin(frame / 37) * 2 + (cur.pose === "shrug" ? 6 * t : 0) + (cur.pose === "think" ? -5 * t : 0);
  const look: Point = cur.mood === "thinking" ? [3, -3] : cur.pose === "phone" ? [0, 3] : [0, 0];
  const breathe = 1 + Math.sin(frame / 22) * 0.008;

  const sleeve = c.top;
  const sleeveBack = mix(c.top, "#000000", 0.12);
  const skinShade = mix(c.skin, "#000000", 0.16);

  const arm = (a: { elbow: Point; hand: Point }, color: string, finger: boolean) => {
    const dir = Math.atan2(a.hand[1] - a.elbow[1], a.hand[0] - a.elbow[0]);
    return (
      <g>
        <path
          d={`M ${a.elbow[0]} ${a.elbow[1]} L ${a.hand[0]} ${a.hand[1]}`}
          stroke={c.skin}
          strokeWidth={14}
          strokeLinecap="round"
        />
        <path
          d={`M ${a === left ? L_SHOULDER[0] : R_SHOULDER[0]} ${L_SHOULDER[1]} L ${a.elbow[0]} ${a.elbow[1]}`}
          stroke={color}
          strokeWidth={19}
          strokeLinecap="round"
        />
        {finger && (
          <path
            d={`M ${a.hand[0]} ${a.hand[1]} l ${Math.cos(dir) * 13} ${Math.sin(dir) * 13}`}
            stroke={c.skin}
            strokeWidth={6}
            strokeLinecap="round"
          />
        )}
        <circle cx={a.hand[0]} cy={a.hand[1]} r={9.5} fill={c.skin} />
      </g>
    );
  };

  const phoneProp =
    cur.pose === "phone" ? (
      <g transform={`translate(${right.hand[0] - 9} ${right.hand[1] - 30}) rotate(-8)`} opacity={t}>
        <rect width={22} height={38} rx={4} fill="#22252F" />
        <rect x={2.5} y={4} width={17} height={28} rx={2} fill="#8FD3FF" />
      </g>
    ) : null;

  const laptopProp =
    cur.pose === "type" ? (
      <g opacity={t}>
        <path d="M 54 204 L 146 204 L 150 250 L 50 250 Z" fill="#C7CCD9" />
        <path d="M 54 204 L 146 204 L 147 210 L 53 210 Z" fill="#AEB4C4" />
        <circle cx={100} cy={228} r={7} fill="#E9ECF4" />
      </g>
    ) : null;

  const width = (height * 200) / 280;

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 280"
      style={{ overflow: "visible", transform: flip ? "scaleX(-1)" : undefined }}
    >
      <title>{c.name}</title>
      <g transform={`translate(0 ${bob * 0.4})`}>
        <g transform={`scale(1 ${breathe})`} style={{ transformOrigin: "100px 280px" }}>
          <path
            d="M 40 272 L 40 206 Q 40 168 80 164 L 120 164 Q 160 168 160 206 L 160 272 Z"
            fill={c.top}
          />
          {c.tie ? (
            <g>
              <path d="M 82 164 L 100 214 L 118 164 Z" fill="#FFFFFF" />
              <path d="M 96 172 L 104 172 L 107 214 L 100 226 L 93 214 Z" fill={c.top2} />
              <path d="M 80 164 L 98 212 L 88 216 L 70 170 Z" fill={mix(c.top, "#000000", 0.18)} />
              <path d="M 120 164 L 102 212 L 112 216 L 130 170 Z" fill={mix(c.top, "#000000", 0.18)} />
            </g>
          ) : (
            <g>
              <path d="M 88 164 L 100 182 L 112 164 Z" fill={skinShade} />
              <path d="M 84 164 L 98 184 L 90 190 L 77 168 Z" fill={c.top2} />
              <path d="M 116 164 L 102 184 L 110 190 L 123 168 Z" fill={c.top2} />
            </g>
          )}
        </g>
      </g>

      <g transform={`translate(0 ${bob}) rotate(${tilt} 100 150)`}>
        <rect x={89} y={128} width={22} height={42} rx={8} fill={skinShade} />
        <HairBack c={c} />
        {c.hair !== "hijab" && (
          <g fill={c.skin}>
            <ellipse cx={60} cy={106} rx={7.5} ry={10.5} />
            <ellipse cx={140} cy={106} rx={7.5} ry={10.5} />
          </g>
        )}
        <ellipse cx={100} cy={100} rx={c.hair === "hijab" ? 35 : 40} ry={c.hair === "hijab" ? 41 : 46} fill={c.skin} />
        {c.beard && (
          <path
            d="M 63 108 C 64 150, 88 160, 100 160 C 112 160, 136 150, 137 108 C 132 128, 120 137, 100 137 C 80 137, 68 128, 63 108 Z"
            fill={c.beard}
          />
        )}
        <Face mood={cur.mood} blink={blink} mouthOpen={loudness} look={look} c={c} />
        {c.beard && <path d="M 88 121 Q 100 115 112 121 Q 100 119 88 121 Z" fill={c.beard} />}
        <HairFront c={c} />
        {c.glasses && (
          <g stroke="#2A2A33" strokeWidth={2.6} fill="#FFFFFF" fillOpacity={0.12}>
            <rect x={73} y={95} width={24} height={19} rx={7} />
            <rect x={103} y={95} width={24} height={19} rx={7} />
            <path d="M 97 103 L 103 103" fill="none" />
          </g>
        )}
      </g>

      {arm(left, sleeveBack, false)}
      {arm(right, sleeve, cur.pose === "point")}
      {laptopProp}
      {phoneProp}

      {desk && (
        <g>
          <ellipse cx={100} cy={250} rx={130} ry={7} fill="#000000" opacity={0.08} />
          <rect x={-48} y={244} width={296} height={36} rx={8} fill={desk.edge} />
          <rect x={-48} y={244} width={296} height={11} rx={5.5} fill={desk.color} />
        </g>
      )}
    </svg>
  );
};

/** Pose/mood timeline from a scene's character props and the frames of its beats. */
export function characterStates(
  base: { pose?: Pose; mood?: Mood },
  beats: { at: number; pose?: Pose; mood?: Mood }[],
): CharacterState[] {
  const states: CharacterState[] = [{ from: 0, pose: base.pose ?? "idle", mood: base.mood ?? "neutral" }];
  for (const b of beats) {
    const last = states[states.length - 1] as CharacterState;
    states.push({ from: b.at, pose: b.pose ?? last.pose, mood: b.mood ?? last.mood });
  }
  return states;
}

/** Desk colours for a palette: light top surface, darker front. */
export function deskColors(palette: Palette): { color: string; edge: string } {
  return { color: palette.surface, edge: mix(palette.surface2, palette.text, palette.dark ? 0.25 : 0.12) };
}
