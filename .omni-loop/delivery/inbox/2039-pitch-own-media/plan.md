# Plan: Pitch with your own media

PRD #2039, specified in `spec.md` beside this plan. Built on the feature branch `feat/pitch-own-media`
into `main`, whose PR says `Closes #2039`; each slice is a sub-PR from `feat/pitch-own-media--<slice>`
into the feature branch, saying `Part of #2039`. Build it only once PRD 2030 has shipped (the spec's
Decisions): both change the pitch's storyboard, check and skill.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni pitch probe` brings a media into the run and reads it: its facts, its cuts, a timed contact sheet, gridded frames in 0..1 coordinates and `probe.json` | `kit/lib/pitch/probe` `kit/bin/commands/pitch-make.ts` `kit/bin/commands/pitch-make-probe.test.ts` `kit/bin/commands/pitch.ts` `kit/lib/help/` | — | 1 |
| s2 | A pitch without filming: `start --no-film` skips the `proof.url` refusals and records `film: false`, `film` refuses such a run, and each `proof.url` refusal names `--no-film` | `kit/lib/pitch/run.ts` `kit/lib/pitch/run.test.ts` `kit/bin/commands/pitch-make.ts` `kit/bin/commands/pitch-make.test.ts` `kit/lib/help/` | s1 | 2 |
| s3 | Every clip decoded into frames: `render`, `render --stills` and `studio` decode each clip the storyboard uses, whatever its format, list it under `clips` in `input.json`, and reuse an unchanged clip's frames | `kit/lib/pitch/decode` `kit/lib/pitch/render-input.ts` `kit/lib/pitch/render-input.test.ts` `kit/lib/pitch/render.ts` `kit/lib/pitch/render.test.ts` `kit/lib/pitch/studio.ts` `kit/lib/pitch/studio.test.ts` `kit/bin/commands/pitch-make-render.test.ts` `kit/bin/commands/pitch-make-film.test.ts` | s1 | 2 |
| s4 | The check refuses a clip's `end` past its file's length, and coordinates on a brought-in media that has no probe | `kit/lib/pitch/check.ts` `kit/lib/pitch/check.test.ts` `kit/bin/commands/pitch-make.test.ts` | s1 | 3 |
| s5 | The pitch skill: `--no-film`, the five sources and what shipped winning a disagreement, the two questions, coordinates from the probe's grids, and the scene plan with each line's source approved before the storyboard | `kit/plugin/skills/pitch/` `kit/test/plugin.test.ts` | s2, s3, s4 | 4 |

**Shared ground.**

- `kit/bin/commands/pitch-make.ts`: s1 registers the `probe` verb, s2 changes `start` and `film`.
  s1 is in wave 1 and s2 in wave 2.
- `kit/lib/help/`: s1 adds `omni pitch probe` to the pitch entry, s2 adds `--no-film` to its `start`
  line; the help's own tests may read both. Waves 1 and 2.
- `kit/bin/commands/pitch-make.test.ts`: s2 tests `start --no-film` and `film`'s refusal; s4 may
  have to give its fixture folders a readable clip, since the check now reads each clip's length.
  s2 is in wave 2 and s4 in wave 3.
- s1 owns the reading of a media's facts with ffprobe (`kit/lib/pitch/probe*`); s3 and s4 import it
  rather than write their own, which is why both wait for s1.
- `kit/dist/` is rebuilt by the wave, never by a slice.

## Per slice: done when

**s1 — the probe**

- `omni pitch probe <dir> <file>` on a file outside the run copies it to `<dir>/media/<file name>`,
  and reads a file already inside the run where it is; a different file already at that name is
  refused with `media/<file name> already holds another file: rename one`.
- `.png`, `.jpg`, `.jpeg` and `.webp` are screenshots; another file with a video stream is a clip;
  anything else is exit 1, `<file>: not an image or a video ffmpeg reads`, and nothing is copied.
- For a clip it prints its path in the run, its size, its length, its frame rate, whether it holds
  sound, and `cuts: …` or `cuts: none (one continuous shot)`; it writes `sheet.png` (one frame every
  `--every` seconds, 2 by default, 0.5 at least, four across, each labelled with its time), a
  `grid-<seconds>.png` per `--at` time, and `probe.json`, all in `<dir>/probe/<file name>/`.
- For a screenshot it prints its size and writes `grid.png` and `probe.json`.
- A grid frame shows lines every 0.1 of the width and height, each labelled with its value, drawn
  through the capture provider.
- An `--at` past the clip's end is exit 1 naming it; without ffmpeg it refuses as `start` does.
- The ffprobe and ffmpeg arguments, the cuts read from ffmpeg's output and `probe.json`'s shape are
  pure functions, tested without ffmpeg; the command is tested on an H.264 `.mp4` and a PNG the test
  generates, skipped where ffmpeg or the browser is missing.
- `omni help pitch` and the pitch usage line name `probe`.

**s2 — a pitch without filming**

- `omni pitch start <n> --for customers --no-film` with no `proof.url`, or with
  `proof.url: github-deployment`, opens the run, writes `"film": false` and `"url": null` in
  `pitch.json`, and prints `url` as `null`.
- With `--no-film`, a PRD not shipped, no ffmpeg and no sign-in are still refused, in that order.
- Without `--no-film`, both `proof.url` refusal lines end with
  `; or bring your own media: /omni:pitch <n> --no-film`.
- `omni pitch film <dir>` on a `film: false` run exits 1 with
  `this run brings its own media: it films nothing (started with --no-film)` and writes nothing.
- `omni help pitch` shows `--no-film` on the `start` line.

**s3 — every clip decoded**

- Each clip the storyboard uses, `walk.webm` included, is decoded with ffmpeg from 0 to the latest
  second any media shows of it (its file's end when a media has no `end`), at `meta.fps`, at most
  2560 px wide, into numbered JPEG images in `<dir>/frames/<key>/`.
- `<key>` is unchanged for an unchanged file and changes with its size, its modification time, the
  fps or the last second; a clip whose frames are already there is not decoded again.
- `input.json` lists each decoded clip under `clips`, with `frames`, `fps`, `count`, `width` and
  `height`, in the shape `kit/pitch-engine/input.ts` reads.
- A storyboard whose feature shows an H.264 `.mp4` the test generates renders its stills, and the
  feature's still shows the clip's colour at its time, not a blank frame.
- `render --stills` and `studio` refuse without ffmpeg when the storyboard holds a clip, as `render`
  does; `studio` decodes again when the storyboard changes which clips or seconds it uses.
- The filmed walk-through still renders and its studio still opens (`pitch-make-film.test.ts`).

**s4 — the check**

- A clip whose `end` is past its file's length is an error,
  `<path>.end: <end> s is past the end of <file> (<length> s)`.
- A media other than `walk.webm` with `camera`, `callouts` or `cursor` and no
  `probe/<file name>/probe.json` in the run is an error naming `omni pitch probe <dir> <file>`; the
  same media with its `probe.json` passes; `walk.webm` with a camera and no probe passes as today.
- Every existing check test and `omni pitch check` command test still passes.

**s5 — the skill**

- `kit/plugin/skills/pitch/SKILL.md` takes `[--no-film]` and passes it to `start`.
- Its sources are the spec, the release note, the PRD's issue, its merged pull requests (titles and
  bodies, never diffs) and `note.md`, never the code; an unreadable source is said in one line; what
  shipped wins a disagreement and the gap is shown.
- It asks once for recordings or screenshots, runs `omni pitch probe` on each, asks once whether they
  show only test or demonstration data and leaves them out on a no.
- It reads coordinates on a brought-in media from its grid frames only.
- It shows the scene plan (scene, media, line, source, gaps) and waits for approval before writing the
  storyboard; the sources never appear in the video; `meta.sources` uses the table's words.
- `kit/test/plugin.test.ts` checks that the pitch skill names `--no-film`, `omni pitch probe`, the
  scene plan and the five sources.
