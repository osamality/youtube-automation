/**
 * Recurring cartoon characters. Invented people, drawn in code (remotion/Character.tsx).
 * Plans pick one with `character.who`. A plan can add its own (plan.cast), e.g. for a documentary.
 * Pure data — safe to import from Node.
 */

export const HAIR_STYLES = [
  "short",
  "curly",
  "bun",
  "long",
  "bob",
  "bald",
  "hijab",
  "spiky",
] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export interface CastMember {
  name: string;
  skin: string;
  hair: HairStyle;
  /** Hair colour, or the scarf colour for "hijab". */
  hairColor: string;
  top: string;
  /** Second clothing colour: blazer lapels, collar, tie. */
  top2: string;
  glasses?: boolean;
  beard?: string;
  tie?: boolean;
}

export const CAST = {
  maya: {
    name: "Maya",
    skin: "#C68A63",
    hair: "curly",
    hairColor: "#2A1B15",
    top: "#FFB21E",
    top2: "#FFFFFF",
  },
  omar: {
    name: "Omar",
    skin: "#B98058",
    hair: "short",
    hairColor: "#1E1917",
    top: "#3D6BFF",
    top2: "#DCE6FF",
    beard: "#1E1917",
  },
  linda: {
    name: "Linda",
    skin: "#F2C9A7",
    hair: "bob",
    hairColor: "#C9C2BB",
    top: "#14A37F",
    top2: "#0E7C60",
    glasses: true,
  },
  sara: {
    name: "Sara",
    skin: "#E3AF88",
    hair: "hijab",
    hairColor: "#7A55D6",
    top: "#F2542D",
    top2: "#FFFFFF",
  },
  james: {
    name: "James",
    skin: "#EDBE98",
    hair: "bald",
    hairColor: "#9C9690",
    top: "#26305C",
    top2: "#F2542D",
    glasses: true,
    beard: "#B7B1AA",
    tie: true,
  },
  dev: {
    name: "Dev",
    skin: "#8C5A3C",
    hair: "spiky",
    hairColor: "#141011",
    top: "#22B5A5",
    top2: "#E8FFFB",
  },
} satisfies Record<string, CastMember>;

export type CastId = keyof typeof CAST;
export const CAST_IDS = Object.keys(CAST) as [CastId, ...CastId[]];

export const POSES = [
  "idle",
  "wave",
  "point",
  "think",
  "shrug",
  "celebrate",
  "worried",
  "present",
  "type",
  "phone",
] as const;
export type Pose = (typeof POSES)[number];

export const MOODS = ["neutral", "happy", "worried", "surprised", "thinking", "confident"] as const;
export type Mood = (typeof MOODS)[number];
