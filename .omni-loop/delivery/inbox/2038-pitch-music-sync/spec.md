---
prd: 2038
title: Pitch music that lands on a measured rise, from tracks the person heard
blocked-by: none
spec: file
proof: video
---

# Pitch music that lands on a measured rise

**Date:** 2026-10-15 · **PRD:** #2038 · **Follows:** PRD 1108 (Pitch studio), whose settings, music
providers, storyboard, check, render and push stay. **Compared with:** `vertuoza/release-videos`, the
engine PRD 1108 names as its inspiration (its spec, "Inspired by"): it measures a track's energy,
syncs a chosen rise onto a scene named by its id, checks the sync before rendering, and lets the
person hear a few tracks before one is picked. That part was left behind. **Sibling:** PRD 2030
(pitch scenes) changes the same storyboard and check; the two touch different fields and stand
alone. **Touches:** `kit/lib/pitch/storyboard.ts`, `kit/lib/pitch/check.ts`,
`kit/lib/pitch/render-music.ts`, `kit/lib/pitch/render.ts`, `kit/lib/pitch/providers/` (the music
interface and `freepd`), a new `kit/lib/pitch/energy.ts`, `kit/bin/commands/pitch-make.ts` (a new
verb), `kit/plugin/skills/pitch/SKILL.md`, and the rebuilt `kit/dist/`. **Out of scope:** new music
catalogues, a larger FreePD list, previews of the video under each track, a player in the studio,
generated music, the scenes (PRD 2030), media the person brings (a later PRD).

## Problem

A pitch with music lands its music at random, and nobody chose the track.

- **The key moment is assumed, never measured.** `kit/lib/pitch/render-music.ts` takes every track's
  key moment as `TRACK_KEY_SECONDS = 8` and starts the track so that its 8th second lands on the
  sync point (`audioOf`). Whether the track rises, falls or idles there is never looked at, so the
  video's key moment can meet a quiet bar or a break.
- **The track is taken, not chosen.** The `freepd` provider takes the mood's shortest pinned track
  that covers the video (`providers/music/freepd.ts`, `pickTrack`). The person never hears it, and
  is not told which track was taken or how to take another, beyond the credit in `pitch.json`.
- **The sync point names a scene by its position.** `meta.music.sync` is `{ scene, at }`, `scene`
  being an index (`storyboard.ts`, `MetaSchema`). Insert a scene before it and the music silently
  syncs on another one.
- **The check does not check the music.** `omni pitch check` only refuses a sync point past the end
  of its scene (`check.ts`, `syncErrors`). A sync that would start the video before the track
  begins is clamped to the track's start by `audioOf` without a word, and a track that ends before
  the video is not seen.

## Solution

Every new storyboard field is optional in storyboard version 1: a storyboard written today passes
`omni pitch check` with the same findings and renders, its music then landing on the track's
strongest measured rise instead of its 8th second (see **Risks**). Products whose Pitch settings ask
for no music (`music.provider: none`, the default) see no change at all: no question, no download,
no measure.

### 1. Scene ids and the sync point

- Every scene takes an optional `id`: lower-case letters, digits and hyphens, 1 to 32 characters.
  Two scenes with the same id are refused by the schema, naming both paths.
- `meta.music` becomes `{ track?, sync? }`:
  - `sync` is `{ scene, at, cue? }`. `scene` is a scene's `id` (a string) or, as today, its index
    (a number), which the check warns about. `at` is seconds into that scene, as today. `cue` is
    seconds into the track, at least 0: the moment of the track that plays at `at`.
  - `track` is the title of a track the music provider offers (see 3). A provider that offers no
    choice ignores it.
- With a `sync` and no `cue`, the cue is the track's strongest measured rise (see 2); a track with no
  rise starts with the video.
- The track starts `cue − (the scene's start + at)` seconds into itself, recomputed on every render
  from the scenes' durations and transitions, so lengthening a scene keeps the music on its moment.
  The check and the render place the scenes with one shared function, the engine's own timeline, so
  they never disagree.
- `TRACK_KEY_SECONDS` goes away.

### 2. Measuring a track

`kit/lib/pitch/energy.ts`, pure, the method of `vertuoza/release-videos` (`scripts/probe.ts`,
`probeAudio`):

- **Input:** the track decoded by ffmpeg into mono 16-bit samples at 8 kHz.
- **Energy:** the mean power of every 50 ms window, in dB.
- **A rise:** a point where the next second is at least 3 dB louder than the 4 seconds before it, the
  strongest within 8 seconds either side kept. A **fall** is the same, quieter.
- **The output:** the track's length; its rises and falls, each `{ at, db }`, rounded to 0.01 s and
  0.1 dB; and its energy in 2-second blocks.

### 3. Choosing the track: `omni pitch music`

A new verb of `omni pitch`, beside `start`, `film`, `check`, `render` and `studio`:

```text
omni pitch music <dir> --list [--mood <mood>]
omni pitch music <dir> [--track <title>]
```

- **The music provider gains an optional `list({ mood, seconds })`**, returning candidates
  `{ title, seconds, url }`, and `pick` takes an optional `track`. Only `freepd` lists: the mood's
  pinned tracks whose length covers the video, else its longest, each with its archive address. Its
  `pick` with a `track` takes that title from any mood of the pinned list, and refuses a title the
  list does not hold, naming the mood's titles.
- **`--list`** prints the candidates for the settings' mood (or `--mood`) and the storyboard's
  longest length, one line each: `<n>. <title> · <m:ss> · <url>`. A mood the provider does not know
  exits 1 naming the moods it knows. A provider that does not list (`file`, `none`) prints one line,
  `no choice: the settings' music is <provider>`, and exits 0.
- **Without `--list`,** the verb picks the track (the `--track` title, else the storyboard's
  `meta.music.track`, else the provider's own pick), writes it as `music.<ext>` in the run folder,
  measures it, writes `music.json`, and prints the track, its length, its energy blocks, its rises
  and its falls.
  - With the settings' provider `none`, it prints `no music: the settings ask for none`, writes
    nothing and exits 0.
  - A download that fails exits 1 with the provider's reason; ffmpeg missing or failing exits 1 with
    why. Nothing falls back to silence here: the person is choosing.
- **`music.json`:** `{ "music": 1, "provider", "track", "file", "seconds", "licence", "credit",
  "rises", "falls", "energy" }`, `track` being the title for a provider that lists, the uploaded
  file's asset name for `file`.

### 4. The check

`omni pitch check <dir>` reads `music.json` when the run folder holds one, and `settings.json` as the
run holds it.

- **Errors:**
  - `meta.music.sync.scene` names an id no scene has, or an index past the last scene;
  - the sync starts the video before the track begins (a start below 0): "pick a later rise or a
    later scene", naming the start;
  - a sync point past the end of its scene, as today.
- **Warnings:**
  - the track ends before the video, naming by how many seconds;
  - `cue` is more than 0.5 s from every measured rise;
  - the track has no measured rise: the music starts with the video;
  - `meta.music.sync.scene` is an index: name the scene by its id;
  - `music.json` describes another provider or track than the settings and the storyboard name: run
    `omni pitch music` again.
- Without `music.json`, only the ids and the scene of the sync are checked, so a run that has not
  chosen its music yet checks as today.

### 5. The render

- `omni pitch render` uses `music.json` and its file when they match the settings' provider and the
  storyboard's `meta.music.track`. Otherwise it picks the track through the provider, as today, and
  measures it itself, then says in one line on stderr which track it took and how to choose another
  (`omni pitch music <dir> --list`).
- The track starts where **Scene ids and the sync point** says. A start below 0 (a check error
  ignored) is clamped to 0 with one line on stderr.
- `pitch.json` records the track's title (or asset name), its cue and its start beside the provider,
  licence and credit it records today.
- A track that cannot be had still falls back to silence with one line, as today.

### 6. The skill

`kit/plugin/skills/pitch/SKILL.md` gains a music step, between writing the storyboard and checking
it, run only when the settings' music provider is not `none`:

1. Give the storyboard's scenes their ids, at least the one the music syncs on.
2. `omni pitch music <dir> --list`. When it lists tracks, show them to the person as numbered lines,
   each with its title, length and link, and ask: "Listen to these and pick one by its number, or
   name another mood". Never pick for the person: an agent cannot hear a track. Another mood lists
   again with `--mood`.
3. `omni pitch music <dir> --track "<title>"` (without `--track` when nothing was listed), then write
   the title as `meta.music.track`.
4. Pick the cue from the measured rises: the strongest rise that starts the video at or after the
   track's beginning and lets the track last to the video's end, preferring one with no fall
   between it and the video's end. Sync it on the scene that matters most (the before/after wipe,
   or the first reveal of the feature), `at` the moment of that reveal. Say in one line which track,
   which rise and which scene.
5. Check, as today: the music's errors are fixed in the storyboard (a later rise, a later scene).

## Decisions

- **Three PRDs, this one second** (asked, in PRD 2030's brainstorm): scenes (PRD 2030), music (this
  one), media the person brings (later). This one does not depend on PRD 2030.
- **The person hears the tracks through links** (asked, over previews of the video under each track,
  or a player in the studio): no new rendering and no new interface; the archive's links play in
  any browser.
- **Tracks of the product's mood** (asked, over every mood or a larger pinned list): the mood setting
  keeps its meaning, the person can ask for another, and the catalogue stays as it is.
- **The skill picks the rise by a rule, and says so** (asked, over asking the person which rise): a
  list of seconds cannot be judged without listening with a stopwatch; the render without a cue
  takes the strongest rise too, never an assumed second.
- **One verb measures, the check and the render reuse it** (approved with the design, over measuring
  in the render only or pinning measurements in the catalogue): the check can catch a bad sync
  before any render, the skill sees the rises, and an uploaded track is measured the same way as a
  catalogue one.
- **Scene ids, the index still read** (approved with the design): a storyboard written today keeps
  working; the check nudges towards ids.
- **The method of `release-videos`** (taken here, approved with the design): its windows, thresholds
  and spacing are the ones PRD 1108's inspiration already uses on real launch videos.
- **No music, no change** (taken here, approved with the design): the step, the question and the
  download only happen when the product's settings ask for music.
- **The voice's objection** (persona:B-E DEv, "Syncing a soundtrack to a drop is polish on a tool I
  already find a gimmick; if it adds a download and a question to every pitch, it is more fluff in
  my way"): settled `none`, the design approved without answering it. The design already adds
  nothing to a product whose settings ask for no music.
- **Proof video** (asked): yes.

## User stories

- As the person making a pitch, I hear three or four tracks of my product's mood and pick the one
  that fits, by its number.
- As the person making a pitch, the music's rise lands on the moment the feature is revealed, and
  stays there when I lengthen a scene.
- As the person making a pitch, `omni pitch check` tells me before rendering when my music would
  start after the video or end before it.
- As the person making a pitch, I name the scene the music syncs on, and adding a scene before it
  does not move the music.
- As a team whose product uploaded its own track, that track is measured and synced the same way,
  without a question.
- As a team whose product asks for no music, nothing about making a pitch changes.

## Scope

**In:** scene ids, the `track` and `cue` fields, the energy measure, the music provider's `list` and
`pick` by title, `freepd`'s listing, `omni pitch music` with `--list`, `--mood` and `--track`,
`music.json`, the check's new errors and warnings, the render's start from the measured or written
cue, what `pitch.json` records, the skill's music step, the rebuilt `kit/dist/`.

**Out:** new music catalogues or providers, more pinned FreePD tracks, previews of the video under
each track, a player in the studio, generated music, a music field in the product's Pitch settings,
anything PRD 2030 covers (accent words, supporting lines, step media, stats, stills), media the
person brings.

## Test seams

Following `omni kb show testing`: tests beside the code, pure units first; nothing calls the network,
GitHub or Supabase.

1. **Energy** (`kit/lib/pitch/energy.test.ts`): on generated samples, 8 s quiet then 8 s loud gives
   one rise at 8 s; a steady tone gives none; two jumps 4 s apart give one rise, the larger; a loud
   then quiet signal gives one fall; the energy blocks are 2 s each and the length is right.
2. **Storyboard** (`kit/lib/pitch/storyboard.test.ts`): an id valid and invalid; two scenes with one id
   refused with both paths; `sync.scene` as an id or an index; `cue` below 0 refused; `track`
   accepted; today's fixture storyboard parses unchanged.
3. **Check** (`kit/lib/pitch/check.test.ts`): on a written `music.json`, each new error and warning
   with its path; without one, the findings of today's fixture unchanged.
4. **Music placement** (`kit/lib/pitch/render-music.test.ts`): the start from a cue and a scene's place;
   no cue takes the strongest rise; no rise starts at 0; lengthening an earlier scene moves the start
   by the same amount; a negative start clamped with one line.
5. **Providers** (`providers/music/freepd.test.ts`, `providers/contract.test.ts`): `list` for a mood
   and a length, against the pinned list; `pick` by title from another mood; an unknown title
   refused naming the titles; `file` and `none` do not list; the provider contract with `list`
   optional.
6. **The verb** (`kit/bin/commands/pitch-make.test.ts`, or a file of its own): `--list` lines and its
   two other outcomes; a pick writing `music.json` with a faked ffmpeg and a faked network; a
   download failure exiting 1; `none` writing nothing.
7. **Render** (`kit/lib/pitch/render.test.ts`): `music.json` reused when it matches and ignored when it
   does not; `pitch.json` records track, cue and start.
8. **Bundle** (`kit/test/dist.test.ts`): `kit/dist/` matches a fresh build.

## Risks

- **What merging publishes** (`omni kb show releasing`): a kit release. `kit/dist/omni.mjs` changes
  what the one-line install hands out, and `kit/plugin/skills/pitch/SKILL.md` what the plugin
  marketplace serves. No migration, no app deploy. Rollback: revert the feature PR; a storyboard
  written with the new fields then fails the check on the old kit, naming each field, and one
  without them renders as before.
- **Music moves for every pitch with music:** a storyboard with a sync and no cue, re-rendered after
  the merge, lands on its track's strongest rise rather than its 8th second. That is the point of
  this PRD; a pitch already pushed is not touched.
- **A clash with PRD 2030:** both change `storyboard.ts`, `check.ts` and the pitch skill, in
  different fields and sections. Whichever merges second takes the other's changes in; nothing in
  one contradicts the other.
- **The archive's availability:** listing needs no network; picking downloads as today, with the same
  retries and mirrors.

## Acceptance criteria

1. A storyboard written before this PRD passes `omni pitch check` with the same findings and renders.
2. With the settings' music `freepd` and mood `upbeat`, and a 30-second storyboard,
   `omni pitch music <dir> --list` prints the upbeat tracks of the pinned list with their length and
   address, one numbered line each.
3. `omni pitch music <dir> --track "Funshine"` writes `music.mp3` and `music.json` in the run folder,
   `music.json` naming `Funshine`, its length, and its rises and falls.
4. A storyboard whose scene `"id": "wipe"` starts at 9 s, with `sync: { scene: "wipe", at: 1, cue: 14 }`,
   renders with the track starting 4 s into itself; lengthening the scene before `wipe` by 2 s makes
   it start 2 s into itself.
5. `omni pitch check` reports an error when that sync would start the video before the track begins,
   and a warning when the track ends before the video, each naming `meta.music`.
6. `omni pitch check` reports an error for `sync.scene: "wipe"` when no scene has the id `wipe`, and a
   warning for `sync.scene: 2`.
7. A storyboard with a sync and no `cue` renders with the track's strongest measured rise on the sync
   point, and the render names the track it took.
8. With the settings' music `none`, `omni pitch music <dir>` prints `no music: the settings ask for
   none` and writes nothing, and `/omni:pitch` asks no music question.
9. `/omni:pitch` with `freepd` shows the listed tracks as numbered lines with their links and waits
   for the person's pick before downloading any track.
