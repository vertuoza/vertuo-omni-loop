---
prd: 2039
title: Pitch with your own media — beside or instead of the walk-through, any format, read with a probe, from wider sources
blocked-by: none
spec: file
---

# Pitch with your own media

**Date:** 2026-10-15 · **PRD:** #2039 · **Build after:** PRD 2030 has shipped (see Decisions) · **Follows:** PRD 1108 (Pitch studio) and PRD 2030 (Pitch scenes),
whose settings, providers, filmed moments, scenes, check, studio, render and push stay. **Compared with:**
`demo-org/release-videos`, the engine PRD 1108 names as its inspiration: it builds its videos from
recordings the team already has, decodes every clip into images before the render, and reads a
recording's coordinates with a probe. PRD 2030 left this piece to "a later PRD": this is it.
**Touches:** `kit/lib/pitch/` (run, render input, render, studio, check, a new probe module, the ffmpeg
recipes), `kit/bin/commands/pitch-make.ts`, `kit/plugin/skills/pitch/SKILL.md`, and the rebuilt
`kit/dist/`. **Out of scope:** the engine page (`kit/pitch-engine/`), which already reads decoded clips;
the Omni page and its Pitch tab; the music.

## Problem

A pitch can show a feature only as far as a read-only walk-through on production reaches, and only from
a WebM clip, with words from two files.

- **The key moment cannot be shown.** The walk-through never saves, sends or deletes anything, and the
  skill says "when the feature cannot be shown without a change, film the page that leads to it and
  stop there" (`kit/plugin/skills/pitch/SKILL.md`, section 3). A feature whose moment is "I create", "I
  send" or "I approve" ends its video one click early.
- **No fixed address, no video.** `omni pitch start` refuses a repository whose `proof.url` is not a
  fixed URL (`kit/lib/pitch/run.ts`, `pitchRefusal`), even when the team holds a good recording of the
  feature from staging, QA or a pull request's demo.
- **Only WebM plays.** A clip is played by seeking a `<video>` element in the render's Chromium, which
  reads WebM, waiting up to 5 s for each frame (`kit/pitch-engine/assets.tsx`, `seek`). A `.mov` or an
  H.264 `.mp4` from a screen recorder does not play. The engine already draws a clip decoded into
  numbered images when its input lists one (`kit/pitch-engine/input.ts`, `clips`), but nothing in the
  kit decodes a clip or fills that list (`kit/lib/pitch/render-input.ts`, `writePageInput`).
- **No way to read a recording's coordinates.** The camera, the callouts and the cursor are copied from
  `moments.json`, which only filming writes; "Never guess a coordinate" leaves a recording the person
  brings with no zoom, no callout and no cursor.
- **Thin sources, thin video.** The words come from the spec and the release note "and nothing else:
  not the code, not the issue" (section 2). A feature with a short spec gets a short video, though the
  PRD's issue and its merged pull requests say what shipped.

## Solution

### 1. A pitch without filming

- `omni pitch start <n> --for customers|inside --no-film` skips both `proof.url` refusals (not configured,
  and `github-deployment`); the other three
  refusals (not shipped, no ffmpeg, no sign-in) stand, in their order. It writes `"film": false` and
  `"url": null` in `pitch.json`, and prints `url` as `null`.
- `omni pitch film <dir>` on a run whose `pitch.json` holds `"film": false` refuses with one line,
  `this run brings its own media: it films nothing (started with --no-film)`, exit 1, writing nothing.
- Without `--no-film`, each `proof.url` refusal line gains its way out at its end:
  `…; or bring your own media: /omni:pitch <n> --no-film`.

### 2. `omni pitch probe`

```
omni pitch probe <dir> <file> [--every <seconds>] [--at <seconds>,<seconds>…]
```

- **Bringing a file in.** A `<file>` outside `<dir>` is copied to `<dir>/media/<file name>` first; a file
  already inside the run is read where it is. When `media/<file name>` already holds a different file,
  it refuses: `media/<file name> already holds another file: rename one`.
- **Kind.** `.png`, `.jpg`, `.jpeg` and `.webp` are screenshots; any other file is read as a clip when
  ffprobe finds a video stream in it. Anything else is exit 1 with one line,
  `<file>: not an image or a video ffmpeg reads`, and nothing is copied.
- **What it prints:** the file's path in the run, its size in pixels, and, for a clip, its length in
  seconds, its frame rate and whether it holds sound (the render never uses it); then, for a clip, its
  cuts (`cuts: 2.40, 7.85` or `cuts: none (one continuous shot)`), the instants where the picture
  changes at once, which are the clean places to cut.
- **What it writes,** in `<dir>/probe/<file name>/`:
  - `sheet.png` (a clip only): one frame every `--every` seconds (2 by default, 0.5 at least), four
    across, each labelled with its time;
  - `grid-<seconds>.png` for each time `--at` names (a clip), or `grid.png` (a screenshot, always): the
    frame at full width under a grid of lines every 0.1 of its width and height, each line labelled
    with its value, so a point or a box reads in the 0..1 coordinates the storyboard uses;
  - `probe.json`: `{ probe: 1, file, kind, width, height, seconds?, fps?, sound?, cuts?, sheet?, grids }`.
- The grids and the sheet are drawn through the capture provider, as the render's frames are. A
  time `--at` names past the clip's end is exit 1 naming it. Without ffmpeg, it refuses as `start` does.

### 3. Every clip decoded into frames

- `omni pitch render`, `render --stills` and `studio` decode each clip the storyboard uses, whatever
  its format, the walk-through's `walk.webm` included: from its start to the latest second any media
  shows of it (its file's end when a media has no `end`), at the storyboard's `meta.fps`, scaled down
  to at most 2560 px wide, as numbered JPEG images in `<dir>/frames/<key>/`. `<key>` is drawn from the
  file's size and modification time, the fps and the last second, so an unchanged clip is decoded
  once and reused by every later render.
- The page's `input.json` lists each decoded clip under `clips` (`frames`, `fps`, `count`, `width`,
  `height`), which the engine already reads: a frame shows exactly the image it should, and no frame
  waits on a seek.
- `render --stills` and `studio` now need ffmpeg when the storyboard holds a clip, and refuse without
  it as `render` does. `studio` decodes again when the storyboard changes which clips or seconds it
  uses.

### 4. The check

Two new errors in `omni pitch check`:

- A clip's `end` past its file's length (read with ffprobe): `<path>.end: <end> s is past the end of
  <file> (<length> s)`.
- A media other than the walk-through's `walk.webm` that carries `camera`, `callouts` or `cursor`
  while the run holds no `probe/<file name>/probe.json`: `<path>: coordinates on <file> without a
  probe of it: run omni pitch probe <dir> <file>`.

### 5. The skill

`kit/plugin/skills/pitch/SKILL.md` changes as follows.

- **Input:** `<n> --for customers|inside [--no-film]`, passed on to `start`.
- **The sources** (section 2): the spec and the release note, as today; the PRD's issue
  (`gh issue view <n>`, its title and body); its merged pull requests, the feature PR and its
  sub-PRs (titles and bodies, never their diffs); and `<dir>/note.md` when the person writes one, or
  dictates one in the conversation, copied word for word. Never the code. A source that cannot be
  read is said in one line, and the pitch goes on without it. When two sources disagree, what
  shipped wins (the release note, then the merged pull requests, over the spec, the issue and the
  note), and the scene plan names the gap. Every rule of "The words" holds for every source.
- **Your own media:** ask once, "Any recordings or screenshots to bring (their paths)?". Run
  `omni pitch probe` on each, look at its sheet, then ask once, "Do these media show only test or
  demonstration data?": on a no, they are not used. A media brought in shows the moments the
  walk-through cannot reach (the save, the send, the approval), or every moment when the run films
  nothing. Its cuts are where its clips start and end.
- **Coordinates:** on a media brought in, the camera, the callouts and the cursor are read from its
  grid frames: run `omni pitch probe <dir> <file> --at <seconds>` at each instant that needs one.
  "Never guess a coordinate" stands: what has no moment and no grid is not zoomed on.
- **The scene plan:** before writing the storyboard, show the person a table, one row per on-screen
  line: the scene, its media (a moment of the walk-through, or a file and its seconds), the line, and
  the source it comes from (`spec`, `release`, `issue #<n>`, `PR #<n>`, `note`), with any gap between
  sources under it. Wait for the person's approval; change the plan as they ask, and show it again.
  The sources are shown in this table only, never in the video.
- **meta.sources** lists every source a line was taken from, in the same words as the table
  (`spec.md`, `release.md`, `issue #<n>`, `PR #<n>`, `note.md`).

## Decisions

- **Third of three PRDs** (asked, in PRD 2030's brainstorm): the scenes (PRD 2030), the music, then
  this one; each closes part of the gap with `release-videos`.
- **Beside the walk-through or instead of it** (asked, over "beside it only"): a feature with no fixed
  address to film, or one the team already recorded well, can have a video. `--no-film` is the
  person's choice, said on the command line, so a pitch that films keeps every guard it has.
- **Decode every clip into frames at render** (asked, over converting each file to WebM when it is
  brought in, or both): the engine already draws decoded clips, ffmpeg is already required, any format
  ffmpeg reads works, every frame is exact, and the 5-second seek on `walk.webm` goes too. The cost is
  disk space in the run's folder, decoded once per unchanged clip.
- **The probe brings the file in** (taken here, approved with the design): one verb copies a media into
  the run and reads it, so a media in `media/` has always been looked at, and the check can tell a
  read coordinate from a guessed one by the probe's file.
- **More sources, the same rule** (asked, over a note only or leaving sources out): the PRD's issue,
  its merged pull requests and a note from the person; never the code. What shipped wins a
  disagreement, and the gap is shown, never settled silently.
- **Demonstration data only** (approved with the design): a recording from staging or QA can show
  people's data; the person says once that the media show only test or demonstration data, and a no
  keeps them out of the video.
- **The voice's objection** (persona:F-E Developer, "the bodies of the pull requests here are written
  by agents; a customer video that repeats them repeats whatever an agent claimed — I want a person to
  see where every line comes from before it ships"): settled `accepted` — the scene plan, with each
  line's source, is approved by the person before the storyboard is written. The sources stay out of
  the video (asked).
- **Built after PRD 2030** (asked): both change the storyboard, the check and the skill, and a step's own
  media (PRD 2030) is where a brought-in recording is most often used. The order is written, not
  declared (asked): `blocked-by` can only name a PRD already in the inbox, and PRD 2030's phase-0 PR
  had not merged when this spec was written. Run `/omni:yolo 2039` only once PRD 2030 has shipped.
- **Proof video** (asked): no.

## User stories

- As the person making a pitch, I bring the recording of the moment the walk-through cannot reach (the
  save, the send), and the video shows the gesture to its end.
- As a team whose product has no fixed address to film, I make a pitch from recordings I already have.
- As the person making a pitch, I drop in the `.mov` or `.mp4` my screen recorder made, and it plays.
- As the person making a pitch, I read where to zoom and point on my recording from a grid, so the
  camera lands on the element without guessing.
- As the person making a pitch, I see each line of the video with where it comes from before the
  storyboard is written, and I approve it.
- As a team with a short spec, the video also says what the issue and the merged pull requests say
  shipped.

## Scope

**In:** `--no-film` on `start` and the refusal of `film`, the `proof.url` refusal's new way out; the
`probe` verb, its copy into `media/`, its cuts, sheet, grids and `probe.json`; decoding every clip
into frames for `render`, `render --stills` and `studio`, with its reuse; the check's two new errors;
the skill's sources, its two questions, its coordinates rule and its scene plan; the rebuilt
`kit/dist/`.

**Out:** the engine page (`kit/pitch-engine/`); the Omni page, its Pitch tab and its upload; reading a
ticket tracker other than the repository's GitHub issues (a person pastes it into the note);
reading the code; sound from a brought-in recording; image formats other than PNG, JPEG and WebP; the
music; other checks of the storyboard than the two above.

## Test seams

Following `omni kb show testing`: tests beside the code, pure units first, nothing calls GitHub or
Supabase. A test that needs ffmpeg or the browser is skipped where it is not installed, as the pitch's
tests are today. No real recording enters the repository: every clip a test uses is generated by
ffmpeg in the test.

1. **Start and film** (`kit/lib/pitch/run.test.ts`, `kit/bin/commands/pitch-make.test.ts`): `--no-film`
   passes without `proof.url` and writes `film: false` and `url: null`; the three other refusals still
   come in their order; without `--no-film`, the `proof.url` line names `--no-film`; `film` on a
   `film: false` run is exit 1 with its line and writes nothing.
2. **The probe's recipes** (`kit/lib/pitch/probe.test.ts`): the ffprobe and ffmpeg arguments for the
   facts, the cuts, the sheet's frames and a grid's frame, as pure functions; the cuts read from
   ffmpeg's output; the kind told from the extension and the probe's streams; the grid's labels at
   every 0.1; `probe.json` in shape.
3. **The probe as a command** (`kit/bin/commands/pitch-make-probe.test.ts`, ffmpeg and browser): an
   H.264 `.mp4` generated with two plain colours, cut at 1 s, prints its length and `cuts: 1.00`,
   writes `sheet.png` and `grid-0.5.png`, and copies the file into `media/`; a PNG gets `grid.png`; a
   text file is exit 1 and copies nothing; a second, different file of the same name is refused; an
   `--at` past the end is exit 1.
4. **Decoding** (`kit/lib/pitch/render-input.test.ts`, `kit/lib/pitch/render.test.ts`): the decode
   recipe for a clip and its last second; the key unchanged for an unchanged file and changed by its
   size, its time, the fps or the last second; `input.json` lists each clip under `clips` with its
   count and size; a clip already decoded is not decoded again; `render --stills` without ffmpeg and
   with a clip refuses.
5. **The render with an `.mp4`** (`kit/bin/commands/pitch-make-render.test.ts`, ffmpeg and browser): a
   storyboard whose feature shows a generated H.264 `.mp4` renders its stills, and the feature's still
   shows the clip's colour at its time, not a blank frame.
6. **The check** (`kit/lib/pitch/check.test.ts`): a clip's `end` past its file's length is an error
   naming the path and both lengths; a media in `media/` with a camera and no `probe.json` is an error
   naming the command to run; the same with a `probe.json` passes; `walk.webm` with a camera and no
   probe passes as today.
7. **The skill** (`kit/test/plugin.test.ts`, as the plugin's other skills are checked): the pitch skill
   names `--no-film`, `omni pitch probe`, the scene plan and the five sources.

## Risks

Merging publishes the kit: the root package's `bin` (`kit/dist/omni.mjs`) and the plugin's pitch skill,
through the marketplace (`omni kb show releasing`). No database, no page and no app changes.

- **Disk space.** Decoded frames of a long recording take room in the run's folder, under the
  worktrees, never in the tracked tree; they are reused across renders, and go with the folder.
- **Render time.** The first render of a run decodes its clips; later renders reuse them.
- **A different still.** `walk.webm` is now drawn from decoded frames rather than seeked: a still may
  differ by a frame from the one a seek showed. The engine's reference images are untouched, since the
  engine does not change.
- **Wider sources.** A merged pull request's body may say more than shipped; the scene plan shows each
  line's source to the person before it is written, and the never-invent rule holds.
- **Rollback:** revert the feature PR; the next release ships the kit without `--no-film`, the probe
  and the decoding, and a run folder made with them still renders from WebM clips as before.

## Acceptance criteria

`acceptance.enabled` is false in this repository: each criterion is proved by the tests above.

1. `omni pitch start <n> --for customers --no-film` in a repository with no `proof.url` opens a run
   whose `pitch.json` holds `"film": false`; `omni pitch film` on it exits 1 with its line and writes
   nothing.
2. Without `--no-film`, the `proof.url` refusal names `--no-film`.
3. `omni pitch probe <dir> <recording.mp4>` copies the file into `<dir>/media/`, prints its length and
   cuts, and writes `sheet.png`, `probe.json` and, with `--at`, a gridded frame labelled every 0.1.
4. `omni pitch probe` on a file ffmpeg cannot read exits 1, naming it, and copies nothing.
5. A storyboard that shows an H.264 `.mp4` renders, and each still shows the clip's frame at its time.
6. Every clip a render uses is listed under `clips` in `input.json`, and an unchanged clip is decoded
   once across renders.
7. `omni pitch check` refuses a clip's `end` past its file's length, and coordinates on a brought-in
   media that has no probe.
8. The pitch skill reads the PRD's issue, its merged pull requests and the person's note besides the
   spec and the release note, never the code, and shows the scene plan with each line's source for
   approval before writing the storyboard.
