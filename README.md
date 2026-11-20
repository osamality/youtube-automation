# youtube-auto

youtube-auto turns a text file into a narrated, animated YouTube video.

You write a `plan.json` that lists scenes. Each scene has one or two sentences of narration and says what to show. One command then records the voice, animates the scenes and renders the video. It makes both a wide video and a vertical Short from the same plan, and writes a checklist for the YouTube upload form.

Everything runs on your own computer. The voice model and the renderer are free and need no account or API key.

## What one plan produces

| File | What it is |
|---|---|
| `long.mp4` | 1920×1080 video, 30 fps, audio levelled to -14 LUFS (YouTube's level) |
| `short.mp4` | 1080×1920 Short, made from the scenes you mark for it |
| `media/voice/*.wav`, `voice.json` | The narration, one clip per scene |
| `stills/*.png` | One picture per scene, to check layouts before a full render |
| `upload/` | `UPLOAD.md` checklist, title, description, captions (`.srt`), up to 3 thumbnails, Short title and description |

Measured on an Apple Silicon Mac:

| Video | Render time |
|---|---|
| 0:26 Short | 1 min 16 s |
| 0:46 video | 2 min 17 s |
| 8:20 video | 25 min 34 s |

## What you need

| Tool | Why | Install on a Mac |
|---|---|---|
| macOS on Apple Silicon | Tested platform. See [Windows and Linux](#windows-and-linux) for other systems. | |
| Node.js 22 | Runs the engine | Installer from [nodejs.org](https://nodejs.org), or `brew install node@22 && brew link --force node@22` |
| ffmpeg | Audio and video processing | `brew install ffmpeg` |
| Google Chrome | Backup renderer, and the upload helper | [google.com/chrome](https://www.google.com/chrome) |
| Python 3 with numpy | Optional. Only for generating background music | `pip3 install numpy` |

Homebrew is at [brew.sh](https://brew.sh).

## Install

```bash
git clone <repository-url> youtube-auto
cd youtube-auto
npm install
npx yt status
```

`npx yt status` should print "No channels yet". That means the install works.

Two downloads happen the first time you use the engine:

- The first voice recording downloads the Kokoro voice model (about 90 MB).
- The first render downloads a headless Chrome (about 140 MB).

## Quick start: render the demo

```bash
npx yt channel add my-channel --name "My Channel"
npx yt demo my-channel
```

The first command creates `channels/my-channel/` with default settings. The second records and renders a 7-scene demo about how Netflix makes money.

The result is in `data/my-channel/demos/how-netflix-makes-money/`. Open `long.mp4`.

The demo prints three warnings: no end screen, no Short and no upload section. That is expected. The demo plan is not marked up for a Short or an upload. The next section shows a plan that is.

## Make your own video

### 1. Start from the example

```bash
mkdir -p data/my-channel/videos
cp -r examples/first-video data/my-channel/videos/first-video
```

[examples/first-video/plan.json](examples/first-video/plan.json) is a 6-scene video that needs no artwork. It renders a 0:46 video and a 0:26 Short.

Keep your videos under `data/`. Git ignores that folder.

### 2. Edit the plan

Open `data/my-channel/videos/first-video/plan.json`. Change the narration and the text in `props`. A scene looks like this:

```json
{
  "template": "counter",
  "short": "also",
  "narration": "From that one file, the engine makes two videos: a wide one and a Short.",
  "props": { "value": 2, "label": "videos from one plan", "sublabel": "16:9 video and 9:16 Short" }
}
```

| Field | Meaning |
|---|---|
| `template` | The scene type. See [Scene types](#scene-types). |
| `narration` | What the voice says. One sentence works best, two at most. Maximum 600 characters. |
| `props` | What the scene shows. Each scene type has its own props. |
| `short` | `"also"` puts the scene in the video and the Short. `"only"` puts it in the Short only. Leave it out to keep the scene out of the Short. |
| `chapter` | Optional. A label here starts a YouTube chapter at this scene. |

The top of the plan holds `channel` (must match a folder in `channels/`), `title`, `summary` and an `upload` section (titles, thumbnails, tags, hashtags, the Short's title). Every field and its limit is defined in [packages/templates/src/schema.ts](packages/templates/src/schema.ts).

### 3. Check the scenes as pictures

```bash
npx yt render data/my-channel/videos/first-video --stills
```

This records the voice and saves one PNG per scene in `stills/`. It takes about 30 seconds. Look at every picture before you render the full video.

### 4. Render

```bash
npx yt render data/my-channel/videos/first-video -f both
```

`-f long` or `-f short` renders one format only. The voice is recorded again only for scenes whose narration changed.

### 5. Upload

Open `upload/UPLOAD.md`. It starts with checks. A line marked ✖ blocks the upload: fix it and render again. The rest of the file walks through YouTube Studio's upload form field by field, with the text to paste.

To fill the form for you, run `npx yt upload <folder>`. It opens Chrome, uploads the video and fills in the title, description, thumbnail and tags. It stops at the Visibility step. You choose the visibility and press Save. The first time, sign in to YouTube in the Chrome window that opens. The sign-in is kept in `secrets/chrome-profile/`.

## Scene types

| Template | Shows | Needs your images |
|---|---|---|
| `hook` | Big title with highlighted words | No |
| `counter` | A number that counts up, with a label | No |
| `chart`, `line` | Bar chart, line chart | No |
| `compare` | Two sides with points and a verdict | No |
| `list`, `flow` | Icon list, step diagram | No |
| `timeline` | Dates on a line that draws itself as each date is spoken | No |
| `tip` | A numbered tip with a large 3D emoji | No |
| `chat` | A phone conversation, message by message | No |
| `story`, `place`, `mascot` | Code-drawn cartoon characters at a desk, in a room, or a robot with a speech bubble | No |
| `exercise` | A figure doing a move from a built-in library, with a rep counter | No |
| `quote`, `headline`, `document`, `profile` | Sourced quote, news clipping, statement page, case file | No. Can add a photo. |
| `logos` | Company logos that pop in as each name is spoken | No |
| `chapter`, `card` | Chapter page; one hand-written line on black | No |
| `endscreen` | The last 20 seconds, with space for YouTube's end screen elements | No |
| `photo`, `people` | Real photos from Wikimedia Commons, credited in the description | Downloaded by the engine |
| `sketch` | A full cartoon scene: background, characters, props, labels, automatic camera | Yes |
| `manga` | One to three comic panels | Yes |

Start with the scene types that need no images. `sketch` and `manga` need your own PNG artwork: see [Artwork for sketch scenes](#artwork-for-sketch-scenes).

Any scene can add up to 4 `stickers`: 3D emoji or logos that pop in when their word is spoken.

### Built-in pieces

- **Emoji** are Microsoft's Fluent 3D emoji (MIT licence), named in kebab-case: `light-bulb`, `money-bag`, `woman-office-worker:medium-dark`. Each one downloads on first use. [Browse the names](https://github.com/microsoft/fluentui-emoji/tree/main/assets).
- **Icons** in `list`, `flow` and `compare` are [Lucide](https://lucide.dev/icons) names: `mic`, `upload`, `clock`.
- **Cast** for `story`, `chat` and `tip`: `maya`, `omar`, `linda`, `sara`, `james`, `dev`. Poses: idle, wave, point, think, shrug, celebrate, worried, present, type, phone. Moods: neutral, happy, worried, surprised, thinking, confident. A plan can add its own characters in `plan.cast`.
- **Logos** come from [Simple Icons](https://simpleicons.org) by slug (`nvidia`, `intel`). Brands it doesn't carry show their name on a white tile. Logos belong to their owners: use them for commentary, not as your channel's branding.
- **Sound effects** (pop, whoosh, ding, notify, click, boom, sparkle) play on cues. Turn them off with `sound.sfx: false` in `channel.yaml`.

### Cues

Many props take an `at` value: one or two words from that scene's narration. The item appears when the voice says that word. Write numbers the same way in both places: narration "40 percent" matches cue `"40"`. If the word isn't in the narration, the item appears at the start of the scene, with no error.

## Channel settings

`npx yt channel add <id> --name "<name>"` creates `channels/<id>/channel.yaml`. Run `npx yt channel check` after every edit. The main settings:

| Setting | Options |
|---|---|
| `voice.id` | Kokoro voice. American female: `af_heart`, `af_bella`, `af_nicole`, `af_sarah`. American male: `am_michael`, `am_adam`, `am_fenrir`, `am_puck`. British: `bf_emma`, `bf_isabella`, `bm_george`, `bm_lewis`. |
| `voice.speed` | 0.5 to 2. At 1.3 the voice reads about 200 words per minute. |
| `theme.palette` | `daylight`, `sunrise`, `warm-cream`, `forest`, `dark-blue`, `midnight-purple`, `neon-night` |
| `theme.font` | `Inter`, `Poppins`, `Montserrat`, `Space Grotesk`, `Nunito`, `Andika` |
| `mascot` | `robot`, or delete the line for no mascot |
| `youtube.short_min_seconds`, `short_max_seconds` | The Short's allowed length. A Short outside it is skipped. Default 20–40. |
| `youtube.publish` | Publishing days, time and timezone. Each upload kit books the next free slot. |
| `youtube.verified` | Set to `true` once the channel is verified at youtube.com/verify. Needed for videos over 15 minutes. |

A plan can override the voice for one video: `"voice": { "id": "af_heart", "speed": 1.3, "trim": true }`. In a plan, speed runs from 0.6 to 1.6. `trim` cuts the silence at both ends of each clip, which makes the pace faster.

`channels/<id>/prompts/script.md` holds the channel's script rules. The engine doesn't read it. It is for whoever writes the plans.

### Music

Put `.mp3`, `.m4a`, `.wav` or `.ogg` tracks in `channels/<id>/assets/music/`. Each video picks one track and lowers it under the voice. The same title always gets the same track. Use royalty-free music only.

To generate original loops:

```bash
python3 packages/templates/scripts/make-music.py channels/my-channel/assets/music/warm.wav warm       # or: easy
python3 packages/templates/scripts/make-news-music.py channels/my-channel/assets/music/drive.wav drive  # or: pulse
```

## Long videos

Videos over 2 minutes render in one-minute chunks under `<folder>/.chunks/`. If a render stops, run the same command again. Finished chunks are kept.

For a long video:

- Put a `chapter` label on a scene every 40–60 seconds. They become YouTube chapters in the description.
- End with an `endscreen` scene.
- Mark 3–6 scenes for the Short.

## Artwork for sketch scenes

`sketch` scenes draw your own images: a background and cut-out characters and objects. Any image generator works.

1. Put the PNG files in `<video folder>/media/art/`.
2. List each one in the plan's `art` section with its width and height:
   `{ "id": "bg-office", "file": "art/bg-office.png", "width": 1536, "height": 864 }`
3. Refer to the art by `id` in the scene's `backdrop`, `actors` and `props`.

Characters need a transparent background, and a `box` that marks where the figure sits in the image.

[VIDEO-ENGINE-SPEC.md](VIDEO-ENGINE-SPEC.md) has the details:

- section 6.2: every sketch prop
- section 10: the art style and prompts that work
- section 16: a minimal sketch plan

## Writing plans with an AI assistant

The engine doesn't write scripts. You can write plans by hand, or ask an AI coding assistant such as Claude Code to write them. Point it at two files:

- [packages/templates/src/schema.ts](packages/templates/src/schema.ts): every field and limit.
- [VIDEO-ENGINE-SPEC.md](VIDEO-ENGINE-SPEC.md): how timing, cues and the sketch scene work.

Section 13 of the spec describes a full workflow: research, plan, voice, stills, render, upload.

Rules that keep videos watchable:

- One sentence per scene. Word timings are estimated, so short scenes keep cues accurate.
- Change the picture every 1–2 seconds: give each scene 2–4 cued items.
- Budget about 200 words per minute at speed 1.3. An 8-minute video is about 1,650 words and 90 scenes.
- A Short of 30–50 seconds is 100–160 words.

## Commands

```bash
npx yt status                                   # every channel: topic queue, videos in progress
npx yt channel add <id> --name "<name>"         # new channel
npx yt channel list
npx yt channel check                            # validate every channel.yaml

npx yt topics add <channel> "<topic>"           # a to-do list of video ideas
npx yt topics add <channel> "<topic>" --priority 5 --notes "angle or sources"
npx yt topics list [channel] [--all]
npx yt topics skip <id>

npx yt demo <channel>                           # record and render the built-in demo
npx yt voice <folder>                           # record the narration only
npx yt render <folder> [-f long|short|both]     # voice if needed, render, write the upload kit
npx yt render <folder> --stills                 # one PNG per scene instead of a video
npx yt render <folder> --browser chrome         # render with the installed Google Chrome
npx yt render <folder> --verbose                # print Chrome's log
npx yt kit <folder> [--no-thumbnails]           # rewrite upload/ without rendering the video
npx yt studio <folder>                          # live preview in the browser (Remotion Studio)
npx yt upload <folder> [-f long|short|both]     # fill YouTube Studio's upload form; you press Save
```

`<folder>` is any folder that contains a `plan.json`.

## Troubleshooting

| Message or problem | Fix |
|---|---|
| "Remotion's headless Chrome crashed. Retrying with Google Chrome." | Nothing to do: the render continues in Chrome. To skip the first attempt, create a `.env` file with `YT_BROWSER=chrome`. |
| "Short skipped: it would run N seconds" | Mark more or fewer scenes with `"short": "also"`, or change `short_min_seconds` and `short_max_seconds` in `channel.yaml`. |
| "long.mp4 is older than plan.json or channel.yaml" | The plan changed after the render. Render again. |
| `No channel "x"` | The plan's `channel` must match a folder in `channels/`. Create it with `npx yt channel add`. |
| A validation error with a field path | The plan breaks a rule in `schema.ts`. The message names the field. Texts have length limits, and empty strings `""` are rejected: leave the field out instead. |
| An item appears at the start of the scene instead of on its word | The `at` word isn't in that scene's narration, or is spelled differently. |
| A long render stopped | Run the same command again. Finished chunks are kept. |
| Remotion Studio changed files in `packages/` | Studio saves drags and nudges into the source code. Use it to watch only, and edit `plan.json` instead. |

## Windows and Linux

The engine is built and tested on macOS. On other systems:

- **Windows:** run it inside WSL2 (Ubuntu). The sound and loudness scripts need bash.
- **Photo cut-outs and face framing** use a macOS feature. They are off on other systems.
- **`yt upload`** looks for Chrome at the macOS path. Upload by hand from `UPLOAD.md` instead.
- **Rendering, voice, stills and the upload kit** work on any system with Node 22, ffmpeg and Chrome.

## Folders

| Path | What |
|---|---|
| `packages/templates` | Scene designs, captions, thumbnails, the renderer |
| `packages/core` | Channel settings, voice, audio, upload kit, topic database |
| `packages/cli` | The `yt` command |
| `examples/` | Example plans |
| `channels/<id>/` | One folder per channel: `channel.yaml`, `prompts/`, `assets/music/`. Ignored by git. |
| `data/` | Your videos, the topic database and downloads. Ignored by git. |
| `secrets/` | The Chrome profile used by `yt upload`. Ignored by git. |

## Development

```bash
npm run check      # type check, lint and tests
npm run format     # fix formatting
```
