# youtube-auto

One engine that produces animated explainer videos for several YouTube channels.
Build plan and progress: [PLAN.md](PLAN.md).

## Setup

Requires Node 22+ and ffmpeg.

```bash
npm install
cp .env.example .env     # keys are needed from Phase 3 on
npx yt status
```

## Commands

```bash
npx yt status                                   # every channel: queue, videos, what needs you

npx yt channel add <id> --name "<name>"         # new channel from the template
npx yt channel list
npx yt channel check                            # validate every channels/*/channel.yaml

npx yt topics add <channel> <topic…>            # quotes optional
npx yt topics add <channel> "<topic>" --priority 5 --notes "angle or sources"
npx yt topics list [channel] [--all]
npx yt topics skip <id>

npx yt demo [channel]                           # voice + render the channel's demo.json (or the built-in one)
npx yt voice <folder>                           # record narration for <folder>/plan.json (Kokoro, local)
npx yt render <folder> [-f long|short|both]     # → <folder>/long.mp4, short.mp4
npx yt render <folder> --stills                 # one PNG per scene instead, for checking layouts
npx yt render <folder> --browser chrome         # render with the installed Google Chrome
npx yt render <folder> --verbose                # print Chrome's log (render crashes)
npx yt studio <folder>                          # live preview in the browser (Remotion Studio)
npx yt kit <folder> [--no-thumbnails]           # rebuild <folder>/upload/ without rendering the video
```

A video folder holds `plan.json` (scenes: template + narration + props), `voice.json` and `media/voice/*.wav` (generated), and the rendered MP4s. Templates and their props are defined in [packages/templates/src/schema.ts](packages/templates/src/schema.ts); the demo plan is a working example: [packages/templates/demo/plan.json](packages/templates/demo/plan.json).

First render downloads Chrome Headless Shell (~140 MB); first voice run downloads the Kokoro model (~90 MB).

## What a scene can show

| Template | Shows |
|---|---|
| `story` | A cartoon cast member behind a desk, with poses and moods that change on spoken words, a speech or thought bubble, chips and flying emoji |
| `chat` | A phone conversation, message by message, with typing dots |
| `tip` | A numbered tip, step or fix with a large floating 3D emoji |
| `hook`, `counter`, `flow`, `chart`, `compare`, `list`, `mascot` | Title, count-up number, loop diagram, bar chart, two-sided comparison, list, robot speech bubble |
| `chapter` | Chapter card for long videos (number, title, big year). Each one becomes a YouTube chapter and shows in the top-left badge |
| `timeline` | Dates on a line that draws itself as each date is spoken (vertical in Shorts) |
| `quote` | A real, sourced quote; words light up as the narrator reads them, then the attribution slides in |
| `place` | A full-frame illustrated location (`diner`, `office`, `bedroom`, `stage`, `datacenter`, `trading`) with up to 3 characters at its table, desk or podium |
| `logos` | Company logos in a grid, popping in as each name is spoken |

Any scene can add up to 4 `stickers`: 3D emoji (or logos) that pop in at the edges when their word is spoken.
Props and examples: [packages/templates/src/schema.ts](packages/templates/src/schema.ts) and [channels/career/demo.json](channels/career/demo.json).

- **Emoji** are Microsoft's Fluent 3D emoji (MIT licence), named in kebab-case: `briefcase`, `money-bag`, `woman-office-worker:medium-dark`. The first use downloads each one into `data/cache/emoji/`. [Browse the names](https://github.com/microsoft/fluentui-emoji/tree/main/assets).
- **Cast:** `maya`, `omar`, `linda`, `sara`, `james`, `dev` ([packages/templates/src/cast.ts](packages/templates/src/cast.ts)). Poses: idle, wave, point, think, shrug, celebrate, worried, present, type, phone. Moods: neutral, happy, worried, surprised, thinking, confident.
- **Sound effects** (pop, whoosh, ding, notify, click, boom, sparkle) are synthesised by [packages/templates/scripts/make-sfx.sh](packages/templates/scripts/make-sfx.sh). Turn them off with `sound.sfx: false` in channel.yaml.
- **Logos** come from [Simple Icons](https://simpleicons.org) by slug (`nvidia`, `intel`, `cisco`). Brands it doesn't carry (OpenAI, Microsoft, Amazon) show their name on a white tile. Logos stay their owners' trademarks: fine for commentary, never as channel branding.
- **Extra characters:** a plan can add its own cast in `plan.cast` (skin, hair, clothes), e.g. cartoons of a company's founders. Real people only say what they really said: put their words in `quote` scenes with the source.
- **Music:** put tracks in `channels/<id>/assets/music/`. Each video picks one and lowers it under the voice. See [channels/career/assets/README.md](channels/career/assets/README.md).

**Long videos (documentaries).** Renders over 2 minutes go in one-minute chunks under `<folder>/.chunks/`. If a render stops, run the same command again: finished chunks are kept and the rest render, then everything is joined. Each render also writes the upload kit (below). For the Short, mark scenes with `"short": "also"` (in both videos) or `"short": "only"` (Short only); a Short over 3 minutes is skipped. Example: [data/biztech/demos/how-nvidia-became-the-company-ai-runs-on/plan.json](data/biztech/demos/how-nvidia-became-the-company-ai-runs-on/plan.json).

**Render crashes ("Target closed").** Remotion's headless Chrome can crash on some Macs. The render then retries once with the installed Google Chrome and uses it for the rest of the run. To always use Google Chrome, pass `--browser chrome` or put `YT_BROWSER=chrome` in `.env`. `--browser` also takes a path to any Chrome binary.

**Studio writes to source code.** Dragging or nudging an element in Remotion Studio saves the change into `packages/templates/src`. To change a video, edit its `plan.json`; use Studio only to watch.

**Upload kit.** Every render writes `<folder>/upload/`: `UPLOAD.md` (each field of YouTube Studio's upload form, in its order: Details, Video elements, Checks, Visibility, then the Short), `description.txt` (summary, chapters, sources, hashtags; under 5,000 bytes, with overflow sources moved to `pinned-comment.txt` after the plan's question), `thumbnail-1.jpg` to `thumbnail-3.jpg` (1280×720, for Test & compare), `captions.srt` (the narration, timed to the voice) and `short-description.txt`. `UPLOAD.md` opens with checks that block an upload: a working-title channel name, a video older than its plan, a video over 15 minutes on an unverified channel (`youtube.verified` in `channel.yaml`), [CHECK] marks left in the plan, oversized descriptions, tags or thumbnails. The plan's `upload` section holds titles, thumbnails, tags, hashtags, the pinned question, the playlist and the Short's title; `channel.yaml`'s `youtube` section holds the category, channel tags and publishing days and time. Publish slots are booked in `data/<channel>/schedule.json`: each new kit takes the channel's next publishing day after the videos already booked, and its Short the day after. A long video ends with an `endscreen` scene: 20 seconds with empty spaces where YouTube's end screen elements go.

## Layout

| Path | What |
|---|---|
| `packages/core` | Config loading, database, topic queue, video step machine, voice + audio analysis |
| `packages/templates` | Remotion compositions: 7 scene templates, captions, mascot, themes, renderer |
| `packages/cli` | The `yt` command |
| `channels/<id>/` | One folder per channel: `channel.yaml`, `prompts/`, `assets/` — committed |
| `data/` | Database and generated videos — gitignored |
| `secrets/` | YouTube login tokens — gitignored |

## Development

```bash
npm run check      # type check + lint + tests
npm run format     # auto-fix formatting
```
