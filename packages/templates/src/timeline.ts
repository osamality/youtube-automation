import { type Format, FPS } from "./constants";
import type { RenderInput, Scene, TemplateId } from "./schema";

/**
 * Turns scenes + voice lengths into frame positions.
 *
 * Scene i lasts lead + max(minimum, voice + pad) + tail, where tail is the transition into the next scene.
 * Scenes overlap by TRANSITION_FRAMES, so each voice starts as its scene slides in,
 * and consecutive voices are separated by exactly PAD_FRAMES of silence.
 */
export const TRANSITION_FRAMES = 12;
export const LEAD_IN_FRAMES = 8;
export const PAD_FRAMES = 9;
/** Paper scenes are quick pictures: the next sentence follows almost at once. */
export const PAPER_PAD_FRAMES = 4;
export const END_HOLD_FRAMES = 36;

/** Time each template needs for its animation, even if the narration is shorter. */
export const MIN_SCENE_FRAMES: Record<TemplateId, number> = {
  hook: 75,
  counter: 105,
  flow: 120,
  chart: 120,
  compare: 120,
  list: 120,
  mascot: 90,
  story: 120,
  chat: 150,
  tip: 120,
  chapter: 105,
  timeline: 150,
  quote: 120,
  place: 120,
  logos: 120,
  /** Room for at least two reps of the slowest move. */
  exercise: 270,
  photo: 75,
  people: 105,
  headline: 120,
  document: 150,
  profile: 150,
  line: 150,
  sketch: 36,
  card: 30,
  manga: 36,
  /** YouTube end screens run for the last 5–20 seconds. */
  endscreen: 600,
};

/** Frames before an exercise figure starts moving: the entrance plus the template's own delay. */
export const EXERCISE_START_FRAMES = 14;

/** A follow-along exercise scene runs for its `seconds` after the figure starts moving. */
export function followAlongFrames(scene: Scene): number {
  if (scene.template !== "exercise" || !scene.props.seconds) return 0;
  return EXERCISE_START_FRAMES + scene.props.seconds * FPS;
}

/**
 * A card stays up long enough to read its whole line (about 19 characters a second, plus a
 * second), even when the spoken lead-in is short, as with a quote card.
 */
export function readingFrames(scene: Scene): number {
  if (scene.template !== "card") return 0;
  return Math.ceil(FPS + scene.props.text.length * 1.6);
}

/** Scenes are transparent over one shared background, so only transitions that move or fade both scenes work. */
export const TRANSITIONS = ["slide-right", "slide-bottom", "fade"] as const;
export type TransitionKind = (typeof TRANSITIONS)[number];

export interface TimedWord {
  text: string;
  /** Absolute frames. */
  start: number;
  end: number;
}

export interface TimedScene {
  index: number;
  scene: Scene;
  /** Absolute start frame (includes the overlap with the previous scene). */
  from: number;
  duration: number;
  /** Absolute frame where this scene's voice starts. */
  voiceFrom: number;
  voiceFrames: number;
  voiceFile: string;
  envelope: number[];
  words: TimedWord[];
  /** Transition used to enter this scene; null for the first scene. */
  transitionIn: TransitionKind | null;
}

export interface Timeline {
  scenes: TimedScene[];
  durationInFrames: number;
}

/** Small deterministic PRNG so the same seed always gives the same video. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildTimeline(input: Pick<RenderInput, "plan" | "voices" | "seed">): Timeline {
  const { plan, voices } = input;
  if (voices.length !== plan.scenes.length) {
    throw new Error(`plan has ${plan.scenes.length} scenes but voice has ${voices.length}`);
  }

  const rand = mulberry32(input.seed);
  const n = plan.scenes.length;
  let from = 0;
  let previous: TransitionKind | null = null;

  const scenes = plan.scenes.map((scene, index): TimedScene => {
    const voice = voices[index] as RenderInput["voices"][number];
    const voiceFrames = Math.ceil(voice.duration * FPS);
    const lead = index === 0 ? LEAD_IN_FRAMES : 0;
    const body = Math.max(
      MIN_SCENE_FRAMES[scene.template],
      voiceFrames + (isPaperScene(scene) ? PAPER_PAD_FRAMES : PAD_FRAMES),
      followAlongFrames(scene),
      readingFrames(scene),
    );
    const tail = index < n - 1 ? TRANSITION_FRAMES : END_HOLD_FRAMES;
    const duration = lead + body + tail;

    let transitionIn: TransitionKind | null = null;
    if (index > 0) {
      const options = TRANSITIONS.filter((t) => t !== previous);
      transitionIn = options[Math.floor(rand() * options.length)] as TransitionKind;
      previous = transitionIn;
    }

    const voiceFrom = from + lead;
    const words = voice.words.map((w) => {
      const start = voiceFrom + Math.round(w.start * FPS);
      return { text: w.text, start, end: Math.max(start + 1, voiceFrom + Math.round(w.end * FPS)) };
    });

    const timed: TimedScene = {
      index,
      scene,
      from,
      duration,
      voiceFrom,
      voiceFrames,
      voiceFile: voice.file,
      envelope: voice.envelope,
      words,
      transitionIn,
    };
    from += duration - TRANSITION_FRAMES;
    return timed;
  });

  return { scenes, durationInFrames: from + TRANSITION_FRAMES };
}

/** The scene on screen at `frame`. During an overlap the incoming scene wins. */
export function sceneAt(timeline: Timeline, frame: number): TimedScene | undefined {
  for (let i = timeline.scenes.length - 1; i >= 0; i--) {
    const s = timeline.scenes[i] as TimedScene;
    if (frame >= s.from && frame < s.from + s.duration) return s;
  }
  return undefined;
}

/** Voice loudness (0–1) at `frame`, from whichever scene's voice is playing. */
export function loudnessAt(timeline: Timeline, frame: number): number {
  for (const s of timeline.scenes) {
    const i = frame - s.voiceFrom;
    if (i >= 0 && i < s.envelope.length) return s.envelope[i] ?? 0;
  }
  return 0;
}

// ── formats and chapters ──────────────────────────────────────────────────

/** YouTube treats vertical videos up to 3 minutes as Shorts. */
export const SHORT_MAX_SECONDS = 180;

/**
 * The scenes one format shows. Scenes marked short: "only" stay out of the long video.
 * If any scene is marked, the Short shows only marked scenes; otherwise both show everything.
 * Shorts never get the end screen scene: YouTube shows no end screens on them.
 */
export function forFormat<T extends Pick<RenderInput, "plan" | "voices">>(
  input: T,
  format: Format,
): T {
  const scenes = input.plan.scenes;
  const marked = scenes.some((s) => s.short);
  const keep = scenes.map((s) =>
    format === "long"
      ? s.short !== "only"
      : s.template !== "endscreen" && (!marked || Boolean(s.short)),
  );
  if (keep.every(Boolean)) return input;
  return {
    ...input,
    plan: { ...input.plan, scenes: scenes.filter((_, i) => keep[i]) },
    voices:
      input.voices.length === scenes.length ? input.voices.filter((_, i) => keep[i]) : input.voices,
  };
}

export interface ChapterMark {
  seconds: number;
  title: string;
}

/** One mark per chapter scene or scene with a `chapter` label, plus "Intro" at 0:00 when the video opens before its first chapter. */
export function chapterMarks(timeline: Timeline): ChapterMark[] {
  const marks: ChapterMark[] = [];
  for (const s of timeline.scenes) {
    const title = s.scene.template === "chapter" ? s.scene.props.title : s.scene.chapter;
    if (!title) continue;
    const seconds = s.index === 0 ? 0 : Math.floor((s.from + TRANSITION_FRAMES) / FPS);
    marks.push({ seconds, title });
  }
  const first = marks[0];
  if (first && first.seconds > 0) {
    if (first.seconds < 10) first.seconds = 0;
    else marks.unshift({ seconds: 0, title: "Intro" });
  }
  return marks;
}

export function timestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** YouTube description lines, or null when YouTube wouldn't accept them (fewer than 3, or one under 10 s). */
export function chapterLines(marks: ChapterMark[], durationSeconds: number): string[] | null {
  if (marks.length < 3) return null;
  const ends = [...marks.slice(1).map((m) => m.seconds), durationSeconds];
  if (marks.some((m, i) => (ends[i] ?? 0) - m.seconds < 10)) return null;
  return marks.map((m) => `${timestamp(m.seconds)} ${m.title}`);
}

/** Scenes drawn in the paper look fill the frame: no captions, badge or mascot over them in landscape. */
export function isPaperScene(scene: Scene | undefined): boolean {
  if (!scene) return false;
  return (
    scene.template === "sketch" ||
    scene.template === "card" ||
    scene.template === "manga" ||
    (scene.template === "chapter" && scene.props.card === true) ||
    (scene.template === "endscreen" && scene.props.card === true) ||
    (scene.template === "exercise" && scene.props.paper === true)
  );
}
