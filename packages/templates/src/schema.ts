import { z } from "zod";
import { CAST, CAST_IDS, HAIR_STYLES, MOODS, POSES } from "./cast";
import { EMOJI_REF } from "./emoji";
import { MOVE_IDS, moveDef } from "./moves";
import { ACTS, ENTERS, FACES, HATS, LIGHTS, PROP_KINDS, SETS, TONES } from "./paper";

/**
 * plan.json — what the video says and shows, scene by scene.
 * Written by hand today; written by the AI planner in Phase 3. Validated before every voice/render run.
 */

const text = (max: number) => z.string().trim().min(1).max(max);
const icon = z
  .string()
  .regex(/^[a-z0-9-]+$/, "use a lucide icon name in kebab-case, e.g. credit-card")
  .optional();
const emoji = z
  .string()
  .regex(
    EMOJI_REF,
    "use a Fluent emoji name in kebab-case, e.g. briefcase or woman-office-worker:medium",
  );
/** A brand logo by Simple Icons slug (simpleicons.org), e.g. nvidia. Unknown slugs show the name as text. */
const logo = z
  .string()
  .regex(/^[a-z0-9]+$/, "use a Simple Icons slug: lower-case letters and digits, e.g. nvidia");
/** A word from the narration. The item appears when it is spoken; without it, items are spaced evenly. */
const at = z.string().trim().min(1).max(40).optional();
/** A real photo by its id in plan.photos. */
const photo = z
  .string()
  .regex(/^[a-z0-9-]+$/, "use the id of a photo in plan.photos, e.g. jensen-huang");
const numberFormat = {
  prefix: z.string().max(4).optional(),
  suffix: z.string().max(12).optional(),
  decimals: z.number().int().min(0).max(3).optional(),
};

export const HookProps = z.strictObject({
  kicker: text(60).optional(),
  title: text(90),
  /** Words inside `title` to colour and underline. */
  highlight: text(60).optional(),
});

export const CounterProps = z.strictObject({
  value: z.number().min(0),
  ...numberFormat,
  label: text(60),
  sublabel: text(80).optional(),
});

export const FlowProps = z.strictObject({
  title: text(70).optional(),
  steps: z
    .array(z.strictObject({ label: text(28), icon }))
    .min(2)
    .max(5),
  /** Draws an arrow from the last step back to the first. */
  loop: z.boolean().optional(),
});

export const ChartProps = z.strictObject({
  title: text(70),
  bars: z
    .array(
      z.strictObject({
        label: text(16),
        value: z.number().min(0),
        highlight: z.boolean().optional(),
      }),
    )
    .min(2)
    .max(8),
  ...numberFormat,
  source: text(80).optional(),
});

const CompareSide = z.strictObject({
  title: text(24),
  icon,
  /** Shown instead of the icon. */
  logo: logo.optional(),
  tone: z.enum(["positive", "negative", "neutral"]).optional(),
  points: z.array(text(40)).min(1).max(4),
});

export const CompareProps = z.strictObject({
  left: CompareSide,
  right: CompareSide,
  verdict: text(70).optional(),
});

export const ListProps = z.strictObject({
  title: text(70),
  items: z
    .array(z.strictObject({ text: text(60), icon }))
    .min(2)
    .max(6),
});

export const MascotProps = z.strictObject({
  /** Speech-bubble text. */
  text: text(140),
});

/** A 3D emoji (or a logo) that pops in near the edge of any scene. */
export const Sticker = z
  .strictObject({
    emoji: emoji.optional(),
    logo: logo.optional(),
    at,
    place: z
      .enum(["top-left", "top-right", "bottom-left", "bottom-right", "left", "right"])
      .optional(),
    size: z.enum(["s", "m", "l"]).optional(),
  })
  .refine((st) => Boolean(st.emoji) !== Boolean(st.logo), "a sticker needs either emoji or logo");

/** One of the cartoon cast (cast.ts), with a pose and mood that can change on spoken words. */
export const CharacterRef = z.strictObject({
  /** A built-in cast id (cast.ts) or an id from plan.cast. */
  who: z.string().regex(/^[a-z][a-z0-9-]*$/, "use a cast id, e.g. maya"),
  pose: z.enum(POSES).optional(),
  mood: z.enum(MOODS).optional(),
  beats: z
    .array(
      z.strictObject({
        at: text(40),
        pose: z.enum(POSES).optional(),
        mood: z.enum(MOODS).optional(),
      }),
    )
    .max(4)
    .optional(),
  /** Mouth follows the narration (the character is the one speaking). */
  talking: z.boolean().optional(),
});

const tone = z.enum(["positive", "negative", "neutral"]).optional();

/** A cast member in a situation: bubble, name tag, big chips and flying props. */
export const StoryProps = z.strictObject({
  character: CharacterRef,
  label: text(40).optional(),
  bubble: z
    .strictObject({ text: text(90), kind: z.enum(["speech", "thought"]).optional(), at })
    .optional(),
  chips: z
    .array(
      z.strictObject({ text: text(28), emoji: emoji.optional(), logo: logo.optional(), tone, at }),
    )
    .max(3)
    .optional(),
  props: z.array(z.strictObject({ emoji, at })).max(6).optional(),
  side: z.enum(["left", "right"]).optional(),
});

/** A phone chat that plays out message by message. */
export const ChatProps = z.strictObject({
  title: text(30),
  avatar: emoji.optional(),
  messages: z
    .array(z.strictObject({ from: z.enum(["me", "them"]), text: text(80), at }))
    .min(2)
    .max(6),
  character: CharacterRef.optional(),
});

/** One numbered tip, step or fix with a big 3D emoji. */
export const TipProps = z.strictObject({
  number: z.number().int().min(1).max(20),
  label: text(16).optional(),
  title: text(48),
  text: text(120).optional(),
  emoji,
  character: CharacterRef.optional(),
});

/** Opens a chapter of a long video: number, title, year. Chapter scenes become YouTube chapters. */
export const ChapterProps = z.strictObject({
  number: z.number().int().min(1).max(30),
  title: text(40),
  /** Big background text, usually a year or a range ("1993", "2006–2011"). */
  year: text(12).optional(),
  emoji: emoji.optional(),
  logo: logo.optional(),
  /** Paper look: a black card with the title written by hand, instead of the coloured chapter page. */
  card: z.boolean().optional(),
});

/** Dates along a line, revealed as they are spoken. */
export const TimelineProps = z.strictObject({
  title: text(70).optional(),
  items: z
    .array(
      z.strictObject({
        year: text(10),
        label: text(32),
        emoji: emoji.optional(),
        logo: logo.optional(),
        at,
      }),
    )
    .min(2)
    .max(6),
  /** 1-based item that gets a glow. */
  highlight: z.number().int().min(1).max(6).optional(),
});

/** A real, sourced quote with attribution. Words appear as they are spoken. */
export const QuoteProps = z.strictObject({
  text: text(180),
  /** Who said it. */
  by: text(40),
  /** Role, place and year, e.g. "Nvidia CEO · Stanford, 2024". */
  context: text(70).optional(),
  /** Words inside `text` to colour. */
  highlight: text(60).optional(),
  character: CharacterRef.optional(),
  /** The speaker's real photo, shown beside the card (instead of a character). */
  photo: photo.optional(),
});

/**
 * A real photo filling the frame, drifting slowly towards the face. Tall photos sit in a frame on one
 * side with the name beside them. A stamp can slam onto it on a spoken word.
 */
export const PhotoProps = z.strictObject({
  photo,
  /** Name tag, e.g. "Jensen Huang". */
  name: text(40).optional(),
  /** Under the name, e.g. "Nvidia co-founder and CEO". */
  role: text(60).optional(),
  /** Small tag in the corner, e.g. "Stanford · 30/04/2026". */
  caption: text(48).optional(),
  stamp: z.strictObject({ text: text(24), at }).optional(),
  /** Black and white, for older or darker moments. */
  mono: z.boolean().optional(),
});

/** Two to four real people side by side, cut out of their photos, popping in as they are named. */
export const PeopleProps = z.strictObject({
  title: text(70).optional(),
  people: z
    .array(z.strictObject({ photo, name: text(28), role: text(40).optional(), at }))
    .min(2)
    .max(4),
  /** Puts "VS" between two people. */
  versus: z.boolean().optional(),
});

/** A newspaper clipping: outlet, date, headline, an excerpt with a highlighter sweep, a pinned photo. */
export const HeadlineProps = z.strictObject({
  outlet: text(40),
  date: text(20).optional(),
  /** Copied exactly from the outlet. */
  headline: text(140),
  /** A sentence or two from the article, copied exactly. */
  excerpt: text(280).optional(),
  /** Part of the excerpt (or the headline) to mark with a highlighter as it is spoken. */
  highlight: text(160).optional(),
  photo: photo.optional(),
  logo: logo.optional(),
  /** A cartoon in the pinned frame, for channels that draw people instead of showing photos. */
  character: CharacterRef.optional(),
});

/** A page of an official statement; the camera moves in as a highlighted passage is read. */
export const DocumentProps = z.strictObject({
  title: text(80),
  /** Who issued it and when, e.g. "Nvidia Board of Directors · 06/11/2026". */
  from: text(70).optional(),
  paragraphs: z.array(text(420)).min(1).max(4),
  /** A passage inside one paragraph, copied exactly. Highlighted as it is spoken. */
  highlight: text(220).optional(),
  logo: logo.optional(),
});

/** A case file on one person: photo (or a blank silhouette), facts typed in as spoken, a stamp. */
export const ProfileProps = z.strictObject({
  name: text(40),
  /** Line under the name, e.g. "Former Megaspeed executive". */
  subtitle: text(60).optional(),
  /** Leave out when no free photo exists: a silhouette with a question mark is shown. */
  photo: photo.optional(),
  /** A cartoon instead of a photo. */
  character: CharacterRef.optional(),
  facts: z
    .array(z.strictObject({ label: text(16), value: text(52), at }))
    .min(2)
    .max(5),
  stamp: text(24).optional(),
});

/** A line chart drawn as the narrator speaks, e.g. a share price. Marks label key points. */
export const LineProps = z.strictObject({
  title: text(70),
  points: z
    .array(z.strictObject({ label: text(14), value: z.number() }))
    .min(3)
    .max(80),
  ...numberFormat,
  /** Labels on chosen points (0-based index), revealed in order. */
  marks: z
    .array(z.strictObject({ index: z.number().int().min(0), text: text(36), at }))
    .max(3)
    .optional(),
  source: text(80).optional(),
});

export const PLACES = ["diner", "office", "bedroom", "stage", "datacenter", "trading"] as const;

/** Cast members in an illustrated location. */
export const PlaceProps = z.strictObject({
  place: z.enum(PLACES),
  /** Location tag, e.g. "Denny's · San Jose · 1993". */
  caption: text(48).optional(),
  characters: z
    .array(CharacterRef.extend({ label: text(40).optional() }))
    .max(3)
    .optional(),
  /** Text on the stage screen, the office whiteboard or the trading wall. */
  screen: text(40).optional(),
  /** Trading place: charts go up or down. */
  trend: z.enum(["up", "down"]).optional(),
  /** Emoji that land on the table. */
  props: z.array(z.strictObject({ emoji, at })).max(4).optional(),
  bubble: z
    .strictObject({
      text: text(90),
      kind: z.enum(["speech", "thought"]).optional(),
      at,
      /** 1-based character the bubble belongs to. */
      who: z.number().int().min(1).max(3).optional(),
    })
    .optional(),
});

const percent = z.number().min(-20).max(120);

/** A generated illustration by its id in plan.art. */
const artId = z
  .string()
  .regex(/^[a-z0-9-]+$/, "use the id of a picture in plan.art, e.g. host-neutral");

/** A stick figure in a sketch scene. `who` is a cast id; the figure takes its colours, hair and glasses. */
export const SketchActor = z.strictObject({
  who: z.string().regex(/^[a-z][a-z0-9-]*$/, "use a cast id, e.g. maya"),
  /** An illustrated cut-out (plan.art) drawn instead of the stick figure. Beats can swap it for another pose. */
  art: artId.optional(),
  /** Where it stands, in % of the frame width. */
  x: percent,
  /** Feet height in % of the frame height. Default: the set's floor. */
  y: percent.optional(),
  scale: z.number().min(0.3).max(3).optional(),
  /** Faces left. Default: towards the middle of the frame. */
  flip: z.boolean().optional(),
  face: z.enum(FACES).optional(),
  act: z.enum(ACTS).optional(),
  hat: z.enum(HATS).optional(),
  /** Appears on this spoken word. Without it the figure is there from the start. */
  at,
  /** How it arrives: walk (from the nearest edge), pop or drop. Default: walk when `at` is set. */
  enter: z.enum(["walk", "pop", "drop", "none"]).optional(),
  /** Walks to a new spot on a spoken word. */
  to: z.strictObject({ x: percent, at }).optional(),
  /** Hand-written name under the figure. */
  tag: text(28).optional(),
  /** Speech bubble (thought bubble with think: true), shown on `sayAt`. */
  say: text(70).optional(),
  sayAt: at,
  think: z.boolean().optional(),
  /** Mouth follows the narration. */
  talking: z.boolean().optional(),
  beats: z
    .array(
      z.strictObject({
        at: text(40),
        face: z.enum(FACES).optional(),
        act: z.enum(ACTS).optional(),
        art: artId.optional(),
      }),
    )
    .max(4)
    .optional(),
});

/** An object in a sketch scene (paper.ts lists the kinds). */
export const SketchProp = z.strictObject({
  kind: z.enum(PROP_KINDS),
  x: percent,
  /** Bottom of the object in % of the frame height. Default: the set's floor. */
  y: percent.optional(),
  scale: z.number().min(0.2).max(4).optional(),
  rot: z.number().min(-180).max(180).optional(),
  /** Hand-written text on or above it. */
  text: text(60).optional(),
  text2: text(40).optional(),
  tone: z.enum(TONES).optional(),
  /** Meaning depends on the kind: stack height, share of a pie (0–1), tilt of a scale (-1–1), count-up target. */
  value: z.number().optional(),
  values: z.array(z.number()).min(2).max(12).optional(),
  logo: logo.optional(),
  /** For kind "picture": the illustration to show (plan.art). */
  art: artId.optional(),
  /** Appears on this spoken word, and leaves on `until`. */
  at,
  until: at,
  enter: z.enum(ENTERS).optional(),
  /** Drawn in front of the figures. */
  front: z.boolean().optional(),
  /** Mirrored left to right (for chairs and other things with a direction). Not for props with text. */
  flip: z.boolean().optional(),
});

/**
 * One beat of the story staged as a cartoon: a drawn location, stick figures and props with
 * hand-written labels. Scene coordinates are % of a 16:9 frame.
 */
export const SketchProps = z.strictObject({
  set: z.enum(SETS),
  /** A painted background (plan.art) drawn instead of the set. */
  backdrop: artId.optional(),
  /** Where feet stand on a backdrop, in % of the frame height. Default: the set's floor. */
  floor: z.number().min(40).max(100).optional(),
  light: z.enum(LIGHTS).optional(),
  /** Text on the set's own sign, board or screen. */
  screen: text(40).optional(),
  trend: z.enum(["up", "down"]).optional(),
  actors: z.array(SketchActor).max(6).optional(),
  props: z.array(SketchProp).max(10).optional(),
  /** Hits and showers on a spoken word: a camera shake, a punch-in, a white flash, falling bills or confetti. */
  fx: z
    .array(z.strictObject({ kind: z.enum(["shake", "zoom", "flash", "rain", "confetti"]), at }))
    .max(4)
    .optional(),
  /** Shorts show the middle two thirds of the scene. This moves that window: % of the frame width to centre on. */
  focus: z.number().min(0).max(100).optional(),
  /** "still" keeps the whole picture on screen. Default: a new shot every second or two. */
  camera: z.enum(["auto", "still"]).optional(),
  /** Big hand-written words across the top. `text2` is the part in red. */
  title: z.strictObject({ text: text(40), text2: text(24).optional(), at }).optional(),
});

/** Position inside a manga panel, in % of the panel. */
const mangaPos = z.number().min(-30).max(130);

/**
 * A cut-out character standing in a manga panel, placed on the panel's picture so it stays put
 * when the picture is cropped. Beats swap the pose on a spoken word.
 */
export const MangaActor = z.strictObject({
  art: artId,
  /** Centre, in % of the picture's width. */
  x: mangaPos,
  /** Feet (bottom of the cut-out), in % of the picture's height. Default: 104, just below the edge. Above 100 crops the legs (waist-up shots). */
  y: z.number().min(-30).max(300).optional(),
  /** Height in % of the picture's height. Default: 95. */
  h: z.number().min(20).max(400).optional(),
  /** Mirrored left to right. */
  flip: z.boolean().optional(),
  at,
  /**
   * How it arrives: pop, slide in from the nearest side, from the left or right, rise from the
   * bottom, or already there. Default: slide when `at` is set.
   */
  enter: z.enum(["pop", "slide", "left", "right", "bottom", "none"]).optional(),
  /** Moves to a new spot (in % of the picture) on a spoken word, with a walking bob. */
  to: z.strictObject({ x: mangaPos, y: z.number().min(-30).max(300).optional(), at }).optional(),
  /** On a spoken word: a new pose, and/or turning round (flip). */
  beats: z
    .array(z.strictObject({ at: text(40), art: artId.optional(), flip: z.boolean().optional() }))
    .max(4)
    .optional(),
});

/** A manga speech bubble. `shout` is a spiky burst, `thought` a cloud. */
export const MangaBubble = z.strictObject({
  text: text(70),
  /** Centre, in % of the panel. */
  x: mangaPos,
  y: mangaPos,
  at,
  kind: z.enum(["speech", "thought", "shout"]).optional(),
  /** Where the tail points. Default: down. */
  tail: z.enum(["down", "left", "right", "none"]).optional(),
});

/** One manga panel: a picture, cut-out characters, bubbles and speed lines. */
export const MangaPanel = z.strictObject({
  /** The picture filling the panel (plan.art). */
  art: artId,
  /** Appears on this spoken word. The first panel is there from the start. */
  at,
  /** Point the camera pushes towards, in % of the panel. Default: the middle. */
  focus: z
    .strictObject({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) })
    .optional(),
  /** Slow camera move inside the panel. Default: in. */
  move: z.enum(["in", "out", "left", "right", "up", "down"]).optional(),
  actors: z.array(MangaActor).max(3).optional(),
  bubbles: z.array(MangaBubble).max(3).optional(),
  /** Speed lines over the panel from `linesAt` on: radial (focus lines) or speed (horizontal streaks). */
  lines: z.enum(["radial", "speed"]).optional(),
  linesAt: at,
  /** "mono" draws the panel in black and white (memories, rewinds). */
  tone: z.enum(["color", "mono"]).optional(),
});

/** A big sound-effect word slammed onto the page, e.g. TICK, BOOM. Position in % of the frame. */
export const MangaSfx = z.strictObject({
  text: text(16),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  at,
  /** Letter height in % of the frame height. Default: 16. */
  size: z.number().min(4).max(40).optional(),
  rot: z.number().min(-45).max(45).optional(),
  color: z.enum(["red", "yellow", "white", "blue"]).optional(),
});

/**
 * One beat of the story as a colour manga page: one to three panels that appear as they are
 * spoken, with cut-out characters, speech bubbles, sound-effect words and speed lines.
 * `full`: one panel fills the frame. `row`: panels side by side with slanted gutters.
 * `feature`: a big panel on the left and two stacked on the right.
 */
export const MangaProps = z.strictObject({
  layout: z.enum(["full", "row", "feature"]).optional(),
  panels: z.array(MangaPanel).min(1).max(3),
  sfx: z.array(MangaSfx).max(3).optional(),
  /** Narration box in the top-left corner. */
  box: z.strictObject({ text: text(90), at }).optional(),
  /** Hits on a spoken word: shake, white flash, punch-in, or a rewind (the page runs backwards in blue). */
  fx: z
    .array(z.strictObject({ kind: z.enum(["shake", "flash", "zoom", "rewind"]), at }))
    .max(4)
    .optional(),
});

/** A black card with a line written by hand as it is spoken. */
export const CardProps = z.strictObject({
  text: text(200),
  /** Words inside `text` to colour. */
  highlight: text(60).optional(),
});

/** A grid of company logos that pop in as they are named. */
export const LogosProps = z.strictObject({
  title: text(70),
  items: z
    .array(z.strictObject({ logo, label: text(24).optional(), at }))
    .min(2)
    .max(8),
  note: text(80).optional(),
});

/**
 * A move from the exercise library (moves.ts), demonstrated by a cast member while reps or seconds count up.
 * Cues appear as they are spoken. Only library moves: they are low-impact and drawn correctly.
 */
export const ExerciseProps = z.strictObject({
  move: z.enum(MOVE_IDS),
  /** Shown name; defaults to the library's. */
  name: text(36).optional(),
  number: z.number().int().min(1).max(20).optional(),
  /** Cast member doing the move (default linda). */
  who: z
    .string()
    .regex(/^[a-z][a-z0-9-]*$/, "use a cast id, e.g. linda")
    .optional(),
  /** How much, from a named guide: "5 slow reps", "10 s each leg". */
  dose: text(28).optional(),
  /** Muscles or skill, e.g. "Thighs · Hips". */
  works: text(32).optional(),
  cues: z
    .array(z.strictObject({ text: text(44), at }))
    .min(1)
    .max(3),
  /** An easier way to do it. Long videos only. */
  easier: text(70).optional(),
  /**
   * Follow-along: the move keeps going for at least this many seconds, with a countdown bar,
   * so viewers can do it with the figure. The narration should coach through it.
   */
  seconds: z.number().int().min(10).max(120).optional(),
  /** Moves with two sides: switch after this many reps (or seconds of holding, for holds). */
  switchEvery: z.number().int().min(1).max(60).optional(),
  /** Follow-along: the next move's name, shown in the last few seconds. */
  next: text(30).optional(),
  /** Hold on with one hand: the near hand lets go and hangs by the side (a harder version). */
  oneHand: z.boolean().optional(),
  /** Paper look: the figure and room drawn in ink like the sketch scenes, with hand lettering. */
  paper: z.boolean().optional(),
});

/**
 * The last 20 seconds of a long video, with empty spaces where YouTube's end screen elements go
 * (a video box on the left, the subscribe button on the right). Always the last scene; never in Shorts.
 */
export const EndscreenProps = z.strictObject({
  title: text(48),
  /** Leave space for a "watch next" video. Off on a channel's first video, when there's nothing to link. */
  video: z.boolean().default(true),
  /** Paper look: white hand lettering on black. */
  card: z.boolean().optional(),
});

function scene<T extends string, P extends z.ZodType>(template: T, props: P) {
  return z.strictObject({
    template: z.literal(template),
    narration: text(600),
    props,
    stickers: z.array(Sticker).max(4).optional(),
    /** Starts a YouTube chapter here without a chapter card: a small label over this scene. */
    chapter: text(40).optional(),
    /**
     * Picks the scenes for the Short. "also" = in both videos, "only" = in the Short only.
     * When no scene sets it, the Short uses every scene.
     */
    short: z.enum(["also", "only"]).optional(),
  });
}

export const Scene = z.discriminatedUnion("template", [
  scene("hook", HookProps),
  scene("counter", CounterProps),
  scene("flow", FlowProps),
  scene("chart", ChartProps),
  scene("compare", CompareProps),
  scene("list", ListProps),
  scene("mascot", MascotProps),
  scene("story", StoryProps),
  scene("chat", ChatProps),
  scene("tip", TipProps),
  scene("chapter", ChapterProps),
  scene("timeline", TimelineProps),
  scene("quote", QuoteProps),
  scene("place", PlaceProps),
  scene("logos", LogosProps),
  scene("exercise", ExerciseProps),
  scene("photo", PhotoProps),
  scene("people", PeopleProps),
  scene("headline", HeadlineProps),
  scene("document", DocumentProps),
  scene("profile", ProfileProps),
  scene("line", LineProps),
  scene("sketch", SketchProps),
  scene("card", CardProps),
  scene("manga", MangaProps),
  scene("endscreen", EndscreenProps),
]);

export const TEMPLATE_IDS = [
  "hook",
  "counter",
  "flow",
  "chart",
  "compare",
  "list",
  "mascot",
  "story",
  "chat",
  "tip",
  "chapter",
  "timeline",
  "quote",
  "place",
  "logos",
  "exercise",
  "photo",
  "people",
  "headline",
  "document",
  "profile",
  "line",
  "sketch",
  "card",
  "manga",
  "endscreen",
] as const;

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "use a colour like #1A2B3C");

/** A character this plan adds to the cast — e.g. a cartoon of a real founder for a documentary. */
export const CastLook = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: text(30),
  skin: hex,
  hair: z.enum(HAIR_STYLES),
  hairColor: hex,
  top: hex,
  top2: hex,
  glasses: z.boolean().optional(),
  beard: hex.optional(),
  tie: z.boolean().optional(),
});

/** A thumbnail: a few huge words, one cartoon face with a strong mood, and a logo or emoji. */
export const ThumbnailSpec = z.strictObject({
  /** Two to five words. Shown in capitals. */
  text: text(40),
  /** Words inside `text` to colour. */
  highlight: text(24).optional(),
  /** A small tag above the words, e.g. "1993 → 2025". */
  badge: text(20).optional(),
  character: CharacterRef.pick({ who: true, pose: true, mood: true }).optional(),
  logo: logo.optional(),
  emoji: emoji.optional(),
  /** Real people, cut out of their photos (plan.photos ids). The first is the biggest. Replaces the character. */
  photos: z.array(photo).max(3).optional(),
  /** Paper look: a whole sketch scene as the picture, with the words across the top. Replaces the character. */
  sketch: SketchProps.optional(),
  /** "top": the words run across the top, with a large character below and the prop beside it. Default: words left, character right. */
  layout: z.enum(["side", "top"]).optional(),
});

/** A free-licence photo from Wikimedia Commons. The kit credits it in the description. */
export const PhotoSource = z.strictObject({
  id: z.string().regex(/^[a-z0-9-]+$/, "use kebab-case, e.g. jensen-huang"),
  /** The Commons file name, e.g. "File:Jensen Huang (cropped) (2024).jpg". */
  commons: z
    .string()
    .regex(/^File:.+\.(jpe?g|png|webp|tiff?)$/i, 'use the Commons file name, e.g. "File:Name.jpg"'),
  /** Who or what it shows, for the credit line. */
  name: text(60).optional(),
  /** Point to keep in frame (0–1 from the top-left), when face detection picks the wrong spot. */
  focus: z.strictObject({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }).optional(),
});

const box = z.strictObject({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});

/** A generated illustration in media/: a painted background, or a cut-out character or object. */
export const ArtSource = z.strictObject({
  id: artId,
  /** Inside media/, e.g. art/host-neutral.png. */
  file: z.string().regex(/^art\/[a-z0-9-]+\.(png|jpe?g|webp)$/, "use art/<id>.png"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  /** The cut-out's extent inside the file, as fractions. Missing: the whole file. */
  box: box.optional(),
});

/** Everything the YouTube upload form asks for that the script writer should decide. */
export const UploadInfo = z.strictObject({
  /** Up to three titles (YouTube allows 100 characters). The first is the main one; all three go into Test & compare. */
  titles: z.array(text(100)).min(1).max(3),
  /** Up to three thumbnails, in the same order. */
  thumbnails: z.array(ThumbnailSpec).min(1).max(3),
  /** Search tags for this video. The channel's own tags are added to them. */
  tags: z.array(text(40)).max(20).optional(),
  /** Shown above the title. YouTube shows the first three. */
  hashtags: z
    .array(z.string().regex(/^#[A-Za-z0-9]+$/, "use #OneWord"))
    .max(3)
    .optional(),
  /** Opens the pinned comment: one question viewers can answer. Also its own line in the description. */
  question: text(200).optional(),
  /** Description paragraph after the summary: three or four sentences with the key figures. */
  keyFigures: text(700).optional(),
  /** Closing description line, e.g. "Figures as of 10/11/2026, from CNBC, Reuters and company filings." */
  figuresAsOf: text(240).optional(),
  /** The playlist this video belongs in. */
  playlist: text(60).optional(),
  short: z.strictObject({ title: text(100), description: text(1500).optional() }).optional(),
});

/** Every object with a `who` (character references) inside a scene, with its path. */
function characterRefs(
  value: unknown,
  path: (string | number)[] = [],
): { who: string; path: (string | number)[] }[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => characterRefs(v, [...path, i]));
  if (!value || typeof value !== "object") return [];
  const out: { who: string; path: (string | number)[] }[] = [];
  for (const [key, v] of Object.entries(value)) {
    if (key === "who" && typeof v === "string") out.push({ who: v, path: [...path, key] });
    else out.push(...characterRefs(v, [...path, key]));
  }
  return out;
}

/** Every photo id inside a scene or thumbnail (keys "photo" and "photos"), with its path. */
function photoRefsIn(
  value: unknown,
  path: (string | number)[] = [],
): { id: string; path: (string | number)[] }[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => photoRefsIn(v, [...path, i]));
  if (!value || typeof value !== "object") return [];
  const out: { id: string; path: (string | number)[] }[] = [];
  for (const [key, v] of Object.entries(value)) {
    if (key === "photo" && typeof v === "string") out.push({ id: v, path: [...path, key] });
    else if (key === "photos" && Array.isArray(v))
      v.forEach((id, i) => {
        if (typeof id === "string") out.push({ id, path: [...path, key, i] });
      });
    else out.push(...photoRefsIn(v, [...path, key]));
  }
  return out;
}

export const Plan = z
  .strictObject({
    version: z.literal(1),
    channel: z.string().min(1),
    title: text(120),
    /** One or two sentences that open the YouTube description (search shows only the start). */
    summary: text(300).optional(),
    /** A narrator for this video only, instead of the channel's (e.g. to try a voice or a faster pace). */
    voice: z
      .strictObject({
        id: text(40),
        speed: z.number().min(0.6).max(1.6),
        /** Cuts the silence at both ends of every clip, so sentences follow each other without a pause. */
        trim: z.boolean().optional(),
      })
      .optional(),
    /** Extra characters for this video. */
    cast: z.array(CastLook).max(16).optional(),
    /** Real photos the scenes and thumbnails use, by id. */
    photos: z.array(PhotoSource).max(40).optional(),
    /** Generated illustrations the sketch and manga scenes use, by id. */
    art: z.array(ArtSource).max(300).optional(),
    /** Where the facts come from. Listed in description.txt. */
    sources: z
      .array(z.strictObject({ label: text(120), url: z.url() }))
      .max(60)
      .optional(),
    /** Up to 1,000 scenes: hour-long manga sagas run about 400. */
    scenes: z.array(Scene).min(1).max(1000),
    /** Titles, thumbnails, tags and the rest of the upload form (upload/UPLOAD.md). */
    upload: UploadInfo.optional(),
  })
  .superRefine((plan, ctx) => {
    plan.scenes.forEach((s, i) => {
      if (s.template === "endscreen" && i !== plan.scenes.length - 1)
        ctx.addIssue({
          code: "custom",
          path: ["scenes", i, "template"],
          message: "endscreen must be the last scene",
        });
      if (s.template === "exercise" && s.props.switchEvery && !moveDef(s.props.move).otherSide)
        ctx.addIssue({
          code: "custom",
          path: ["scenes", i, "props", "switchEvery"],
          message: `"${s.props.move}" has no other side to switch to`,
        });
    });
    const photoIds = new Set((plan.photos ?? []).map((p) => p.id));
    if (photoIds.size !== (plan.photos ?? []).length)
      ctx.addIssue({ code: "custom", path: ["photos"], message: "two photos share an id" });
    const photoRefs = [
      ...plan.scenes.flatMap((s, i) => photoRefsIn(s.props, ["scenes", i, "props"])),
      ...photoRefsIn(plan.upload?.thumbnails ?? [], ["upload", "thumbnails"]),
    ];
    for (const ref of photoRefs) {
      if (!photoIds.has(ref.id))
        ctx.addIssue({
          code: "custom",
          path: ref.path,
          message: `unknown photo "${ref.id}". Add it to plan.photos${photoIds.size ? ` (have: ${[...photoIds].join(", ")})` : ""}`,
        });
    }
    const own = new Set((plan.cast ?? []).map((c) => c.id));
    for (const c of plan.cast ?? []) {
      if (c.id in CAST)
        ctx.addIssue({
          code: "custom",
          path: ["cast"],
          message: `"${c.id}" is already a built-in cast member`,
        });
    }
    const known = [...CAST_IDS, ...own];
    const refs = [
      ...plan.scenes.flatMap((s, i) => characterRefs(s.props, ["scenes", i, "props"])),
      ...characterRefs(plan.upload?.thumbnails ?? [], ["upload", "thumbnails"]),
    ];
    for (const ref of refs) {
      if (!known.includes(ref.who)) {
        ctx.addIssue({
          code: "custom",
          path: ref.path,
          message: `unknown character "${ref.who}". Options: ${known.join(", ")}`,
        });
      }
    }
  });

/** One spoken word. Seconds from the start of the scene's voice file. */
export const Word = z.strictObject({
  text: z.string(),
  start: z.number().min(0),
  end: z.number().min(0),
});

/** voice.json entry — produced by the voice step, one per scene. */
export const SceneVoice = z.strictObject({
  /** Hash of narration + voice settings. A mismatch means the audio is stale. */
  key: z.string(),
  /** Path inside the video's media/ folder, e.g. voice/01.wav */
  file: z.string(),
  duration: z.number().positive(),
  /** Loudness per frame (0–1) at FPS. Drives the mascot's mouth. */
  envelope: z.array(z.number().min(0).max(1)),
  words: z.array(Word),
});

export const VoiceFile = z.strictObject({ scenes: z.array(SceneVoice) });

export type Plan = z.infer<typeof Plan>;
export type Scene = z.infer<typeof Scene>;
export type TemplateId = Scene["template"];
export type Word = z.infer<typeof Word>;
export type SceneVoice = z.infer<typeof SceneVoice>;
export type VoiceFile = z.infer<typeof VoiceFile>;
export type HookProps = z.infer<typeof HookProps>;
export type CounterProps = z.infer<typeof CounterProps>;
export type FlowProps = z.infer<typeof FlowProps>;
export type ChartProps = z.infer<typeof ChartProps>;
export type CompareProps = z.infer<typeof CompareProps>;
export type ListProps = z.infer<typeof ListProps>;
export type MascotProps = z.infer<typeof MascotProps>;
export type Sticker = z.infer<typeof Sticker>;
export type CharacterRef = z.infer<typeof CharacterRef>;
export type StoryProps = z.infer<typeof StoryProps>;
export type ChatProps = z.infer<typeof ChatProps>;
export type TipProps = z.infer<typeof TipProps>;
export type ChapterProps = z.infer<typeof ChapterProps>;
export type TimelineProps = z.infer<typeof TimelineProps>;
export type QuoteProps = z.infer<typeof QuoteProps>;
export type PlaceProps = z.infer<typeof PlaceProps>;
export type Place = (typeof PLACES)[number];
export type EndscreenProps = z.infer<typeof EndscreenProps>;
export type ThumbnailSpec = z.infer<typeof ThumbnailSpec>;
export type UploadInfo = z.infer<typeof UploadInfo>;
export type LogosProps = z.infer<typeof LogosProps>;
export type ExerciseProps = z.infer<typeof ExerciseProps>;
export type CastLook = z.infer<typeof CastLook>;
export type PhotoProps = z.infer<typeof PhotoProps>;
export type PeopleProps = z.infer<typeof PeopleProps>;
export type HeadlineProps = z.infer<typeof HeadlineProps>;
export type DocumentProps = z.infer<typeof DocumentProps>;
export type ProfileProps = z.infer<typeof ProfileProps>;
export type LineProps = z.infer<typeof LineProps>;
export type PhotoSource = z.infer<typeof PhotoSource>;
export type ArtSource = z.infer<typeof ArtSource>;
export type SketchProps = z.infer<typeof SketchProps>;
export type SketchActor = z.infer<typeof SketchActor>;
export type SketchProp = z.infer<typeof SketchProp>;
export type CardProps = z.infer<typeof CardProps>;
export type MangaProps = z.infer<typeof MangaProps>;
export type MangaPanel = z.infer<typeof MangaPanel>;
export type MangaActor = z.infer<typeof MangaActor>;
export type MangaBubble = z.infer<typeof MangaBubble>;
export type MangaSfx = z.infer<typeof MangaSfx>;

/** A box as fractions of a photo, from its top-left corner. */
export interface PhotoBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A downloaded photo the renderer can draw (core fills this from media/photos/index.json). */
export interface PhotoData {
  /** Inside media/, e.g. photos/jensen-huang.jpg. */
  file: string;
  /** The person cut out of the background (PNG with transparency), when it could be made. */
  cut: string | null;
  width: number;
  height: number;
  /** The biggest face, when one was found. */
  face: PhotoBox | null;
  /** The cut-out person's extent. */
  subject: PhotoBox | null;
  /** Point to keep in frame, set by the plan. Wins over the face. */
  focus: { x: number; y: number } | null;
}

/** A logo the renderer can draw: Simple Icons path (24×24) and brand colour, or just the name. */
export interface LogoData {
  title: string;
  /** "#RRGGBB", or null for text-only logos. */
  hex: string | null;
  path: string | null;
}

/** Everything the Remotion compositions need. Built by core from plan.json + voice.json + channel.yaml. */
export type RenderInput = {
  plan: Plan;
  voices: SceneVoice[];
  theme: { palette: string; font: string };
  channelName: string;
  mascot: string | null;
  /** "hooks": the corner mascot shows only in hook and tip scenes. Missing = every scene. */
  mascotCorner?: "always" | "hooks";
  /** Varies transitions and background between videos. */
  seed: number;
  /** Background track inside media/, e.g. music/calm.mp3. */
  music: string | null;
  /** Music level while nobody speaks (0–1). It drops to a third under the voice. */
  musicVolume: number;
  /** Pops, whooshes and dings from media/sfx/. */
  sfx: boolean;
  /** Every logo the plan uses, by slug. */
  logos: Record<string, LogoData>;
  /** Every photo the plan uses, by id. Missing in renders made before photos existed. */
  photos?: Record<string, PhotoData>;
};

export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}
