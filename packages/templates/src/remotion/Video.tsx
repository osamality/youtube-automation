import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { Fragment, useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  Html5Audio,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { RenderInput } from "../schema";
import {
  buildTimeline,
  isPaperScene,
  type TimedScene,
  type Timeline,
  TRANSITION_FRAMES,
  type TransitionKind,
} from "../timeline";
import { type SceneCtx, toCtx } from "./anim";
import { Background } from "./Background";
import { handFont } from "./fonts";
import { Captions } from "./Captions";
import { Chrome, HOOK_SCENES, MascotOverlay } from "./Overlays";
import { Card, ChapterCard } from "./scenes/Card";
import { Chapter } from "./scenes/Chapter";
import { Chart } from "./scenes/Chart";
import { Chat } from "./scenes/Chat";
import { Compare } from "./scenes/Compare";
import { Endscreen } from "./scenes/Endscreen";
import { Exercise } from "./scenes/Exercise";
import { Counter } from "./scenes/Counter";
import { DocumentScene } from "./scenes/Document";
import { Headline } from "./scenes/Headline";
import { Line } from "./scenes/Line";
import { People } from "./scenes/People";
import { PhotoScene } from "./scenes/PhotoScene";
import { Profile } from "./scenes/Profile";
import { Flow } from "./scenes/Flow";
import { Hook } from "./scenes/Hook";
import { List } from "./scenes/List";
import { Logos } from "./scenes/Logos";
import { MascotScene } from "./scenes/MascotScene";
import { Place } from "./scenes/Place";
import { Quote } from "./scenes/Quote";
import { Manga } from "./scenes/Manga";
import { Sketch } from "./scenes/Sketch";
import { Story } from "./scenes/Story";
import { Timeline as TimelineScene } from "./scenes/Timeline";
import { Tip } from "./scenes/Tip";
import { Sfx } from "./Sfx";
import { makeStage, StageProvider } from "./stage";
import { StickerLayer } from "./Stickers";
import { fontFamilyFor, paletteFor, ThemeProvider } from "./theme";

function presentation(kind: TransitionKind) {
  switch (kind) {
    case "slide-right":
      return slide({ direction: "from-right" });
    case "slide-bottom":
      return slide({ direction: "from-bottom" });
    case "fade":
      return fade();
  }
}

const SceneBody: React.FC<{ timed: TimedScene; ctx: SceneCtx }> = ({ timed, ctx }) => {
  const scene = timed.scene;
  switch (scene.template) {
    case "hook":
      return <Hook props={scene.props} ctx={ctx} />;
    case "counter":
      return <Counter props={scene.props} ctx={ctx} />;
    case "flow":
      return <Flow props={scene.props} ctx={ctx} />;
    case "chart":
      return <Chart props={scene.props} ctx={ctx} />;
    case "compare":
      return <Compare props={scene.props} ctx={ctx} />;
    case "list":
      return <List props={scene.props} ctx={ctx} />;
    case "mascot":
      return <MascotScene props={scene.props} ctx={ctx} />;
    case "story":
      return <Story props={scene.props} ctx={ctx} />;
    case "chat":
      return <Chat props={scene.props} ctx={ctx} />;
    case "tip":
      return <Tip props={scene.props} ctx={ctx} />;
    case "chapter":
      return scene.props.card ? <ChapterCard props={scene.props} ctx={ctx} /> : <Chapter props={scene.props} ctx={ctx} />;
    case "sketch":
      return <Sketch props={scene.props} ctx={ctx} />;
    case "card":
      return <Card props={scene.props} ctx={ctx} />;
    case "manga":
      // A chapter tag fills the top-left corner for its first seconds, so the place card drops below it.
      return <Manga props={scene.props} ctx={ctx} tagged={Boolean(scene.chapter)} />;
    case "timeline":
      return <TimelineScene props={scene.props} ctx={ctx} />;
    case "quote":
      return <Quote props={scene.props} ctx={ctx} />;
    case "place":
      return <Place props={scene.props} ctx={ctx} />;
    case "logos":
      return <Logos props={scene.props} ctx={ctx} />;
    case "exercise":
      return <Exercise props={scene.props} ctx={ctx} />;
    case "photo":
      return <PhotoScene props={scene.props} ctx={ctx} />;
    case "people":
      return <People props={scene.props} ctx={ctx} />;
    case "headline":
      return <Headline props={scene.props} ctx={ctx} />;
    case "document":
      return <DocumentScene props={scene.props} ctx={ctx} />;
    case "profile":
      return <Profile props={scene.props} ctx={ctx} />;
    case "line":
      return <Line props={scene.props} ctx={ctx} />;
    case "endscreen":
      return <Endscreen props={scene.props} ctx={ctx} />;
  }
};

/**
 * Slow camera move for one scene, so consecutive scenes don't all drift the same way:
 * push in, pull out, or a gentle pan left or right. [scale, x %, y %] at the start and end.
 */
const CAMERA: [number, number, number][][] = [
  [[1, 0, 0], [1.05, 0, 0]],
  [[1.05, 0.8, 0], [1.05, -0.8, 0]],
  [[1.05, 0, 0], [1, 0, 0]],
  [[1.05, -0.8, 0.3], [1.05, 0.8, -0.3]],
  [[1.01, 0, 0.5], [1.05, 0, -0.5]],
];

/** Paper scenes get bigger moves: the picture should never sit still. */
const CAMERA_PAPER: [number, number, number][][] = [
  [[1, 0, 0], [1.1, 0, -0.5]],
  [[1.09, 1.5, 0], [1.09, -1.5, 0]],
  [[1.12, 0, -0.4], [1.02, 0, 0]],
  [[1.08, -1.5, 0.4], [1.08, 1.5, -0.4]],
  [[1.03, 0, 0.6], [1.12, 0, -0.8]],
];

function cameraAt(timed: TimedScene, frame: number, portrait: boolean): string {
  // In Shorts a sketch moves its own camera inside the picture band.
  if (portrait && timed.scene.template === "sketch") return "none";
  // The end screen stays still: YouTube's elements sit on top of its spaces.
  if (timed.scene.template === "endscreen" || timed.scene.template === "card") return "none";
  // A manga page runs its own camera inside each panel.
  if (timed.scene.template === "manga") return "none";
  const moves = timed.scene.template === "sketch" ? CAMERA_PAPER : CAMERA;
  const [from, to] = moves[timed.index % moves.length] as [number, number, number][];
  const t = Easing.inOut(Easing.sin)(Math.min(1, Math.max(0, frame / Math.max(1, timed.duration))));
  const [s, x, y] = (from as number[]).map((v, i) => v + ((to as number[])[i] as number - v) * t) as [number, number, number];
  return `scale(${s}) translate(${x}%, ${y}%)`;
}

/** The name of a new chapter, written on a paper tag in the corner for a few seconds while the story carries on. */
const ChapterTag: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const u = width / 100;
  const t = Math.min(1, Math.max(0, (frame - 6) / 10));
  const out = Math.min(1, Math.max(0, (frame - 96) / 10));
  const k = Easing.out(Easing.back(1.6))(t) * (1 - out);
  if (k <= 0.01) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: 2.4 * u,
        top: 2.2 * u,
        padding: `${0.5 * u}px ${1.5 * u}px`,
        background: "#FBF6E9",
        color: "#16161A",
        border: `${0.22 * u}px solid #16161A`,
        borderRadius: 0.7 * u,
        fontFamily: handFont(),
        fontSize: 2.6 * u,
        fontWeight: 700,
        transform: `translateX(${(k - 1) * 30 * u}px) rotate(-2deg)`,
        opacity: Math.min(1, k * 2),
      }}
    >
      {title}
    </div>
  );
};

/** One scene: a slow camera move, the template, its stickers, and a whoosh as it arrives. */
const SceneView: React.FC<{ timed: TimedScene }> = ({ timed }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const ctx = toCtx(timed);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ transform: cameraAt(timed, frame, height > width) }}>
        <SceneBody timed={timed} ctx={ctx} />
      </AbsoluteFill>
      {timed.scene.chapter && height <= width && <ChapterTag title={timed.scene.chapter} />}
      {timed.scene.stickers?.length ? (
        <StickerLayer stickers={timed.scene.stickers} ctx={ctx} />
      ) : null}
      {timed.index > 0 && !isPaperScene(timed.scene) && <Sfx at={0} name="whoosh" />}
    </AbsoluteFill>
  );
};

/** Music level per frame: quieter under the voice, faded in and out at the ends. */
function musicVolume(timeline: Timeline, base: number) {
  const RAMP = 8;
  return (f: number) => {
    let speaking = 0;
    for (const s of timeline.scenes) {
      const start = s.voiceFrom;
      const end = s.voiceFrom + s.voiceFrames;
      const v = Math.min((f - (start - RAMP)) / RAMP, ((end + RAMP) - f) / RAMP);
      speaking = Math.max(speaking, Math.min(1, Math.max(0, v)));
    }
    const edges = Math.min(1, f / 20, (timeline.durationInFrames - f) / 45);
    return base * (1 - 0.65 * speaking) * Math.max(0, edges);
  };
}

/** One composition for both formats — every component reads width/height and lays itself out. */
export const Video: React.FC<RenderInput> = (input) => {
  const timeline = useMemo(() => buildTimeline(input), [input]);
  const theme = useMemo(
    () => ({
      palette: paletteFor(input.theme.palette),
      fontFamily: fontFamilyFor(input.theme.font),
      sfx: input.sfx,
    }),
    [input.theme.palette, input.theme.font, input.sfx],
  );
  const stage = useMemo(
    () => makeStage(input.plan.cast, input.logos ?? {}, input.photos ?? {}, input.plan.art),
    [input.plan.cast, input.logos, input.photos],
  );
  const timing = linearTiming({
    durationInFrames: TRANSITION_FRAMES,
    easing: Easing.inOut(Easing.cubic),
  });

  return (
    <ThemeProvider value={theme}>
      <StageProvider value={stage}>
      <AbsoluteFill
        style={{
          fontFamily: theme.fontFamily,
          color: theme.palette.text,
          backgroundColor: theme.palette.bg,
        }}
      >
        <Background seed={input.seed} timeline={timeline} />

        <TransitionSeries>
          {timeline.scenes.map((timed) => (
            <Fragment key={timed.index}>
              {timed.transitionIn && (
                <TransitionSeries.Transition
                  // Paper scenes are whole pictures: they dissolve into each other instead of sliding.
                  presentation={isPaperScene(timed.scene) ? fade() : presentation(timed.transitionIn)}
                  timing={timing}
                />
              )}
              <TransitionSeries.Sequence durationInFrames={timed.duration}>
                <SceneView timed={timed} />
              </TransitionSeries.Sequence>
            </Fragment>
          ))}
        </TransitionSeries>

        {timeline.scenes.map((timed) =>
          timed.voiceFile ? (
            <Sequence
              key={timed.index}
              from={timed.voiceFrom}
              durationInFrames={timed.voiceFrames + 2}
            >
              <Html5Audio src={staticFile(timed.voiceFile)} />
            </Sequence>
          ) : null,
        )}

        {input.music && (
          <Html5Audio
            src={staticFile(input.music)}
            loop
            loopVolumeCurveBehavior="extend"
            volume={musicVolume(timeline, input.musicVolume)}
          />
        )}

        {input.mascot && <MascotOverlay timeline={timeline} only={input.mascotCorner === "hooks" ? HOOK_SCENES : null} />}
        <Captions timeline={timeline} />
        <Chrome timeline={timeline} channelName={input.channelName} />
      </AbsoluteFill>
      </StageProvider>
    </ThemeProvider>
  );
};
