/**
 * The "paper" look: every sentence staged as a small cartoon scene — stick figures in a drawn
 * location, with props and hand-written signs (remotion/paper/*, scenes/Sketch.tsx).
 * Pure data — safe to import from Node.
 */

/** Drawn locations. Scene coordinates are 1920 × 1080; figures stand on the floor line. */
export const SETS = [
  "plain",
  "office",
  "boardroom",
  "trading",
  "datacenter",
  "street",
  "startup",
  "stage",
  "capitol",
  "vault",
  "sky",
  "city",
  "grid",
  "home",
  "exchange",
  "inside",
  // Health channel (remotion/paper/HealthSets.tsx)
  "park",
  "kitchen",
  "bedroom",
] as const;
export type SetId = (typeof SETS)[number];

/** Lighting over the whole scene. */
export const LIGHTS = ["day", "dim", "night", "spot"] as const;
export type Light = (typeof LIGHTS)[number];

export const FACES = [
  "neutral",
  "happy",
  "laugh",
  "sad",
  "shock",
  "angry",
  "worried",
  "smug",
] as const;
export type Face = (typeof FACES)[number];

export const ACTS = [
  "stand",
  "wave",
  "point",
  "cheer",
  "shrug",
  "think",
  "phone",
  "hold",
  "hips",
  "facepalm",
  "sit",
  "type",
  // Health channel: lying asleep under a blanket, drinking from a glass, flexing, arms up, walking in place.
  "sleep",
  "drink",
  "flex",
  "stretch",
  "walk",
] as const;
export type Act = (typeof ACTS)[number];

export const HATS = ["tophat", "cap", "hardhat", "crown"] as const;
export type Hat = (typeof HATS)[number];

export const PROP_KINDS = [
  "crate",
  "sign",
  "banner",
  "chip",
  "money",
  "coins",
  "moneybag",
  "bell",
  "balloon",
  "bubble",
  "stopwatch",
  "calendar",
  "paper",
  "server",
  "desk",
  "podium",
  "screen",
  "chart",
  "bars",
  "phone",
  "laptop",
  "vault",
  "rocket",
  "bomb",
  "scale",
  "building",
  "datacenter",
  "truck",
  "cloud",
  "logo",
  "arrow",
  "text",
  "number",
  "door",
  "briefcase",
  "trophy",
  "fire",
  "brain",
  "robot",
  "pie",
  "bolt",
  "ticker",
  "chair",
  "plant",
  "gavel",
  "crowd",
  "tag",
  "tokens",
  "vector",
  "space",
  "attention",
  "layers",
  "probs",
  "dice",
  "net",
  "chatbox",
  "plane",
  "books",
  "globe",
  "dial",
  "thumb",
  "stars",
  "mirror",
  "picture",
  // Health channel (remotion/paper/HealthProps.tsx)
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
] as const;
export type PropKind = (typeof PROP_KINDS)[number];

export const TONES = ["neutral", "positive", "negative", "accent", "dark"] as const;
export type Tone = (typeof TONES)[number];

export const ENTERS = ["pop", "drop", "slide", "fade", "none"] as const;
export type Enter = (typeof ENTERS)[number];

/** Where figures stand in each set (y of their feet, in scene units). */
export const FLOOR: Record<SetId, number> = {
  plain: 850,
  office: 860,
  boardroom: 880,
  trading: 880,
  datacenter: 880,
  street: 870,
  startup: 870,
  stage: 800,
  capitol: 880,
  vault: 870,
  sky: 880,
  city: 880,
  grid: 900,
  home: 870,
  exchange: 870,
  inside: 880,
  park: 900,
  kitchen: 870,
  bedroom: 880,
};

export const SCENE_W = 1920;
export const SCENE_H = 1080;
