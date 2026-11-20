import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BOX, FLOOR, moveAt, moveBounds, moveDef, oneHanded } from "../../moves";
import type { ExerciseProps } from "../../schema";
import { EXERCISE_START_FRAMES, TRANSITION_FRAMES } from "../../timeline";
import { BOUNCY, clamp01, fadeUp, POP, revealTimes, type SceneCtx, SMOOTH, springAt } from "../anim";
import { Body } from "../Body";
import { handFont } from "../fonts";
import { Icon } from "../Icon";
import { INK } from "../paper/ink";
import { fitFont, useLayout } from "../layout";
import { Sfx } from "../Sfx";
import { alpha, mix, useTheme } from "../theme";

/** Seconds before the end of a follow-along when the next move is announced. */
const NEXT_SECONDS = 5;
/** Seconds the "switch sides" badge stays up. */
const SWITCH_BADGE_SECONDS = 1.8;

/** Paper look colours (the sketch scenes' ink, paper and markers). */
const PAGE = "#F4ECDC";
const YELLOW = "#FFD84A";
const RED = "#E0402F";
const GREEN = "#2FA84F";
const CARD = "#FBF6E9";
const HIGHLIGHT = "#FFE066";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * One move from the exercise library: a cast member demonstrates it in a bright room while
 * reps or seconds count up; the move's name, dose, form cues (revealed as spoken) and an easier option sit beside it.
 * With `seconds` it becomes a follow-along: a countdown bar runs and the next move is announced near the end.
 */
export const Exercise: React.FC<{ props: ExerciseProps; ctx: SceneCtx }> = ({ props, ctx }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const { portrait, u, content } = useLayout();
  const { palette } = useTheme();

  const def = moveDef(props.move);
  const ink = props.paper === true;
  // Paper scenes show no captions in landscape, so the stage can use most of the frame's height.
  const area = ink && !portrait ? { ...content, top: height * 0.07, height: height * 0.86 } : content;
  const hard = (n: number) => `${n * u}px ${n * u}px 0 ${INK}`;
  const opts = useMemo(() => ({ switchEvery: props.switchEvery }), [props.switchEvery]);
  // The figure starts moving 8 frames after the entrance (EXERCISE_START_FRAMES counts from the scene start).
  const start = ctx.enter + EXERCISE_START_FRAMES - 6;
  const seconds = Math.max(0, frame - start) / fps;
  const state = moveAt(def, seconds, opts);
  const followAlong = Boolean(props.seconds);
  const end = ctx.duration - TRANSITION_FRAMES;

  // Frames where a rep completes (a soft click on each) and where the figure switches sides.
  const { repFrames, switchFrames } = useMemo(() => {
    const reps: number[] = [];
    const switches: number[] = [];
    let last = 0;
    let side = 0;
    for (let f = start; f < ctx.duration; f++) {
      const s = moveAt(def, (f - start) / fps, opts);
      if (def.kind === "reps" && s.reps > last) reps.push(f);
      if (s.side !== side) switches.push(f);
      last = s.reps;
      side = s.side;
    }
    return { repFrames: reps, switchFrames: switches };
  }, [def, opts, start, ctx.duration, fps]);

  const cueTimes = revealTimes(
    props.cues.map((c) => c.at ?? c.text),
    ctx,
    0.75,
  );

  // ── Stage: framed on the area the figure and its props use ──
  const stageW = portrait ? area.width : area.width * 0.52;
  const stageH = portrait ? area.height * 0.74 : area.height;
  const bounds = useMemo(
    () => moveBounds(def, opts, Math.min(90, Math.max(40, props.seconds ?? 0))),
    [def, opts, props.seconds],
  );
  const view = useMemo((): [number, number, number, number] => {
    // The paper figure's head is bigger than the skeleton's, so it needs more room at the top.
    const pad = ink ? 30 : 16;
    const aspect = stageW / stageH;
    let vw = bounds[2] - bounds[0] + 2 * pad;
    let vh = bounds[3] - bounds[1] + 2 * pad;
    if (vw / vh < aspect) vw = vh * aspect;
    else vh = vw / aspect;
    // Never zoom in so far that the figure looks cropped and blocky.
    const minH = BOX.height * 0.7;
    if (vh < minH) {
      vh = minH;
      vw = vh * aspect;
    }
    const cx = (bounds[0] + bounds[2]) / 2;
    return [cx - vw / 2, bounds[3] + pad - vh, vw, vh];
  }, [bounds, stageW, stageH, ink]);
  const floorY = ((FLOOR - view[1]) / view[3]) * stageH;
  const stageIn = springAt(frame, fps, ctx.enter, SMOOTH);

  // ── Counter ──
  const counterIn = springAt(frame, fps, ctx.enter + 6, BOUNCY);
  const timer = Math.floor(state.timer);
  const counterValue = def.kind === "reps" ? String(state.reps) : clock(timer);
  const counterLabel = def.unit ?? (def.kind === "reps" ? "REPS" : def.kind === "hold" ? "HOLD" : "TIME");
  const counterSize = (portrait ? 17 : 13) * u;
  const ring = def.kind === "reps" ? state.phase : state.timer % 1;
  const ringR = counterSize / 2 - 0.5 * u;
  const lastRep = repFrames.filter((f) => f <= frame).pop();
  const bump = lastRep === undefined ? 0 : Math.max(0, 1 - (frame - lastRep) / 8);

  // ── Follow-along: countdown, switch badge, next move ──
  const left = Math.max(0, Math.ceil((end - frame) / fps));
  const progress = clamp01((frame - start) / Math.max(1, end - start));
  const barIn = springAt(frame, fps, start, SMOOTH);
  const nextAt = end - NEXT_SECONDS * fps;
  const nextIn = props.next ? springAt(frame, fps, nextAt, BOUNCY) : 0;
  const switchIn = state.sinceSwitch < SWITCH_BADGE_SECONDS
    ? Math.min(springAt(frame, fps, frame - state.sinceSwitch * fps, BOUNCY), clamp01((SWITCH_BADGE_SECONDS - state.sinceSwitch) * 4))
    : 0;
  const countdownTicks = followAlong ? [3, 2, 1].map((s) => end - s * fps).filter((f) => f > start) : [];

  // ── Text column ──
  const name = props.name ?? def.name;
  const titleAt = ctx.enter + 8;
  const title = springAt(frame, fps, titleAt, SMOOTH);
  const chipsIn = springAt(frame, fps, titleAt + 8, SMOOTH);
  const easierAt = Math.max(
    (cueTimes[cueTimes.length - 1] ?? titleAt) + 18,
    ctx.voiceStart + ctx.voiceFrames * 0.6,
  );
  const easier = springAt(frame, fps, easierAt, SMOOTH);
  const showEasier = Boolean(props.easier) && !portrait;

  const colLeft = portrait ? area.left : area.left + stageW + 4 * u;
  const colTop = portrait ? area.top + stageH + 2.6 * u : area.top;
  const colW = portrait ? area.width : area.width - stageW - 4 * u;
  const colH = portrait ? area.height - stageH - 2.6 * u : area.height;
  const nameSize = fitFont(name, (portrait ? 7 : 5.8) * u, 16, 0.65);
  const cueSize = (portrait ? 4.2 : 3.1) * u;
  const chipSize = (portrait ? 3.3 : 2.6) * u;
  // In portrait only the cue being spoken is shown, big.
  const currentCue = cueTimes.reduce((cur, t, i) => (frame >= t ? i : cur), -1);

  const chip = (icon: string, text: string, color: string) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 1 * u,
        padding: `${0.7 * u}px ${1.8 * u}px`,
        borderRadius: 999,
        background: ink ? (color === palette.positive ? "#CFEFC4" : YELLOW) : alpha(color, 0.14),
        color: ink ? INK : mix(color, "#000000", 0.25),
        border: ink ? `${0.25 * u}px solid ${INK}` : undefined,
        fontSize: chipSize,
        fontWeight: ink ? 700 : 800,
      }}
    >
      <Icon name={icon} size={chipSize * 1.1} color={ink ? INK : mix(color, "#000000", 0.25)} strokeWidth={2.6} />
      {text}
    </div>
  );

  const pill = (content: React.ReactNode, bg: string, color: string, size: number) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 1 * u,
        padding: `${0.6 * u}px ${1.8 * u}px`,
        borderRadius: ink ? 1 * u : 999,
        background: bg,
        color,
        fontSize: size,
        fontWeight: ink ? 700 : 900,
        letterSpacing: "0.04em",
        border: ink ? `${0.3 * u}px solid ${INK}` : undefined,
        boxShadow: ink ? hard(0.45) : `0 ${0.5 * u}px ${1.6 * u}px ${alpha(palette.text, 0.18)}`,
        whiteSpace: "nowrap",
      }}
    >
      {content}
    </div>
  );

  const pillSize = (portrait ? 3.2 : 2.5) * u;

  return (
    <AbsoluteFill style={ink ? { background: PAGE, fontFamily: handFont() } : undefined}>
      {/* Stage */}
      <div
        style={{
          position: "absolute",
          left: area.left,
          top: area.top,
          width: stageW,
          height: stageH,
          borderRadius: ink ? 1 * u : 3 * u,
          overflow: "hidden",
          background: ink
            ? `linear-gradient(to bottom, #F6EEDD 0px, #F6EEDD ${floorY}px, #E9CFA3 ${floorY}px)`
            : `linear-gradient(to bottom, ${palette.surface2} 0px, ${palette.surface2} ${floorY}px, #F0D3A8 ${floorY}px)`,
          boxShadow: ink ? hard(0.9) : `0 ${1.2 * u}px ${4 * u}px ${alpha(palette.text, 0.14)}`,
          border: ink ? `${0.4 * u}px solid ${INK}` : `${0.5 * u}px solid #FFFFFF`,
          opacity: clamp01(stageIn * 1.4),
          transform: `scale(${0.94 + 0.06 * stageIn})`,
        }}
      >
        <div style={{ position: "absolute", inset: 0 }}>
          <Body
            who={props.who ?? "linda"}
            pose={props.oneHand ? oneHanded(state.pose) : state.pose}
            set={def.set}
            palette={palette}
            frame={frame}
            scroll={(def.scroll ?? 0) * seconds}
            view={view}
            width={stageW}
            height={stageH}
            ink={ink}
          />
        </div>

        {/* Counter */}
        <div
          style={{
            position: "absolute",
            right: 2.4 * u,
            top: 2.4 * u,
            width: counterSize,
            height: counterSize,
            transform: `scale(${counterIn * (1 + bump * 0.12)})`,
          }}
        >
          <svg width={counterSize} height={counterSize} style={{ position: "absolute", inset: 0 }}>
            <title>{counterLabel}</title>
            <circle
              cx={counterSize / 2}
              cy={counterSize / 2}
              r={ink ? counterSize / 2 - 0.25 * u : counterSize / 2}
              fill={ink ? YELLOW : palette.text}
              stroke={ink ? INK : undefined}
              strokeWidth={ink ? 0.4 * u : 0}
            />
            <circle
              cx={counterSize / 2}
              cy={counterSize / 2}
              r={ringR}
              fill="none"
              stroke={ink ? alpha(INK, 0.12) : alpha("#FFFFFF", 0.15)}
              strokeWidth={0.8 * u}
            />
            <circle
              cx={counterSize / 2}
              cy={counterSize / 2}
              r={ringR}
              fill="none"
              stroke={ink ? RED : palette.accent2}
              strokeWidth={0.8 * u}
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * ringR * ring} ${2 * Math.PI * ringR}`}
              transform={`rotate(-90 ${counterSize / 2} ${counterSize / 2})`}
            />
          </svg>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: ink ? INK : palette.surface,
              lineHeight: 1,
            }}
          >
            <div style={{ fontSize: counterSize * (counterValue.length > 2 ? 0.3 : 0.38), fontWeight: ink ? 700 : 900 }}>
              {counterValue}
            </div>
            <div style={{ fontSize: counterSize * 0.11, fontWeight: 800, letterSpacing: "0.12em", marginTop: 0.5 * u }}>
              {counterLabel}
            </div>
          </div>
        </div>

        {/* Follow-along: "with me" and time left, then the next move */}
        {followAlong && (
          <div style={{ position: "absolute", left: 2.4 * u, top: 2.4 * u, display: "flex", flexDirection: "column", gap: 1.2 * u, alignItems: "flex-start" }}>
            <div style={{ ...fadeUp(barIn, 2 * u) }}>
              {pill(
                <>
                  <Icon name="timer" size={pillSize * 1.15} color={ink ? INK : "#FFFFFF"} strokeWidth={2.8} />
                  {`${clock(left)} LEFT`}
                </>,
                ink ? YELLOW : palette.accent,
                ink ? INK : "#FFFFFF",
                pillSize,
              )}
            </div>
            {props.next && frame >= nextAt && (
              <div style={{ transform: `translateX(${(1 - nextIn) * -40 * u}px)` }}>
                {pill(
                  <>
                    <span style={{ color: ink ? RED : palette.muted, fontWeight: 800 }}>NEXT</span>
                    {props.next}
                  </>,
                  ink ? CARD : palette.surface,
                  ink ? INK : palette.text,
                  pillSize,
                )}
              </div>
            )}
          </div>
        )}

        {/* Switch sides */}
        {switchIn > 0 && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: stageH * 0.42,
              display: "flex",
              justifyContent: "center",
              transform: `scale(${switchIn})${ink ? " rotate(-3deg)" : ""}`,
              opacity: clamp01(switchIn * 1.5),
            }}
          >
            {pill(
              <>
                <Icon name="arrow-left-right" size={pillSize * 1.5} color={ink ? INK : palette.text} strokeWidth={2.8} />
                Switch sides
              </>,
              ink ? YELLOW : palette.accent2,
              ink ? INK : palette.text,
              pillSize * 1.35,
            )}
          </div>
        )}

        {/* Countdown bar */}
        {followAlong && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: (ink ? 1.8 : 1.4) * u,
              background: ink ? CARD : alpha(palette.text, 0.12),
              borderTop: ink ? `${0.35 * u}px solid ${INK}` : undefined,
              opacity: barIn,
            }}
          >
            <div
              style={{
                width: `${(1 - progress) * 100}%`,
                height: "100%",
                background: ink ? RED : `linear-gradient(to right, ${palette.accent2}, ${palette.accent})`,
              }}
            />
          </div>
        )}
      </div>

      {/* Text column */}
      <div
        style={{
          position: "absolute",
          left: colLeft,
          top: colTop,
          width: colW,
          height: colH,
          display: "flex",
          flexDirection: "column",
          justifyContent: portrait ? "flex-start" : "center",
          alignItems: portrait ? "center" : "flex-start",
          textAlign: portrait ? "center" : "left",
          gap: (portrait ? 1.6 : 2.2) * u,
        }}
      >
        {!portrait && (props.number !== undefined || followAlong) && (
          <div style={{ display: "flex", alignItems: "center", gap: 1.4 * u, ...fadeUp(title, 2 * u) }}>
            <div
              style={
                ink
                  ? { color: RED, fontSize: 3.4 * u, fontWeight: 700, letterSpacing: "0.06em", borderBottom: `${0.35 * u}px solid ${RED}`, transform: "rotate(-2deg)" }
                  : {
                      padding: `${0.7 * u}px ${2 * u}px`,
                      borderRadius: 999,
                      background: followAlong ? palette.accent : palette.text,
                      color: palette.surface,
                      fontSize: 2.6 * u,
                      fontWeight: 900,
                      letterSpacing: "0.08em",
                    }
              }
            >
              {followAlong ? "DO IT WITH ME" : "MOVE"}
            </div>
            {props.number !== undefined && (
              <div
                style={{
                  width: 8 * u,
                  height: 8 * u,
                  borderRadius: "50%",
                  background: ink ? YELLOW : followAlong ? palette.text : palette.accent,
                  color: ink ? INK : "#FFFFFF",
                  border: ink ? `${0.35 * u}px solid ${INK}` : undefined,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 4.6 * u,
                  fontWeight: ink ? 700 : 900,
                  boxShadow: ink ? hard(0.4) : `0 ${0.7 * u}px 0 ${mix(followAlong ? palette.text : palette.accent, "#000000", 0.25)}`,
                }}
              >
                {props.number}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            fontSize: nameSize * (ink ? 1.12 : 1),
            fontWeight: ink ? 700 : 900,
            lineHeight: 1.05,
            letterSpacing: ink ? "0" : "-0.015em",
            color: ink ? INK : undefined,
            ...fadeUp(title, 3 * u),
          }}
        >
          {portrait && props.number !== undefined ? `${props.number}. ${name}` : name}
        </div>

        {(props.dose || props.works) && (
          <div style={{ display: "flex", gap: 1.2 * u, flexWrap: "wrap", justifyContent: portrait ? "center" : "flex-start", ...fadeUp(chipsIn, 2 * u) }}>
            {props.dose && chip(def.kind === "reps" ? "repeat" : "timer", props.dose, palette.accent)}
            {props.works && chip("dumbbell", props.works, palette.positive)}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 1.2 * u, width: "100%", marginTop: 0.6 * u }}>
          {props.cues.map((cue, i) => {
            if (portrait && i !== currentCue) return null;
            const at = cueTimes[i] ?? 0;
            const s = springAt(frame, fps, at, POP);
            const next = cueTimes[i + 1];
            const current = frame >= at && (next === undefined || frame < next);
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: cues are positional
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.6 * u,
                  padding: `${1.1 * u}px ${1.8 * u}px`,
                  borderRadius: 1.8 * u,
                  background: ink ? "transparent" : current ? palette.surface : alpha(palette.surface, 0.55),
                  borderLeft: ink ? undefined : `${0.6 * u}px solid ${current ? palette.accent : "transparent"}`,
                  boxShadow: ink ? "none" : current ? `0 ${0.8 * u}px ${3 * u}px ${alpha(palette.accent, 0.2)}` : "none",
                  opacity: clamp01(s * 1.4),
                  transform: `translateX(${(1 - s) * -6 * u}px)`,
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    flex: "none",
                    width: cueSize * 1.5,
                    height: cueSize * 1.5,
                    borderRadius: ink ? 0.5 * u : "50%",
                    background: ink ? CARD : current ? palette.accent : alpha(palette.accent, 0.18),
                    border: ink ? `${0.3 * u}px solid ${INK}` : undefined,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="check" size={cueSize * 0.9} color={ink ? (current ? RED : INK) : current ? "#FFFFFF" : palette.accent} strokeWidth={3} />
                </div>
                <div
                  style={{
                    fontSize: cueSize * (ink ? 1.08 : 1),
                    fontWeight: ink ? 700 : 800,
                    lineHeight: 1.2,
                    color: ink ? INK : undefined,
                    padding: ink ? `0 ${0.6 * u}px` : undefined,
                    background: ink && current ? `linear-gradient(to bottom, transparent 18%, ${HIGHLIGHT} 18%, ${HIGHLIGHT} 88%, transparent 88%)` : undefined,
                  }}
                >
                  {cue.text}
                </div>
              </div>
            );
          })}
        </div>

        {showEasier && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 1.4 * u,
              padding: `${1 * u}px ${1.8 * u}px`,
              borderRadius: 1.8 * u,
              border: ink ? `${0.3 * u}px dashed ${INK}` : `${0.3 * u}px dashed ${alpha(palette.positive, 0.6)}`,
              background: ink ? "#E6F5DF" : alpha(palette.positive, 0.08),
              ...fadeUp(easier, 2 * u),
            }}
          >
            <div
              style={{
                flex: "none",
                padding: `${0.5 * u}px ${1.4 * u}px`,
                borderRadius: 999,
                background: ink ? GREEN : palette.positive,
                color: "#FFFFFF",
                fontSize: 2.2 * u,
                fontWeight: 900,
                letterSpacing: "0.08em",
              }}
            >
              EASIER
            </div>
            <div style={{ fontSize: 2.8 * u * (ink ? 1.08 : 1), fontWeight: 700, color: ink ? INK : palette.muted, lineHeight: 1.3 }}>{props.easier}</div>
          </div>
        )}
      </div>

      <Sfx at={titleAt} name="ding" />
      {cueTimes.map((t, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: one sound per cue
        <Sfx key={i} at={t} name="pop" />
      ))}
      {repFrames.map((f) => (
        <Sfx key={f} at={f} name="click" volume={0.5} />
      ))}
      {switchFrames.map((f) => (
        <Sfx key={`s${f}`} at={f} name="sparkle" volume={0.6} />
      ))}
      {props.next && <Sfx at={nextAt} name="notify" volume={0.6} />}
      {countdownTicks.map((f) => (
        <Sfx key={`t${f}`} at={f} name="pop" volume={0.7} />
      ))}
      {followAlong && <Sfx at={end - 2} name="ding" />}
      {showEasier && <Sfx at={easierAt} name="click" volume={0.6} />}
    </AbsoluteFill>
  );
};
