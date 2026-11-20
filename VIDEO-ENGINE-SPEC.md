# Video engine: build specification

This document describes a working system that turns a JSON scene plan into narrated, animated YouTube videos. It renders a 16:9 long video, a 9:16 Short, thumbnails, captions and an upload checklist from one plan.

**How to use this file.** Give it to Claude Code in an empty folder and say: "Build this engine. Follow the build order in section 15 and run the acceptance test after each phase." Claude writes all the code. The result will behave the same as the original. The drawings will differ, because the original's hand-coded SVG art (about 3,000 lines) is described here by list, not copied.

Written 16/11/2026 from the working codebase (about 21,000 lines of TypeScript).

---

## 1. What it does

Input: one folder containing `plan.json`. The plan lists scenes. Each scene has a template name, one narration sentence or two, and props that say what to draw.

Output, in the same folder:

| File | What |
|---|---|
| `voice.json`, `media/voice/NN.wav` | One narration clip per scene, plus length, loudness per frame and word timings |
| `long.mp4` | 1920×1080, 30 fps, H.264 CRF 18, audio at -14 LUFS |
| `short.mp4` | 1080×1920, same settings, made from the scenes marked for the Short |
| `stills/*.png` | One frame per scene, for layout checks before a full render |
| `upload/` | `UPLOAD.md`, `title.txt`, `description.txt`, `captions.srt`, `pinned-comment.txt`, `short-title.txt`, `short-description.txt`, `thumbnail-1.jpg` to `thumbnail-3.jpg` |

Running cost is zero. Voice is a local model. Rendering is local. The only outside service is an image generator for the cartoon art (section 10).

Division of work: Claude researches, writes the plan, runs every command and checks the stills. The human reviews the video and presses Publish.

## 2. Stack and prerequisites

- Node 22+, npm workspaces, TypeScript (ES modules, run through `tsx`, no build step)
- ffmpeg on the PATH
- Google Chrome installed (rendering fallback and the upload helper)
- Python 3 with numpy (only for generating music loops)
- macOS 14+ for the bundled cut-out tool (Apple Vision). On Windows or Linux, replace it with `rembg` or any background remover that outputs a transparent PNG and a bounding box.

Packages:

| Package | Dependencies |
|---|---|
| `@yt/templates` | `remotion`, `@remotion/bundler`, `@remotion/renderer`, `@remotion/transitions`, `@remotion/google-fonts`, `@remotion/cli` (all pinned to one exact 4.x version), `react`, `react-dom`, `zod`, `lucide-react` |
| `@yt/core` | `kokoro-js`, `yaml`, `zod`, `simple-icons`, `better-sqlite3` |
| `@yt/cli` | `commander`, `picocolors`, `playwright-core`, `tsx` |
| root dev | `typescript`, `vitest`, `@biomejs/biome` |

First voice run downloads the Kokoro model (about 90 MB). First render downloads Chrome Headless Shell (about 140 MB).

## 3. Repository layout

```
package.json                 workspaces: packages/*
packages/
  templates/                 everything visual; safe to bundle for the browser
    src/schema.ts            zod schema for plan.json and voice.json
    src/timeline.ts          scenes + voice lengths → frame positions, chapters
    src/words.ts             word-timing estimator
    src/paper.ts             lists: sets, prop kinds, faces, acts, tones (pure data)
    src/constants.ts         FPS = 30; long 1920×1080; short 1080×1920
    src/render.ts            bundle, renderVideo (chunked), renderStills, renderThumbnails
    src/remotion/            Root.tsx, Video.tsx, Captions, Overlays, Thumbnail, anim.ts, fonts.ts
    src/remotion/scenes/     one component per template (Sketch.tsx is the main one)
    src/remotion/paper/      Figure, Props, Sets, camera.ts, ink.tsx (hand lettering, cue lookup)
    scripts/                 make-sfx.sh, make-music.py, make-news-music.py
    sfx/                     pop, whoosh, ding, notify, click, boom, sparkle (.wav)
  core/                      Node side
    src/config.ts            channel.yaml schema and loader
    src/voice.ts             Kokoro text-to-speech
    src/audio.ts             decode, loudness envelope, voiced range
    src/produce.ts           voicePlan, buildRenderInput, prepareVideoMedia
    src/loudness.ts          two-pass loudnorm
    src/kit.ts               upload kit: checks, description, captions, UPLOAD.md
    src/schedule.ts          publish-slot booking
    src/assets.ts            emoji download, sfx and music copy
    scripts/photo-tool.swift cut-out + face boxes (Apple Vision)
  cli/
    src/index.ts             channel, topics, status commands
    src/produce.ts           voice, render, kit, studio, demo commands
    src/upload.ts            fills YouTube Studio's upload dialog
channels/<id>/               channel.yaml, prompts/script.md, assets/music/   (committed)
data/<channel>/              videos/, art/, research/, schedule.json           (gitignored)
data/cache/                  emoji cache, compiled tools
secrets/                     Chrome profile for uploads                        (gitignored)
```

## 4. Commands

```
yt channel add <id> --name "<name>"      new channel from a template folder
yt channel check                          validate every channel.yaml
yt voice <folder>                         record narration for changed scenes only
yt render <folder> -f long|short|both     voice if needed → bundle → thumbnails → render → loudness → kit
yt render <folder> --stills               one PNG per scene, no video
yt render <folder> --stills 120,480       named frames only
yt render <folder> --browser chrome       use installed Google Chrome
yt kit <folder> [--no-thumbnails]         rebuild upload/ without rendering video
yt studio <folder>                        Remotion Studio preview
yt upload <folder> -f long|short|both     fill YouTube Studio's dialog, stop before publishing
```

`<folder>` resolves against the current directory, then the repo root. It must contain `plan.json`.

## 5. Channel config (`channels/<id>/channel.yaml`)

Validated with zod (strict objects) every time the CLI runs.

```yaml
id: my-channel               # must match the folder name
name: "Channel Name"
language: en
audience: "who watches"
tone: "clear, fast, no hype"
formats: [long, shorts]
voice: { provider: kokoro, id: af_heart, speed: 1.0 }
theme: { palette: daylight, font: Montserrat }
mascot: robot                # optional
mascot_corner: hooks         # always | hooks
sound: { sfx: true, music_volume: 0.15 }
templates: [sketch, card, chart, endscreen]
schedule: { long_per_week: 3, shorts_per_day: 1 }
youtube:
  verified: true             # false blocks videos over 15 minutes
  category: Science & Technology
  tags: [business, technology]
  short_min_seconds: 30
  short_max_seconds: 50
  publish: { days: [tue, thu, sat], time: "15:00", timezone: America/New_York }
```

Music: any `.mp3/.m4a/.wav/.ogg` in `channels/<id>/assets/music/`. One track is picked per video by a seed hashed from the title, so the same video always gets the same track.

## 6. The plan (`plan.json`)

Top level (zod strict object, `version: 1`):

| Field | Meaning |
|---|---|
| `channel`, `title`, `summary` | Channel id; working title; first lines of the description |
| `voice` | Optional override: `{ id, speed (0.6–1.6), trim }`. `trim: true` cuts silence at both ends of every clip |
| `art` | Up to 300 illustrations: `{ id, file: "art/<id>.png", width, height, box? }`. `box` is the cut-out's extent as fractions `{x,y,w,h}` |
| `cast` | Optional extra code-drawn characters (colours, hair) |
| `sources` | `{ label, url }` list, printed in the description |
| `scenes` | 1 to 1,000 scenes |
| `upload` | `titles` (1–3, max 100 chars), `thumbnails` (1–3), `tags`, `hashtags` (max 3), `question`, `keyFigures`, `figuresAsOf`, `playlist`, `short: { title, description }` |

Every scene:

```json
{
  "template": "sketch",
  "narration": "One or two sentences. Max 600 characters.",
  "props": { },
  "chapter": "Optional: starts a YouTube chapter here",
  "short": "also"
}
```

`short`: `"also"` puts the scene in both videos. `"only"` puts it in the Short only. If no scene is marked, the Short uses every scene. An `endscreen` scene must be last and never appears in the Short.

### 6.1 Templates

The original has 26 templates. Build `sketch` first: it carries whole videos on its own. Then `endscreen`, `card`, `chart`. Add the rest only when a video needs them.

| Template | Shows |
|---|---|
| `sketch` | A cartoon scene: backdrop, characters, props, hand-written labels, automatic camera. Section 8 |
| `endscreen` | Last 20 seconds with empty spaces for YouTube's end-screen elements (minimum 600 frames) |
| `card` | Black card with one hand-written line. Stays long enough to read: `30 + 1.6 × characters` frames |
| `chapter` | Chapter page: number, title, year |
| `hook`, `counter`, `flow`, `chart`, `compare`, `list`, `timeline`, `logos`, `line` | Title, count-up number, step diagram, bar chart, two-sided comparison, list, dated line, logo grid, line chart |
| `quote`, `headline`, `document`, `profile` | Sourced quote, newspaper clipping, statement page, case file |
| `story`, `chat`, `tip`, `place`, `mascot` | Code-drawn character scenes, phone chat, numbered tip |
| `photo`, `people` | Real photos from Wikimedia Commons with credits |
| `exercise` | A figure doing a move from a fixed library, with rep counter |
| `manga` | One to three comic panels with cut-outs, bubbles, sound-effect words |

### 6.2 Sketch props

Coordinates are percent of a 16:9 frame. `x` is the centre. `y` is the feet (actors) or the bottom edge (props).

```json
{
  "set": "plain",
  "backdrop": "bg-office",
  "floor": 91,
  "actors": [
    { "who": "maya", "art": "host-pointing", "x": 22, "scale": 0.9, "flip": false, "talking": true,
      "at": "optional cue", "enter": "walk|pop|drop|none",
      "to": { "x": 60, "at": "cue" },
      "tag": "Name label", "say": "Bubble text", "sayAt": "cue", "think": false,
      "beats": [ { "at": "cue", "art": "host-shocked" } ] }
  ],
  "props": [
    { "kind": "banner", "text": "REAL CASH", "x": 62, "y": 20, "scale": 1.2, "tone": "positive", "at": "cash" },
    { "kind": "number", "value": 40, "text2": "%", "x": 30, "y": 56, "tone": "negative", "at": "40" },
    { "kind": "chart", "values": [9, 8, 7, 6], "text": "HIRING", "x": 66, "y": 86, "scale": 1.3, "at": "dropped" },
    { "kind": "picture", "art": "obj-drone", "x": 70, "y": 62, "scale": 0.8, "at": "robots", "until": "cue" }
  ],
  "fx": [ { "kind": "zoom|shake|flash|rain|confetti", "at": "cue" } ],
  "title": { "text": "WHITE WORDS", "text2": "RED WORDS", "at": "cue" },
  "focus": 50,
  "camera": "auto"
}
```

Limits: 6 actors, 10 props, 4 fx, 4 beats per actor. Text max 60 characters (`text2` 40). Tones: neutral, positive, negative, accent, dark. Prop entrances: pop, drop, slide, fade, none. Omit empty strings: the schema rejects `""`.

Prop kinds in the original: crate, sign, banner, chip, money, coins, moneybag, bell, balloon, bubble, stopwatch, calendar, paper, server, desk, podium, screen, chart, bars, phone, laptop, vault, rocket, bomb, scale, building, datacenter, truck, cloud, logo, arrow, text, number, door, briefcase, trophy, fire, brain, robot, pie, bolt, ticker, chair, plant, gavel, crowd, tag, plane, books, globe, dial, thumb, stars, mirror, picture. Start with `banner`, `number`, `chart`, `picture`, `text`, `arrow`, `calendar`, `money`.

## 7. Timing

All of this is in `timeline.ts`. It must be pure and shared by the renderer and the Node side.

Constants (frames at 30 fps): transition 12, lead-in before the first voice 8, pad after a voice 9 (4 for sketch, card and manga scenes), end hold 36.

Minimum scene length by template: sketch 36, card 30, hook 75, counter 105, chart 120, endscreen 600, most others 120–150.

```
body     = max(minimum[template], voiceFrames + pad, readingFrames, followAlongFrames)
duration = (index == 0 ? 8 : 0) + body + (last ? 36 : 12)
next.from = from + duration - 12          # scenes overlap by the transition
voiceFrom = from + lead
total     = lastFrom + lastDuration
```

Transitions come from a seeded PRNG (mulberry32, seed = first 8 hex digits of sha1(title)), never the same twice in a row. Sketch, card and manga scenes always cross-fade.

Chapters: every scene with a `chapter` label (or a `chapter` template) gives a mark at `floor((from + 12) / 30)` seconds. If the first mark is under 10 s it moves to 0:00; otherwise an "Intro" mark is added at 0:00. Chapter lines go into the description only when there are at least 3 marks and each chapter is at least 10 s.

### 7.1 Voice

Per scene: `sha1(JSON([narration, provider, voiceId, speed, "trim"?]))` truncated to 16 hex is the cache key. A scene is re-recorded only when its key, file name or file is missing. Progress is written after each scene, so an interrupted run resumes.

1. Kokoro (`onnx-community/Kokoro-82M-v1.0-ONNX`, dtype q8, CPU) writes `media/voice/NN.wav`. Before speaking, replace `…` with `...` and spaced dashes with a comma.
2. With `trim`, ffmpeg removes silence at both ends: `silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-42dB:start_silence=0.05,areverse`.
3. Decode to mono 16 kHz float. Loudness envelope: RMS per video frame, divided by the 95th percentile, values under 0.08 set to 0, raised to the power 0.8, smoothed (attack 0.7/0.3, release 0.45/0.55), rounded to 2 decimals. It drives talking mouths.
4. Voiced range: first and last frame with envelope above 0.1.
5. Word timings are estimated, not aligned. Each word gets a weight: syllable count (vowel groups, minus a silent final e) plus 0.35; digit strings weigh 1.25 per digit. A pause weight follows punctuation: 1.6 after `.!?`, 0.8 after `,;:`. Spread the voiced range across the weights in proportion. Accuracy is a few hundred milliseconds on one-sentence scenes. This is why scenes should stay short.

Measured pace: voice `af_heart` at speed 1.3 with trim gives about 200 words per minute. 1,683 words produced 8:20.

### 7.2 Cues (`at`)

An `at` value is one or two words from the scene's narration. Lookup (`wordFrame`):

- Normalise both sides to lowercase letters and digits.
- Match the first narration word that equals the cue's first word, or starts with it when the cue word has 3+ characters.
- If the cue has a second word, the next narration word must match it the same way.
- Result: the word's start minus 2 frames, never before the scene's entrance. No match: the fallback (usually the entrance).

Numbers match as written in the narration: narration "40 percent" → cue `"40"`.

## 8. The sketch scene

Scene space is 1920×1080, drawn as one SVG whose `viewBox` is the camera view.

Draw order: backdrop → props behind → actors sorted by `y` → props with `front` → lighting gradient → written props (text, number, arrow, banner, tag; they stay bright) → fx overlays → speech bubbles → title.

- **Backdrop**: the image is drawn 6% oversized and shifted by 9% of the camera offset. That gives parallax against the figures.
- **Cut-out actor**: cropped to its `box`, 640 scene units tall at scale 1, standing on the floor line, with a soft shadow. It breathes (±1.2% height), tilts ±0.7°, hops while walking and bounces with the voice envelope when `talking`. A beat that changes `art` swaps the picture with a small squash spring.
- **Entrances**: `walk` comes from the nearest edge. `pop` and `drop` use springs. Actors with no cue settle in with a small grow spring, staggered 3 frames apart.
- **Props**: every prop that is not furniture bobs ±5 px and sways about 1°, so nothing sits still. `until` fades a prop out over 8 frames.
- **Number** props count up to `value`. **Chart** props draw their line as they appear.
- **fx**: `shake` decays over 16 frames. `zoom` is a 16% punch-in that stays. `flash` is a white frame fading over 9 frames. `rain` and `confetti` loop falling particles.
- **Sound**: the first three cued props play `pop` (bell → `ding`, bomb/bolt → `boom`). `shake` and `zoom` play `boom`, `flash` plays `ding`.
- **Springs**: POP `{damping 12, stiffness 170, mass 0.6}`, SMOOTH `{damping 200}`, BOUNCY `{damping 9, stiffness 160, mass 0.7}`.
- **Lettering**: Kalam (Google Fonts) 400/700 for all hand-written text.

### 8.1 Automatic camera

The plan never describes camera moves. `camera.ts` derives them.

1. Cut the scene into shots of about 46 frames: `n = round(duration / 46)`.
2. Build targets. Each actor: framed waist-up, zoom between 1.25 and 2.1 (wider when it has a bubble). Each prop: zoom `1.95 / sqrt(scale)` clamped to 1.3–2.1. Written props are targets only when cued, with a gentle 1.3 lean towards them. Furniture is a target only when cued.
3. On backdrop scenes multiply every zoom-in by 0.28: `z = 1 + (z - 1) × 0.28`. The art is detailed and labels must stay in frame.
4. Per shot: a target that appeared since the last cut gets the shot. Otherwise two shots in three go to a rotating target not used in the last two shots; the third is the wide view.
5. Inside a shot the camera drifts 7% in or out. Between shots it flies with a spring `{damping 19, stiffness 210, mass 0.7}`, or cuts when jumping between two close-ups on odd shots.
6. Clamp the view to the scene.

`camera: "still"` turns targets off. On top of this, each landscape sketch scene gets a slow whole-frame move (scale 1.0–1.12, pan ±1.5%), picked by scene index from five presets.

### 8.2 Shorts

One composition serves both formats; components read width and height. In portrait a sketch is a band: top at 20% of the height, 50% tall, showing a window of the scene centred on `focus`. The scene `title` is written above the band and stays put between scenes. Captions sit below. The rest is near-black (`#0B0B0E`). A full-height vertical layout was planned and not built.

## 9. Composition, audio and render

`Video.tsx`: shared background → `TransitionSeries` of scenes → one audio `Sequence` per scene voice at `voiceFrom` → looping music → captions → channel badge.

- **Music level** per frame: `base × (1 − 0.65 × speaking)`, where `speaking` ramps over 8 frames around each voice. Fade in over 20 frames and out over 45.
- **Captions**: break at punctuation and pauses over 8 frames, then split into near-equal lines of at most N words. The current word is highlighted. Landscape sketch scenes show no captions; Shorts always do.
- **Compositions**: `long`, `short`, `thumbnail-1..3` (1280×720). `calculateMetadata` filters scenes for the format and sets the duration from the timeline.

Render (`render.ts`):

- Bundle once per run with the video's `media/` folder as Remotion's public dir.
- Up to 2 minutes: one `renderMedia` call, `h264`, CRF 18.
- Longer: chunks of 1,800 frames as `h264-ts` with audio separated per chunk (use Remotion's AAC-concatenation flag and `enforceAudioTrack`), then `combineChunks`. A `state.json` in `.chunks/<format>/` records finished chunks under a key hashed from the props, the format, the chunk size and the bundle. Re-running skips finished chunks.
- If Remotion's headless Chrome crashes ("Target closed"), retry once with installed Google Chrome (`chromeMode: "chrome-for-testing"`) and keep it for the run.
- After each video: two-pass ffmpeg `loudnorm` to I=-14, TP=-1.5, LRA=11. Copy the video stream, re-encode audio as AAC 192k 48 kHz, `+faststart`. Skip when already within 0.5 LU.
- Short length gate: skip the Short with a warning when it falls outside the channel's `short_min_seconds`–`short_max_seconds`.
- Stills: default frame per scene is `from + duration − 16` (the last scene: `− 10`), so everything cued is on screen.
- Write `.render-<format>.json` with a hash of the inputs, so the kit can tell when an mp4 is stale.

Measured on an Apple Silicon laptop: an 8:20 long video rendered in 25:34; a 0:43 Short in 2:13.

Sound effects are synthesised with ffmpeg `aevalsrc` formulas (no samples). Music loops are synthesised with numpy: 32-bar loops at 96 or 104 BPM, four 8-bar sections that build.

## 10. Art pipeline

The look: flat 2D vector cartoon, even dark outline, flat colours. Characters have a large round head, dot eyes, a bean-shaped torso and thin stick legs. Rooms are detailed flat stage sets.

Any image generator works. The original calls an image tool from Claude (Figma's `generate_image` connector). Rules that held up:

- **Characters and objects**: 1024×1024, pure white background, full body, one subject. Prompt opener: "Flat 2D vector cartoon character, very large round head about 40 percent of the total height, dot eyes, bean-shaped torso, two thin straight black stick legs, even dark brown outline, flat colours, pure white background, full body". Repeat the full clothing description in every pose prompt to keep one person consistent.
- **Backgrounds**: ask for 16:9 (1536×864 is enough), "no people, open floor in the foreground". Do not run the cut-out tool on backgrounds.
- **Library**: `data/<channel>/art/raw/` (originals), `art/lib/` (cut-outs), `art/index.json` (array of `ArtSource` entries).
- **Cut-out**: `photo-tool <in.png> <out.png>` writes a transparent PNG and prints JSON with `width`, `height` and `subject` box. Store the box rounded to 4 decimals. Compile once: `swiftc -O photo-tool.swift -o data/cache/bin/photo-tool`.
- **Per video**: the plan generator copies each used file to `<video>/media/art/` and lists it in `plan.art`.
- Record which way each character faces in the source image. Set `flip` so characters face the middle of the frame.
- After a full disk, check for 0-byte downloads.
- Do not generate likenesses of real people. Use a neutral cast or a silhouette.

One pose per emotion is enough: neutral, shocked, thinking, pointing. A cast of 15–20 cut-outs, 10 objects and 12 rooms covers most business stories and is reused across videos.

## 11. Upload kit (`kit.ts`)

`UPLOAD.md` opens with checks. `fail` blocks the upload.

| Check | Rule |
|---|---|
| Renders | `long.mp4` / `short.mp4` exist and match the current plan, voice and channel config |
| Titles | 1–3, each ≤ 100 characters |
| Description | ≤ 5,000 bytes. Overflow sources move to the pinned comment |
| Pinned comment | ≤ 10,000 characters |
| Tags | Video tags + channel tags ≤ 500 characters |
| Thumbnails | Each < 2 MB (JPEG quality 90) |
| Length | Over 15 minutes needs `youtube.verified: true` |
| Short | Within the channel's range |
| Leftovers | No `[CHECK]` marks in the plan; no working-title channel name |

`description.txt`, in this order: summary, key figures, the question, "Chapters" with the chapter lines, the "figures as of" line, "Sources", photo credits, hashtags. `captions.srt`: the narration in cues of at most 42 characters, timed from the same word timings. The rest of `UPLOAD.md` walks through YouTube Studio's form in its own order (Details, Video elements, Checks, Visibility), then the Short.

Publish slots are booked in `data/<channel>/schedule.json`: the long video takes the next configured publishing day after those already booked, and the Short takes the following day.

Thumbnail spec: 2–5 words in capitals, an optional highlighted part, and a whole `sketch` scene as the picture with the words across the top.

## 12. Upload helper (`yt upload`)

It prepares the upload. It never publishes.

1. Start Google Chrome as a normal browser with `--remote-debugging-port=9333 --user-data-dir=secrets/chrome-profile`. The human signs in to Google once; the profile keeps the session.
2. Connect with `playwright-core` `chromium.connectOverCDP`. If Chrome is running with no window, open one through `PUT /json/new` first.
3. Per video: open `youtube.com/upload` in a new tab. Set the file with CDP `DOM.setFileInputFiles` and the local path (Playwright refuses to transfer files over 50 MB).
4. Fill title, description, thumbnail, "not made for kids" and tags. Each step is wrapped: a failed selector prints "do this by hand" and the rest continue.
5. Click the Visibility tab and stop. Print what is left for the human: visibility, playlist, subtitles, end screen, related video.
6. Detach without closing Chrome, so uploads keep running.

YouTube changes its selectors; expect to maintain them. Do not automate the Publish click, comments, likes or views.

## 13. How Claude makes a video

1. **Research.** Search the news or the topic. Write a fact sheet in `data/<channel>/research/<slug>.md` with two lists: checked today (with source) and from memory (unchecked). Only checked facts are stated as fact.
2. **Plan.** Write a Python generator, not raw JSON. Helpers keep 90 scenes consistent. Example helpers: `A(art, x, **kw)` actor with auto-flip; `B(text, x, y, at, tone)` banner that scales with text length and clamps `x` to the frame; `P(art, x, y, scale, at)` picture; `NUM(...)`, `CH(...)`; `S(narration, bg, actors, props, fx, short, chapter)` scene. The generator asserts on banned words, counts total and Short words, copies art to `media/art/` and writes `plan.json`.
3. **Voice.** `yt voice <folder>`.
4. **Stills.** `yt render <folder> --stills -f long`, tile them into contact sheets (`ffmpeg -pattern_type glob -i 'long-*.png' -vf "scale=480:-1,tile=4x6:padding=4"`), look at every sheet and fix the generator. Repeat for the Short.
5. **Render.** `yt render <folder> -f both --browser chrome`.
6. **Kit and upload.** Read `UPLOAD.md` for failed checks. Run `yt upload`. The human sets visibility and saves.

Script rules that the pipeline depends on:

- One sentence per scene, two at most. Word timings and the 46-frame camera both assume short scenes.
- A picture change every 1–2 seconds: put 2–4 cued props in every scene.
- 200 words per minute at speed 1.3. An 8-minute video is about 1,650 words and 90 scenes.
- Short: 3–6 scenes marked `"short": "also"`, 100–160 words for 30–50 seconds. Hook in the first sentence, payoff in the last.
- Mark a `chapter` label every 40–60 seconds. End with a 20-second `endscreen`.
- Numbers in the narration are written the way the cue will match them.
- Quotes from real people are exact and sourced. Everything else about living people is attributed.

## 14. Known problems and fixes

| Problem | Fix |
|---|---|
| Long banner text shrinks to fit and becomes unreadable | Scale banners by length: `scale = min(1.9, base × max(1, len/15))`, then clamp `x` so the banner stays inside the frame |
| Number prop with empty `text` or `text2` fails validation | Omit empty fields |
| A number and a word glued together ("2,200MICE") | Use a number prop and a separate banner |
| A cue never fires | The word is not in that scene's narration, or it is spelled differently. Cues fall back to the scene start without an error. Add a generator check that every cue matches |
| A character faces out of frame | Record source direction per art id and derive `flip` from `x` |
| Close-ups cut off labels on backdrop scenes | The 0.28 zoom softening in section 8.1 |
| An angry-looking pose used in a neutral scene | Keep a neutral pose per character and default to it |
| Wrong room for the story | Generate a new background; the eye catches a mismatched room at once |
| Headless Chrome crashes mid-render | `--browser chrome`; chunks make the re-run cheap |
| Remotion Studio edits write into source files | Use Studio to watch only; change the plan instead |
| Shell tools that block inline HTTP | Put downloads in a script file run by node |

Not built in the original: full-height vertical layout for Shorts, split-screen panels, whip-pan transitions, forced alignment of word timings (whisper.cpp was planned), an automatic check that the camera keeps cued text in frame.

## 15. Build order

Run the acceptance test before starting the next phase.

| Phase | Build | Acceptance test |
|---|---|---|
| 1 | Workspace, `schema.ts` (Plan with `sketch` only), `config.ts`, `yt channel check` | An invalid plan prints the path and message of each problem |
| 2 | `voice.ts`, `audio.ts`, `words.ts`, `voicePlan`, `yt voice` | A 3-scene plan gives 3 wav files and a `voice.json`; a second run reports all unchanged |
| 3 | `timeline.ts` with unit tests | Durations, overlaps and chapter marks match section 7 on a fixed input |
| 4 | Remotion root, `Video.tsx`, `Sketch.tsx` with backdrop, cut-out actors, `banner`, `number`, `picture`, cues | `yt render --stills` shows every cued item in place |
| 5 | `camera.ts`, fx, sound effects, music ducking | A 30-second render changes framing every 1–2 seconds and voices never overlap |
| 6 | Chunked render, Chrome fallback, loudness pass | A 3-minute render resumes after being interrupted; output measures -14 LUFS ±0.5 |
| 7 | Portrait layout, captions, `short` filtering and length gate | `short.mp4` is 1080×1920 and inside the channel's range |
| 8 | Thumbnail compositions, `kit.ts`, schedule | `UPLOAD.md` lists every check; an oversized description fails |
| 9 | Art library scripts and the cut-out tool | A generated character appears in a still, cropped to its box, standing on the floor line |
| 10 | `yt upload` | Both dialogs are filled and waiting at Visibility; nothing is published |
| 11 | More templates as needed (`card`, `chart`, `endscreen` first) | Each has a still and a schema test |

## 16. Minimal plan for a first test

```json
{
  "version": 1,
  "channel": "my-channel",
  "title": "Engine Test",
  "voice": { "id": "af_heart", "speed": 1.3, "trim": true },
  "art": [
    { "id": "bg-office", "file": "art/bg-office.png", "width": 1536, "height": 864 },
    { "id": "host-pointing", "file": "art/host-pointing.png", "width": 1024, "height": 1024,
      "box": { "x": 0.26, "y": 0.01, "w": 0.41, "h": 0.97 } }
  ],
  "scenes": [
    { "template": "sketch", "short": "also", "chapter": "The Test",
      "narration": "Almost 40 percent of jobs are exposed to AI.",
      "props": { "set": "plain", "backdrop": "bg-office", "floor": 91,
        "actors": [ { "who": "maya", "art": "host-pointing", "x": 22, "scale": 0.9, "talking": true } ],
        "props": [
          { "kind": "number", "value": 40, "text2": "%", "x": 62, "y": 50, "tone": "negative", "at": "40" },
          { "kind": "banner", "text": "JOBS EXPOSED", "x": 62, "y": 22, "scale": 1.2, "at": "jobs" } ],
        "fx": [ { "kind": "zoom", "at": "exposed" } ] } }
  ],
  "upload": {
    "titles": ["Engine Test"],
    "thumbnails": [ { "text": "ENGINE TEST" } ]
  }
}
```

Put the two image files in `<folder>/media/art/`, then run `yt voice`, `yt render --stills`, `yt render -f both`.
