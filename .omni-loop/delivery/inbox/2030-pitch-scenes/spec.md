---
prd: 2030
title: Pitch scenes that tell the story — accent words, supporting lines, step media, stats, settled stills
blocked-by: none
spec: file
proof: video
---

# Pitch scenes that tell the story

**Date:** 2026-10-15 · **PRD:** #2030 · **Follows:** PRD 1108 (Pitch studio), whose settings, providers,
filmed moments, check, studio, render and push stay. **Compared with:** `vertuoza/release-videos`, the
engine PRD 1108 names as its inspiration (its spec, "Inspired by"): the scene templates were brought
into the kit, but part of what made its videos read well was left behind. **Touches:**
`kit/lib/pitch/storyboard.ts`, `kit/lib/pitch/check.ts`, `kit/lib/pitch/render.ts`,
`kit/pitch-engine/` (text, words, scenes, timeline), its reference images, `kit/plugin/skills/pitch/SKILL.md`,
and the rebuilt `kit/dist/`. **Out of scope:** music analysis and sync (a later PRD), a pitch made from
media the person brings instead of a filmed walk-through (a later PRD), the product's Pitch settings.

## Problem

A pitch made today shows the feature, but its scenes say little and its review shows the wrong frame.
The same storyboard rendered by `vertuoza/release-videos` and by `omni pitch render --stills` shows
the gap, scene by scene:

- **No word carries the title.** A title is split on its spaces and drawn in one colour
  (`kit/pitch-engine/text.ts`, `titleWords`). `Invoice straight from the **worksite**.` renders its
  asterisks, and `omni pitch check` says nothing.
- **Scenes have no supporting line.** Only the intro takes an eyebrow; `statement` holds one sentence;
  `feature`, `steps` and `beforeAfter` hold an optional title and nothing under it
  (`kit/lib/pitch/storyboard.ts`, `SceneSchema`). Half of each frame stays empty.
- **Steps share one picture.** A step is a label and a time; the scene's one media stays on screen
  while the list moves on, so "open", "tick" and "create" all show the same screen.
- **The wipe starts where it starts.** `beforeAfter` begins its wipe at 35% of the scene
  (`kit/pitch-engine/scenes.tsx`, `WIPE_STARTS`), whatever the media shows.
- **No figures.** There is no scene for a number, even when the spec gives one.
- **The outro credits only the music.** `credits: true` shows the music provider's credit and
  nothing else (`kit/lib/pitch/render.ts`, `prepare`); the team that built the feature is never
  named, and with no music the line is empty. The outro has no line for who can use it from when.
- **The stills miss the moment.** A scene's still is taken 2.5 s after it arrives
  (`kit/pitch-engine/timeline.ts`, `stillFrame`): before a zoom at 3.2 s, before a callout at
  3.4 s, in the middle of a wipe. The skill asks the person to fix "a zoom off its element" on the
  contact sheet, but the zoom is not on it. `slide.png`, the intro's still every pushed pitch
  carries, is taken the same way.

## Solution

Every change below is an optional field of storyboard version 1, so a storyboard written today still
passes `omni pitch check` and renders as before, save its stills (taken later, as **Stills** says).

### 1. Accent words

- In any title (`intro.title`, `statement.text`, `feature.title`, `steps.title`,
  `beforeAfter.title`, `stats.title`, `outro.closing`), `**word**` or `**a few words**` marks the
  accent. The engine draws the marked words in the look's `accent` colour; a title's final full stop
  takes the accent colour too.
- `kit/pitch-engine/text.ts` parses a title into words, each with an `accent` flag, and the final
  stop; `titleWords` and `revealEnd` count words without the markers.
- `omni pitch check`: a `**` left open is an error naming the field; more than one accent in a title
  is a warning.

### 2. Supporting lines

- `statement`, `feature`, `steps`, `beforeAfter` and `stats` take an optional `eyebrow` (as the
  intro's) and an optional `body`: one plain sentence under the title, at most 20 words, drawn in
  the Text font, muted, arriving after the title's last word. `statement.text` stays its title.
- `outro` takes an optional `body`: the line under the closing that says who has it and from when
  ("Live for every customer").
- In a `feature` with the `full` layout, the body sits under the title, above the media.

### 3. Steps with their own media

- A step takes an optional `body` (at most 12 words, under its label) and an optional `media`, of the
  same shape as a scene's media, its `start`, `camera`, `callouts` and `cursor` times counted from
  the step's `at`.
- The scene's `media` becomes optional when every step brings its own; at least one of them is
  required (a refusal names the scene).
- On screen, the scene's media shows first; from a step's `at`, its own media rises in over the one
  before it and stays until the next step that brings one.

### 4. The wipe's start

- `beforeAfter` takes an optional `wipeAt`, in seconds into the scene; without it, the wipe starts at
  35% of the scene, as today. A `wipeAt` that leaves less than the wipe's 1.4 s before the scene ends
  is an error.

### 5. A stats scene

- A seventh scene type, `stats`: an optional eyebrow, title and body, and 1 to 3 `items`, each
  `{ value, prefix?, suffix?, decimals? (0 to 2), label, source }`.
- Each value counts up from 0 over 1.5 s, the items arriving one after another; the first item in
  the accent colour, the others in ink; the label under each in the Text font, upper case.
- `source` is required, and says where the figure came from: `spec`, `release` (the release note)
  or `asked` (the person gave it when the skill asked). An item without one is refused by the schema.
- Figures are formatted for `meta.locale`, an optional BCP 47 tag (`en` when absent): `16790` reads
  `16,790` in `en` and `16 790` in `fr`.

### 6. The team in the outro

- `outro` takes an optional `team`: the words after "Built by", as the person gave them.
- The credits under the outro are two lines: `Built by <team>` when the storyboard holds a team, then
  the music's credit when there is one. Both show only when the settings' `outro.credits` is true, as
  today.

### 7. Stills

- A scene's still is taken 0.3 s before it starts to leave (the last scene: 0.3 s before the video
  ends), and never before its entrances have started: once its zoom, callouts, cursor, wipe and
  count-up are done. `slide.png` and `slide-square.png` follow it.

### 8. The skill

`kit/plugin/skills/pitch/SKILL.md` writes the new fields:

- **Titles:** at most 8 words, sentence case, ending with a full stop, with exactly one `**accent**`
  on the word that carries the benefit, written as a finding ("Three clicks, **one invoice**.") and
  not a label ("Invoice creation flow"). No exclamation mark, no emoji.
- **Bodies:** one plain sentence, from the spec and the release note only.
- **Steps:** a step that shows a different moment of the walk-through brings its own media, cut from
  `walk.webm` around that moment.
- **The team:** before the outro, ask the person once: "Which team built this?". The answer, in their
  words, is `outro.team`; no answer, no team.
- **Figures:** a `stats` scene only for figures the spec or the release note states, or that the
  person gives when asked once: "Any figures to show (with where they come from)?". Each item
  records its `source`. No figure, no `stats` scene. Every other rule of "The words" stands.
- The default arc becomes: intro, at most one statement, the feature and steps scenes (most of the
  length), a `beforeAfter` when there is a visible before and after, a `stats` scene when there are
  figures, the outro.

## Decisions

- **Three PRDs, this one first** (asked): the gap with `release-videos` holds three independent
  pieces — the scenes and their review (this PRD), the music (a measured rise to sync on, tracks the
  person hears before one is picked), and media the person brings beside the filmed walk-through.
  Each gets its own brainstorm.
- **Optional fields in storyboard version 1** (asked, over a version 2 or copying the
  `release-videos` templates): nothing written today breaks, and the change stays reviewable. The
  `release-videos` templates carry one company's brand and stay out of the kit.
- **`**word**` in the title** (asked, over a separate `accent` field): the writer reads the title as
  it will look, and the check catches a marker left open.
- **The team is asked, never guessed** (asked): who built a feature is the person's to say, in their
  words; the kit holds no map of people to teams.
- **Figures from the spec, the release note or the person** (asked): each one keeps its source in the
  storyboard, and the never-invent rule holds for everything else.
- **`meta.locale` for figures** (taken here, approved with the design): a pitch in another language
  reads its numbers the way its viewers write them.
- **Stills 0.3 s before the scene leaves** (approved with the design): the still is what the review
  judges, so it shows the scene once everything in it has happened.
- **The voice's objection** (persona:F-E Developer, "every new optional field is one more
  combination of frames nobody looks at before it ships; I want each new piece pinned by a reference
  frame, not just a schema test"): settled `accepted` — three new reference frames (an accented
  title, the stats scene, a step showing its own media) beside the three that exist, and the
  outro's renewed for its new still.
- **Proof video** (asked): yes.

## User stories

- As the person making a pitch, I mark the word that carries the benefit, and the title shows it in
  our accent colour.
- As the person making a pitch, I give each scene a line that says what it shows, and each step the
  screen it is about.
- As a team that shipped a feature, I am named in the outro: the skill asks me who built it.
- As the person making a pitch, I show the figures the spec gives, or that I give, and only those.
- As the person reviewing a pitch, the contact sheet shows each scene once its zoom, callouts and
  wipe have happened, so what I fix is what viewers see.
- As a team whose pitches are not in English, the figures read the way we write them.

## Scope

**In:** the storyboard fields above and the `stats` scene, the engine's accent words, supporting lines,
step media layers, wipe start, stats template and outro lines, the later still frame, the check's new
errors and warnings, the skill's rules and its two questions, the reference images, the rebuilt
`kit/dist/`.

**Out:** music analysis, sync points by scene id and picking tracks with the person (next PRD); media the
person brings, their conversion and a tool to read their coordinates (next PRD); sources beyond the
spec and the release note other than the two questions above; the product's Pitch settings, a theme
per scene, decorations, a third font; the square video's layout.

## Test seams

Following `omni kb show testing`: tests beside the code, pure units first, nothing calls GitHub or
Supabase.

1. **Storyboard schema** (`kit/lib/pitch/storyboard.test.ts`): each new field valid and invalid, a
   `stats` item without `source` refused with its path, a `steps` scene with no media at all refused,
   and today's fixture storyboard still parsing unchanged.
2. **Check** (`kit/lib/pitch/check.test.ts`): an open `**` is an error naming the field; two accents
   warn; a `body` over 20 words and a step body over 12 warn; reading time counts the new words; a
   step's media file missing is an error; a `wipeAt` too late is an error.
3. **Engine units** (`kit/pitch-engine/text.test.ts`, `timeline.test.ts`): a title parses into words
   with their accent flags and its tinted stop, markers excluded from the word count; `stillFrame`
   falls 0.3 s before the exit, and never before the entrances; the step layer shown at a given time;
   a figure formatted for `en` and `fr`.
4. **Engine render** (`kit/pitch-engine/test/render.test.ts`): the fixture storyboard gains an
   accented intro title, a step with its own media and a stats scene; three new reference frames —
   the accented title, the stats scene settled, the step with its own media — and the outro's
   reference renewed at its new still, each within the existing tolerance.
5. **Render input** (`kit/lib/pitch/render.test.ts`): the outro's credits list `Built by <team>` then
   the music's credit, each only when present, and none when `outro.credits` is false.
6. **Bundle** (`kit/test/dist.test.ts`): `kit/dist/` matches a fresh build.

## Risks

- **What merging publishes** (`omni kb show releasing`): a kit release. `kit/dist/omni.mjs` and its
  `pitch-engine` page change what the one-line install hands out, and `kit/plugin/skills/pitch/SKILL.md`
  changes what the plugin marketplace serves. No migration, no app deploy. Rollback: revert the
  feature PR; a storyboard written with the new fields then fails the check on the old kit, naming
  each field, and a storyboard without them renders as before.
- **Stills move for every pitch:** a pitch re-rendered after the merge gets a later `slide.png`. It is
  the settled frame the review now shows; the push keeps working as is.
- **Reference images:** the outro's reference changes on purpose; any other reference that moves is a
  regression.

## Acceptance criteria

1. A storyboard written before this PRD passes `omni pitch check` with the same findings, and renders.
2. An intro titled `Invoice straight from the **worksite**.` renders "worksite" and the final stop in
   the look's accent colour, with no asterisk on screen.
3. `omni pitch check` reports an error naming the field for a title holding `**worksite.`, and a
   warning for a title with two accents.
4. A `feature` with an `eyebrow` and a `body` shows both beside its media, the body after the title's
   last word.
5. A `steps` scene whose second step brings its own media shows that media from the step's `at`, and
   the first one before it.
6. A `beforeAfter` with `wipeAt: 1.8` starts its wipe 1.8 s into the scene.
7. A `stats` scene with `{ value: 16790, prefix: "€", label: "Billed in one go", source: "spec" }`
   counts up to `€16,790` with `meta.locale` absent, and to `€16 790` with `meta.locale: "fr"`; an
   item without `source` is refused by `omni pitch check`.
8. An outro with `team: "the Invoicing team"` and music credited shows `Built by the Invoicing team`
   above the music's credit when `outro.credits` is true, and neither when it is false.
9. `omni pitch render --stills` on a feature scene with a zoom at 3.2 s and a callout at 3.4 s in a
   6.5 s scene shows the zoom and the callout on that scene's still.
10. `/omni:pitch` asks "Which team built this?" once, and writes no `stats` scene when neither the spec,
    the release note nor the person gave a figure.
