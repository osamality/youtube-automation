/**
 * Exercise library for the `exercise` template: low-impact home moves, each a loop of key poses.
 * A full-body figure seen from the side, facing right, in a 480 × 400 box (remotion/Body.tsx draws it).
 * Pure data and maths — safe to import from Node.
 */

export type Pt = [number, number];

/** One key pose. Feet and hands are targets; knees and elbows are solved (two-bone IK). */
export interface BodyPose {
  hip: Pt;
  /** Torso angle from vertical, degrees. + leans forward (towards the facing side). −90 = lying on the back, head left. */
  torso: number;
  /** Head tilt, degrees, towards the face. − looks up and ahead. */
  head?: number;
  /** Ankles: [near, far]. */
  feet: [Pt, Pt];
  /** Foot angle, degrees: 0 = flat and pointing forward, + = heel up (toes down), 180 = pointing back. */
  toes?: [number, number];
  /** Wrists: [near, far]. */
  hands: [Pt, Pt];
}

export interface MoveStep {
  pose: BodyPose;
  /** Seconds to move here from the previous step (the last step, for the first one). */
  move?: number;
  /** Seconds to stay. */
  hold?: number;
  /** Arriving here completes one rep. */
  count?: boolean;
}

/** What surrounds the figure. */
export type MoveSet = "chair-behind" | "chair-front" | "wall" | "mat" | "floor";

export interface MoveDef {
  name: string;
  /** reps: loops and counts reps · hold: plays once, then holds and times it · time: loops and times it. */
  kind: "reps" | "hold" | "time";
  set: MoveSet;
  steps: MoveStep[];
  /** Smooth stops at each pose (default) or constant speed (walking). */
  ease?: "inOut" | "linear";
  /** Floor scroll speed in box units per second (walking in place). */
  scroll?: number;
  /**
   * The same move on the other leg or arm. It starts and ends on the same pose as `steps`
   * and takes as long, so the figure can switch sides between reps (or between holds).
   */
  otherSide?: MoveStep[];
  /** Counter label instead of REPS / HOLD / TIME, e.g. STEPS. */
  unit?: string;
}

/** Box size, floor line and body measurements in box units (a 345-unit-tall adult). */
export const BOX = { width: 480, height: 400 } as const;
export const FLOOR = 372;
/** Top of the exercise mat. */
export const MAT = 366;
export const BONES = {
  thigh: 84,
  shin: 80,
  upperArm: 60,
  forearm: 56,
  torso: 104,
  neck: 16,
  head: 27,
  foot: 34,
  heel: 8,
} as const;

/** Chair, wall and mat geometry shared by the poses and the drawing. */
export const PROPS = {
  chairBehind: { seatX: [128, 210] as Pt, seatY: 280, backX: 128, backTop: 170 },
  chairFront: { seatX: [290, 365] as Pt, seatY: 280, backX: 290, backTop: 186 },
  wallX: 376,
};

const ANKLE = FLOOR - 9;

// ── Standing moves ───────────────────────────────────────────────────────────

const SIT: BodyPose = {
  hip: [175, 262],
  torso: 8,
  feet: [
    [252, ANKLE],
    [244, ANKLE],
  ],
  hands: [
    [225, 245],
    [219, 248],
  ],
};
const SIT_LEAN: BodyPose = {
  ...SIT,
  hip: [192, 252],
  torso: 42,
  head: -14,
  hands: [
    [338, 184],
    [332, 188],
  ],
};
const SIT_STAND: BodyPose = {
  ...SIT,
  hip: [242, 203],
  torso: 2,
  hands: [
    [250, 210],
    [240, 210],
  ],
};

/** Sitting tall, away from the backrest, hands holding the sides of the seat. */
const SIT_TALL: BodyPose = {
  hip: [180, 262],
  torso: 1,
  feet: [
    [252, ANKLE],
    [244, ANKLE],
  ],
  hands: [
    [202, 266],
    [198, 268],
  ],
};
const SIT_KNEE_NEAR: BodyPose = {
  ...SIT_TALL,
  feet: [
    [270, 318],
    [244, ANKLE],
  ],
  toes: [12, 0],
};
const SIT_KNEE_FAR: BodyPose = {
  ...SIT_TALL,
  feet: [
    [252, ANKLE],
    [262, 318],
  ],
  toes: [0, 12],
};
/** One leg straightened out in front, foot flexed (toes towards you). */
const SIT_LEG_NEAR: BodyPose = {
  ...SIT_TALL,
  feet: [
    [336, 292],
    [244, ANKLE],
  ],
  toes: [-48, 0],
};
const SIT_LEG_FAR: BodyPose = {
  ...SIT_TALL,
  feet: [
    [252, ANKLE],
    [330, 294],
  ],
  toes: [0, -48],
};
/** Ankle stretch: the raised leg's toes point away (down) instead of back towards the shin. */
const SIT_LEG_NEAR_POINT: BodyPose = { ...SIT_LEG_NEAR, toes: [32, 0] };
const SIT_LEG_FAR_POINT: BodyPose = { ...SIT_LEG_FAR, toes: [0, 32] };
/** Chest stretch: sitting forward, away from the chair back, hands on the thighs… */
const SIT_FORWARD: BodyPose = {
  hip: [196, 262],
  torso: 3,
  feet: [
    [262, ANKLE],
    [254, ANKLE],
  ],
  hands: [
    [222, 262],
    [218, 264],
  ],
};
/** …then the arms open back at shoulder height and the chest lifts. */
const CHEST_OPEN: BodyPose = {
  ...SIT_FORWARD,
  torso: -6,
  head: -10,
  hands: [
    [96, 172],
    [92, 174],
  ],
};

const WALL_UP: BodyPose = {
  hip: [225, 211],
  torso: 20,
  head: -6,
  feet: [
    [174, ANKLE],
    [168, ANKLE],
  ],
  hands: [
    [370, 126],
    [368, 132],
  ],
};
const WALL_DOWN: BodyPose = { ...WALL_UP, hip: [261, 229], torso: 34, head: -10 };

const STAND_CHAIR: BodyPose = {
  hip: [236, 203],
  torso: 4,
  feet: [
    [242, ANKLE],
    [232, ANKLE],
  ],
  hands: [
    [286, 184],
    [282, 187],
  ],
};
const TIPTOE: BodyPose = {
  ...STAND_CHAIR,
  hip: [236, 185],
  feet: [
    [242, ANKLE - 18],
    [232, ANKLE - 18],
  ],
  toes: [32, 32],
};
/** Weight over the far (standing) leg; the near foot lifts behind, knee bent, clear of the chair. */
const ONE_LEG: BodyPose = {
  ...STAND_CHAIR,
  hip: [230, 203],
  feet: [
    [198, 318],
    [232, ANKLE],
  ],
  toes: [60, 0],
};
const ONE_LEG_FAR: BodyPose = {
  ...STAND_CHAIR,
  hip: [242, 203],
  feet: [
    [242, ANKLE],
    [204, 318],
  ],
  toes: [0, 60],
};

/** Hands on the chair back; hips sit back and down, back straight. */
const MINI_SQUAT: BodyPose = { ...STAND_CHAIR, hip: [214, 232], torso: 18, head: -6 };

/** One leg lifts straight back, knee straight, toes not pointed. */
const LEG_BACK_NEAR: BodyPose = {
  ...STAND_CHAIR,
  hip: [232, 203],
  torso: 9,
  feet: [
    [170, 345],
    [232, ANKLE],
  ],
  toes: [22, 0],
};
const LEG_BACK_FAR: BodyPose = {
  ...STAND_CHAIR,
  hip: [242, 203],
  torso: 9,
  feet: [
    [242, ANKLE],
    [178, 345],
  ],
  toes: [0, 22],
};

/** Thigh stays down; the heel lifts towards the bottom. */
const KNEE_CURL_NEAR: BodyPose = {
  ...STAND_CHAIR,
  hip: [232, 203],
  feet: [
    [164, 250],
    [232, ANKLE],
  ],
  toes: [110, 0],
};
const KNEE_CURL_FAR: BodyPose = {
  ...STAND_CHAIR,
  hip: [242, 203],
  feet: [
    [242, ANKLE],
    [172, 252],
  ],
  toes: [0, 110],
};

// Heel-to-toe walk: tiny steps, the front heel lands just ahead of the back toes.
// The stance foot slides back at the floor's scroll speed (44 units per 0.9 s step).
const TANDEM_HANDS: [Pt, Pt] = [
  [266, 196],
  [210, 198],
];
const TANDEM_NEAR_FRONT: BodyPose = {
  hip: [236, 203],
  torso: 2,
  head: 8,
  feet: [
    [258, ANKLE],
    [214, ANKLE],
  ],
  hands: TANDEM_HANDS,
};
const TANDEM_FAR_SWING: BodyPose = {
  ...TANDEM_NEAR_FRONT,
  hip: [236, 201],
  feet: [
    [236, ANKLE],
    [236, ANKLE - 15],
  ],
  toes: [0, 14],
};
const TANDEM_FAR_FRONT: BodyPose = {
  ...TANDEM_NEAR_FRONT,
  feet: [
    [214, ANKLE],
    [258, ANKLE],
  ],
};
const TANDEM_NEAR_SWING: BodyPose = {
  ...TANDEM_NEAR_FRONT,
  hip: [236, 201],
  feet: [
    [236, ANKLE - 15],
    [236, ANKLE],
  ],
  toes: [14, 0],
};

const STAND: BodyPose = {
  hip: [236, 203],
  torso: 0,
  feet: [
    [242, ANKLE],
    [232, ANKLE],
  ],
  hands: [
    [244, 208],
    [230, 208],
  ],
};
const KNEE_NEAR: BodyPose = {
  ...STAND,
  hip: [236, 201],
  feet: [
    [314, 290],
    [232, ANKLE],
  ],
  toes: [22, 0],
  hands: [
    [212, 204],
    [272, 178],
  ],
};
const KNEE_FAR: BodyPose = {
  ...STAND,
  hip: [236, 201],
  feet: [
    [242, ANKLE],
    [306, 292],
  ],
  toes: [0, 22],
  hands: [
    [276, 178],
    [208, 204],
  ],
};

const STEP_NEAR: BodyPose = {
  hip: [236, 207],
  torso: 5,
  feet: [
    [288, 358],
    [184, 350],
  ],
  toes: [-14, 38],
  hands: [
    [208, 200],
    [270, 184],
  ],
};
const PASS_NEAR: BodyPose = {
  hip: [236, 200],
  torso: 5,
  feet: [
    [240, ANKLE],
    [210, 326],
  ],
  toes: [0, 30],
  hands: [
    [238, 207],
    [236, 207],
  ],
};
const STEP_FAR: BodyPose = {
  ...STEP_NEAR,
  feet: [
    [184, 350],
    [288, 358],
  ],
  toes: [38, -14],
  hands: [
    [270, 184],
    [208, 200],
  ],
};
const PASS_FAR: BodyPose = {
  ...PASS_NEAR,
  feet: [
    [210, 326],
    [240, ANKLE],
  ],
  toes: [30, 0],
};

// ── Floor moves (on a mat) ───────────────────────────────────────────────────

const BRIDGE_DOWN: BodyPose = {
  hip: [234, 344],
  torso: -90,
  head: 7,
  feet: [
    [326, 357],
    [318, 357],
  ],
  hands: [
    [236, 352],
    [242, 354],
  ],
};
const BRIDGE_UP: BodyPose = { ...BRIDGE_DOWN, hip: [224, 300], torso: -115, head: 32 };

const KNEELING: BodyPose = {
  hip: [200, 268],
  torso: 74,
  feet: [
    [124, 357],
    [118, 357],
  ],
  toes: [175, 175],
  hands: [
    [302, 354],
    [296, 354],
  ],
};
const REACH_NEAR_ARM: BodyPose = {
  ...KNEELING,
  feet: [
    [124, 357],
    [40, 266],
  ],
  toes: [175, 170],
  hands: [
    [412, 236],
    [296, 354],
  ],
};
const REACH_FAR_ARM: BodyPose = {
  ...KNEELING,
  feet: [
    [40, 266],
    [118, 357],
  ],
  toes: [170, 175],
  hands: [
    [302, 354],
    [412, 236],
  ],
};

export const MOVES = {
  "sit-to-stand": {
    name: "Sit to stand",
    kind: "reps",
    set: "chair-behind",
    steps: [
      { pose: SIT, move: 0, hold: 0.5 },
      { pose: SIT_LEAN, move: 0.7 },
      { pose: SIT_STAND, move: 0.8, hold: 0.5, count: true },
      { pose: SIT_LEAN, move: 1.1 },
      { pose: SIT, move: 0.9 },
    ],
  },
  "chair-stand": {
    name: "Chair stand",
    kind: "reps",
    set: "chair-behind",
    steps: [
      { pose: armsCrossed(SIT), move: 0, hold: 0.5 },
      { pose: armsCrossed(SIT_LEAN), move: 0.8 },
      { pose: armsCrossed(SIT_STAND), move: 0.9, hold: 0.5, count: true },
      { pose: armsCrossed(SIT_LEAN), move: 1.2 },
      { pose: armsCrossed(SIT), move: 1.0 },
    ],
  },
  "wall-push-up": {
    name: "Wall push-up",
    kind: "reps",
    set: "wall",
    steps: [
      { pose: WALL_UP, move: 0, hold: 0.4 },
      { pose: WALL_DOWN, move: 1.4, hold: 0.3 },
      { pose: WALL_UP, move: 1.1, count: true },
    ],
  },
  "calf-raise": {
    name: "Calf raise",
    kind: "reps",
    set: "chair-front",
    steps: [
      { pose: STAND_CHAIR, move: 0, hold: 0.4 },
      { pose: TIPTOE, move: 0.9, hold: 0.6 },
      { pose: STAND_CHAIR, move: 1.3, count: true },
    ],
  },
  "one-leg-stand": {
    name: "One-leg stand",
    kind: "hold",
    set: "chair-front",
    steps: [
      { pose: STAND_CHAIR, move: 0, hold: 0.6 },
      { pose: ONE_LEG, move: 0.8 },
    ],
    otherSide: [
      { pose: STAND_CHAIR, move: 0, hold: 0.6 },
      { pose: ONE_LEG_FAR, move: 0.8 },
    ],
  },
  "mini-squat": {
    name: "Mini squat",
    kind: "reps",
    set: "chair-front",
    steps: [
      { pose: STAND_CHAIR, move: 0, hold: 0.4 },
      { pose: MINI_SQUAT, move: 1.4, hold: 0.3 },
      { pose: STAND_CHAIR, move: 1.2, count: true },
    ],
  },
  "back-leg-raise": {
    name: "Back leg raise",
    kind: "reps",
    set: "chair-front",
    steps: [
      { pose: STAND_CHAIR, move: 0, hold: 0.4 },
      { pose: LEG_BACK_NEAR, move: 1.1, hold: 1.0, count: true },
      { pose: STAND_CHAIR, move: 1.1 },
    ],
    otherSide: [
      { pose: STAND_CHAIR, move: 0, hold: 0.4 },
      { pose: LEG_BACK_FAR, move: 1.1, hold: 1.0, count: true },
      { pose: STAND_CHAIR, move: 1.1 },
    ],
  },
  "knee-curl": {
    name: "Knee curl",
    kind: "reps",
    set: "chair-front",
    steps: [
      { pose: STAND_CHAIR, move: 0, hold: 0.4 },
      { pose: KNEE_CURL_NEAR, move: 1.1, hold: 0.8, count: true },
      { pose: STAND_CHAIR, move: 1.1 },
    ],
    otherSide: [
      { pose: STAND_CHAIR, move: 0, hold: 0.4 },
      { pose: KNEE_CURL_FAR, move: 1.1, hold: 0.8, count: true },
      { pose: STAND_CHAIR, move: 1.1 },
    ],
  },
  "heel-to-toe-walk": {
    name: "Heel-to-toe walk",
    kind: "reps",
    unit: "STEPS",
    set: "floor",
    ease: "linear",
    scroll: 44 / 0.9,
    steps: [
      { pose: TANDEM_NEAR_FRONT, move: 0 },
      { pose: TANDEM_FAR_SWING, move: 0.45 },
      { pose: TANDEM_FAR_FRONT, move: 0.45, count: true },
      { pose: TANDEM_NEAR_SWING, move: 0.45 },
      { pose: TANDEM_NEAR_FRONT, move: 0.45, count: true },
    ],
  },
  "seated-march": {
    name: "Seated march",
    kind: "reps",
    set: "chair-behind",
    steps: [
      { pose: SIT_TALL, move: 0, hold: 0.2 },
      { pose: SIT_KNEE_NEAR, move: 0.6, hold: 0.25, count: true },
      { pose: SIT_TALL, move: 0.6, hold: 0.2 },
      { pose: SIT_KNEE_FAR, move: 0.6, hold: 0.25, count: true },
      { pose: SIT_TALL, move: 0.6 },
    ],
  },
  "leg-straightening": {
    name: "Leg straightening",
    kind: "reps",
    set: "chair-behind",
    steps: [
      { pose: SIT_TALL, move: 0, hold: 0.4 },
      { pose: SIT_LEG_NEAR, move: 1.3, hold: 1.0, count: true },
      { pose: SIT_TALL, move: 1.3 },
    ],
    otherSide: [
      { pose: SIT_TALL, move: 0, hold: 0.4 },
      { pose: SIT_LEG_FAR, move: 1.3, hold: 1.0, count: true },
      { pose: SIT_TALL, move: 1.3 },
    ],
  },
  // NHS sitting exercises: ankle stretch (2 sets of 5 each foot) and chest stretch (hold 5–10 s, 5 times).
  "ankle-stretch": {
    name: "Ankle stretch",
    kind: "reps",
    set: "chair-behind",
    steps: [
      { pose: SIT_TALL, move: 0, hold: 0.3 },
      { pose: SIT_LEG_NEAR, move: 1.1, hold: 0.2 },
      { pose: SIT_LEG_NEAR_POINT, move: 0.7, hold: 0.4 },
      { pose: SIT_LEG_NEAR, move: 0.7, hold: 0.4, count: true },
      { pose: SIT_TALL, move: 1.1 },
    ],
    otherSide: [
      { pose: SIT_TALL, move: 0, hold: 0.3 },
      { pose: SIT_LEG_FAR, move: 1.1, hold: 0.2 },
      { pose: SIT_LEG_FAR_POINT, move: 0.7, hold: 0.4 },
      { pose: SIT_LEG_FAR, move: 0.7, hold: 0.4, count: true },
      { pose: SIT_TALL, move: 1.1 },
    ],
  },
  "chest-stretch": {
    name: "Chest stretch",
    kind: "reps",
    set: "chair-behind",
    steps: [
      { pose: SIT_FORWARD, move: 0, hold: 0.5 },
      { pose: CHEST_OPEN, move: 1.4, hold: 5, count: true },
      { pose: SIT_FORWARD, move: 1.4 },
    ],
  },
  march: {
    name: "March on the spot",
    kind: "time",
    set: "floor",
    steps: [
      { pose: STAND, move: 0, hold: 0.05 },
      { pose: KNEE_NEAR, move: 0.45, hold: 0.1 },
      { pose: STAND, move: 0.4 },
      { pose: KNEE_FAR, move: 0.45, hold: 0.1 },
      { pose: STAND, move: 0.4 },
    ],
  },
  "brisk-walk": {
    name: "Brisk walk",
    kind: "time",
    set: "floor",
    ease: "linear",
    scroll: 193,
    steps: [
      { pose: STEP_NEAR, move: 0 },
      { pose: PASS_NEAR, move: 0.27 },
      { pose: STEP_FAR, move: 0.27 },
      { pose: PASS_FAR, move: 0.27 },
      { pose: STEP_NEAR, move: 0.27 },
    ],
  },
  "glute-bridge": {
    name: "Glute bridge",
    kind: "reps",
    set: "mat",
    steps: [
      { pose: BRIDGE_DOWN, move: 0, hold: 0.5 },
      { pose: BRIDGE_UP, move: 1.2, hold: 1.0 },
      { pose: BRIDGE_DOWN, move: 1.4, count: true },
    ],
  },
  "bird-dog": {
    name: "Bird dog",
    kind: "reps",
    set: "mat",
    steps: [
      { pose: KNEELING, move: 0, hold: 0.4 },
      { pose: REACH_NEAR_ARM, move: 1.0, hold: 1.2, count: true },
      { pose: KNEELING, move: 1.0, hold: 0.4 },
      { pose: REACH_FAR_ARM, move: 1.0, hold: 1.2, count: true },
      { pose: KNEELING, move: 1.0 },
    ],
  },
} satisfies Record<string, MoveDef>;

export type MoveId = keyof typeof MOVES;
export const MOVE_IDS = Object.keys(MOVES) as [MoveId, ...MoveId[]];

export function moveDef(id: MoveId): MoveDef {
  return MOVES[id] as MoveDef;
}

// ── Timing ───────────────────────────────────────────────────────────────────

export interface MoveState {
  pose: BodyPose;
  /** Reps finished (reps kind), on the current side when the move switches sides. */
  reps: number;
  /** 0–1 through the current rep or loop. */
  phase: number;
  /** Seconds the timer shows: time since the hold began (hold) or since the start (time). */
  timer: number;
  /** 0 = the first side, 1 = the other side (moves with `otherSide`). */
  side: 0 | 1;
  /** Seconds since the figure last switched sides; Infinity before the first switch. */
  sinceSwitch: number;
}

export interface MoveOptions {
  /** Switch sides after this many reps (reps moves) or seconds of holding (hold moves). Needs `otherSide`. */
  switchEvery?: number;
}

/** Seconds to go from one side's hold, through the start pose, into the other side's. */
export const SWITCH_SECONDS = 1.6;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpPt = (a: Pt, b: Pt, t: number): Pt => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function mixPose(a: BodyPose, b: BodyPose, t: number): BodyPose {
  const ta = a.toes ?? [0, 0];
  const tb = b.toes ?? [0, 0];
  return {
    hip: lerpPt(a.hip, b.hip, t),
    torso: lerp(a.torso, b.torso, t),
    head: lerp(a.head ?? 0, b.head ?? 0, t),
    feet: [lerpPt(a.feet[0], b.feet[0], t), lerpPt(a.feet[1], b.feet[1], t)],
    toes: [lerp(ta[0], tb[0], t), lerp(ta[1], tb[1], t)],
    hands: [lerpPt(a.hands[0], b.hands[0], t), lerpPt(a.hands[1], b.hands[1], t)],
  };
}

function sway(pose: BodyPose, t: number): BodyPose {
  const out = mixPose(pose, pose, 0);
  out.torso += Math.sin(t * 2.1) * 1.5;
  out.hip = [out.hip[0] + Math.sin(t * 1.3) * 1.2, out.hip[1]];
  return out;
}

/** Plays `steps` once from the first pose; returns null once the last pose is reached. */
function playOnce(steps: MoveStep[], t: number, ease: (t: number) => number) {
  let left = t;
  for (let i = 0; i < steps.length; i++) {
    const cur = steps[i] as MoveStep;
    const prev = (steps[i - 1] ?? cur) as MoveStep;
    const move = cur.move ?? 0;
    if (left < move) return { pose: mixPose(prev.pose, cur.pose, ease(left / move)), left: 0 };
    left -= move;
    if (i === steps.length - 1) return { pose: null, left };
    const hold = cur.hold ?? 0;
    if (left < hold) return { pose: mixPose(cur.pose, cur.pose, 0), left: 0 };
    left -= hold;
  }
  return { pose: null, left };
}

/** Where the move is `seconds` after it starts. */
export function moveAt(def: MoveDef, seconds: number, opts: MoveOptions = {}): MoveState {
  const ease = def.ease === "linear" ? (t: number) => t : easeInOut;
  const t0 = Math.max(0, seconds);
  const other = def.otherSide;
  const every = other && opts.switchEvery && opts.switchEvery > 0 ? opts.switchEvery : 0;
  const lastPose = (steps: MoveStep[]) => (steps[steps.length - 1] as MoveStep).pose;

  if (def.kind === "hold") {
    // Play the steps once, then hold the last pose with a gentle sway.
    const first = playOnce(def.steps, t0, ease);
    const base = { reps: 0, phase: 0, side: 0 as const, sinceSwitch: Number.POSITIVE_INFINITY };
    if (!first.pose && (!every || first.left < every)) {
      return { ...base, pose: sway(lastPose(def.steps), first.left), timer: first.left };
    }
    if (first.pose) return { ...base, pose: first.pose, timer: 0 };
    // Switching: back to the start pose, then into the other side's hold, every `every` seconds.
    const after = first.left - every;
    const period = SWITCH_SECONDS + every;
    const k = Math.floor(after / period);
    const within = after - k * period;
    const side = ((k + 1) % 2) as 0 | 1;
    const sides = [def.steps, other as MoveStep[]] as const;
    const from = lastPose(sides[(1 - side) as 0 | 1]);
    const to = lastPose(sides[side]);
    const neutral = (def.steps[0] as MoveStep).pose;
    const half = SWITCH_SECONDS / 2;
    let pose: BodyPose;
    if (within < half) pose = mixPose(sway(from, every), neutral, ease(within / half));
    else if (within < SWITCH_SECONDS) pose = mixPose(neutral, to, ease((within - half) / half));
    else pose = sway(to, within - SWITCH_SECONDS);
    return {
      pose,
      reps: 0,
      phase: 0,
      timer: Math.max(0, within - SWITCH_SECONDS),
      side,
      sinceSwitch: within,
    };
  }

  const cycle = cycleSeconds(def);
  const loops = cycle > 0 ? Math.floor(t0 / cycle) : 0;
  const countsPerLoop = def.steps.filter((s) => s.count).length;
  // Sides switch between loops: every `every` reps, rounded to whole loops.
  const loopsPerSide = every ? Math.max(1, Math.round(every / Math.max(1, countsPerLoop))) : 0;
  const sideIndex = loopsPerSide ? Math.floor(loops / loopsPerSide) : 0;
  const side = (sideIndex % 2) as 0 | 1;
  const steps = side === 1 && other ? other : def.steps;
  const n = steps.length;
  const sideStart = sideIndex * loopsPerSide;
  const sinceSwitch = sideIndex > 0 ? t0 - sideStart * cycle : Number.POSITIVE_INFINITY;

  let t = cycle > 0 ? t0 - loops * cycle : 0;
  let reps = (loops - sideStart) * countsPerLoop;
  const phase = cycle > 0 ? t / cycle : 0;
  const timer = def.kind === "time" ? t0 : 0;
  for (let i = 0; i < n; i++) {
    const cur = steps[i] as MoveStep;
    const prev = steps[(i - 1 + n) % n] as MoveStep;
    const move = cur.move ?? 0;
    const hold = cur.hold ?? 0;
    if (t < move) {
      return {
        pose: mixPose(prev.pose, cur.pose, ease(t / move)),
        reps,
        phase,
        timer,
        side,
        sinceSwitch,
      };
    }
    t -= move;
    if (cur.count) reps += 1;
    if (t < hold)
      return { pose: mixPose(cur.pose, cur.pose, 0), reps, phase, timer, side, sinceSwitch };
    t -= hold;
  }
  return {
    pose: mixPose(lastPose(steps), lastPose(steps), 0),
    reps,
    phase: 1,
    timer,
    side,
    sinceSwitch,
  };
}

/** Seconds one rep (or one loop) takes. */
export function cycleSeconds(def: MoveDef): number {
  return def.steps.reduce((sum, s) => sum + (s.move ?? 0) + (s.hold ?? 0), 0);
}

export type Bounds = [x0: number, y0: number, x1: number, y1: number];

/** Box area the figure and its props cover during the move, for framing the stage. */
export function moveBounds(def: MoveDef, opts: MoveOptions = {}, seconds = 60): Bounds {
  const b: Bounds = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  const add = (p: Pt, r: number) => {
    b[0] = Math.min(b[0], p[0] - r);
    b[1] = Math.min(b[1], p[1] - r);
    b[2] = Math.max(b[2], p[0] + r);
    b[3] = Math.max(b[3], p[1] + r);
  };
  for (let t = 0; t <= seconds; t += 0.1) {
    const sk = skeleton(moveAt(def, t, opts).pose);
    add(sk.hip, 22);
    add(sk.shoulder, 23);
    add(sk.head, BONES.head + 14);
    sk.legs.forEach((leg, i) => {
      const dir = sk.feet[i] as Pt;
      add(leg.joint, 15);
      add(leg.end, 12);
      add([leg.end[0] + dir[0] * BONES.foot, leg.end[1] + dir[1] * BONES.foot], 7);
    });
    for (const arm of sk.arms) {
      add(arm.joint, 10);
      add(arm.end, 10);
    }
  }
  if (def.set === "chair-behind") {
    add([PROPS.chairBehind.seatX[0] - 4, PROPS.chairBehind.backTop], 0);
    add([PROPS.chairBehind.seatX[1] + 4, FLOOR], 0);
  }
  if (def.set === "chair-front") {
    add([PROPS.chairFront.seatX[0] - 4, PROPS.chairFront.backTop], 0);
    add([PROPS.chairFront.seatX[1] + 4, FLOOR], 0);
  }
  if (def.set === "wall") add([PROPS.wallX + 24, FLOOR], 0);
  add([b[0], FLOOR + 14], 0);
  return b;
}

// ── Skeleton ────────────────────────────────────────────────────────────────

export interface Limb {
  root: Pt;
  joint: Pt;
  end: Pt;
  /** Target was out of reach and the limb is fully stretched. */
  stretched: boolean;
}

/**
 * Two-bone IK. `bend` picks the side the joint goes: −1 = knees (bend forward), +1 = elbows (bend back).
 * For a figure facing right these hold in any orientation — standing, lying or kneeling.
 */
export function solveLimb(root: Pt, target: Pt, l1: number, l2: number, bend: 1 | -1): Limb {
  const dx = target[0] - root[0];
  const dy = target[1] - root[1];
  const raw = Math.hypot(dx, dy);
  const dist = Math.min(Math.max(raw, Math.abs(l1 - l2) + 0.5), l1 + l2 - 0.5);
  const theta = Math.atan2(dy, dx);
  const alpha = Math.acos(
    Math.min(1, Math.max(-1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))),
  );
  const a: Pt = [root[0] + l1 * Math.cos(theta + alpha), root[1] + l1 * Math.sin(theta + alpha)];
  const b: Pt = [root[0] + l1 * Math.cos(theta - alpha), root[1] + l1 * Math.sin(theta - alpha)];
  const side = (p: Pt) => Math.sign(dx * (p[1] - root[1]) - dy * (p[0] - root[0]));
  const joint = side(a) === bend ? a : b;
  const end: Pt = [root[0] + dist * Math.cos(theta), root[1] + dist * Math.sin(theta)];
  return { root, joint, end, stretched: raw > l1 + l2 - 0.5 };
}

export interface Skeleton {
  hip: Pt;
  shoulder: Pt;
  /** Head centre, and the angle (degrees) the face points: 0 = right, 90 = down. */
  head: Pt;
  face: number;
  legs: [Limb, Limb];
  arms: [Limb, Limb];
  /** Foot direction (unit vector) per foot. */
  feet: [Pt, Pt];
}

function rad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Unit vectors along the torso (up) and in front of the chest (forward) for a torso angle. */
function torsoAxes(torso: number): { up: Pt; forward: Pt } {
  const t = rad(torso);
  return { up: [Math.sin(t), -Math.cos(t)], forward: [Math.cos(t), Math.sin(t)] };
}

function shoulderOf(p: BodyPose): Pt {
  const { up } = torsoAxes(p.torso);
  return [p.hip[0] + BONES.torso * up[0], p.hip[1] + BONES.torso * up[1]];
}

/** Arms crossed over the chest, hands near the opposite shoulders (NIA chair stand). */
function armsCrossed(p: BodyPose): BodyPose {
  const s = shoulderOf(p);
  const { up, forward } = torsoAxes(p.torso);
  const at = (f: number, d: number): Pt => [
    s[0] + forward[0] * f - up[0] * d,
    s[1] + forward[1] * f - up[1] * d,
  ];
  return { ...p, hands: [at(24, 26), at(20, 20)] };
}

/** "Hold on with one hand": the near hand lets go and hangs by the side. */
export function oneHanded(p: BodyPose): BodyPose {
  const s = shoulderOf(p);
  const { up, forward } = torsoAxes(p.torso);
  const hand: Pt = [s[0] - up[0] * 104 + forward[0] * 6, s[1] - up[1] * 104 + forward[1] * 6];
  return { ...p, hands: [hand, p.hands[1]] };
}

export function skeleton(p: BodyPose): Skeleton {
  const tr = rad(p.torso);
  const up: Pt = [Math.sin(tr), -Math.cos(tr)];
  const shoulder: Pt = [p.hip[0] + BONES.torso * up[0], p.hip[1] + BONES.torso * up[1]];
  // The neck follows the torso, turned towards the face by the head tilt.
  const neckAngle = Math.atan2(up[1], up[0]) + rad(p.head ?? 0);
  const reach = BONES.neck + BONES.head;
  const head: Pt = [
    shoulder[0] + reach * Math.cos(neckAngle),
    shoulder[1] + reach * Math.sin(neckAngle),
  ];
  const face = (neckAngle * 180) / Math.PI + 90;
  const toes = p.toes ?? [0, 0];
  const footDir = (deg: number): Pt => [Math.cos(rad(deg)), Math.sin(rad(deg))];
  return {
    hip: p.hip,
    shoulder,
    head,
    face,
    legs: [
      solveLimb(p.hip, p.feet[0], BONES.thigh, BONES.shin, -1),
      solveLimb(p.hip, p.feet[1], BONES.thigh, BONES.shin, -1),
    ],
    arms: [
      solveLimb(shoulder, p.hands[0], BONES.upperArm, BONES.forearm, 1),
      solveLimb(shoulder, p.hands[1], BONES.upperArm, BONES.forearm, 1),
    ],
    feet: [footDir(toes[0]), footDir(toes[1])],
  };
}
