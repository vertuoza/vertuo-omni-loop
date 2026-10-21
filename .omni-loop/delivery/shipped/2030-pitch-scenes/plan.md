# Plan: Pitch scenes that tell the story — accent words, supporting lines, step media, stats, settled stills

PRD #2030, spec beside this plan (`spec.md`). The feature branch `feat/pitch-scenes` merges into `main`
with `Closes #2030`. Each slice is a sub-PR from `feat/pitch-scenes--<slice>` into `feat/pitch-scenes`,
its body opening with `Part of #2030`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s2 | A scene's still is taken 0.3 s before it starts to leave, never before its entrances, so the contact sheet and `slide.png` show every zoom, callout and wipe; the outro's reference frame is renewed | `kit/pitch-engine/timeline` `kit/pitch-engine/test/` | — | 1 |
| s3 | `statement`, `feature`, `steps`, `beforeAfter` take an `eyebrow` and a `body`, and `outro` a `body`, drawn under the title after its last word; the check warns on a body over 20 words and counts the new words in the reading time | `kit/lib/pitch/storyboard.ts` `kit/lib/pitch/storyboard.test.ts` `kit/pitch-engine/scenes.tsx` `kit/pitch-engine/layout.tsx` `kit/lib/pitch/check` | — | 1 |
| s1 | `**word**` in a title is drawn in the accent colour with the final stop, no marker on screen; the check refuses a marker left open and warns on two accents; an accented intro title gets its reference frame | `kit/pitch-engine/text` `kit/pitch-engine/words.tsx` `kit/lib/pitch/check` `kit/lib/pitch/storyboard.fixture.ts` `kit/pitch-engine/test/` | — | 2 |
| s6 | `outro.team` shows `Built by <team>` above the music's credit, each only when present and only when the settings show credits | `kit/lib/pitch/storyboard.ts` `kit/lib/pitch/storyboard.test.ts` `kit/pitch-engine/scenes.tsx` `kit/lib/pitch/render.ts` `kit/lib/pitch/render.test.ts` | — | 2 |
| s4 | A step takes a `body` and its own `media`, which rises in at the step's time; `beforeAfter.wipeAt` starts the wipe; the check finds a step's missing media file and refuses a `wipeAt` too late; a step showing its own media gets its reference frame | `kit/lib/pitch/storyboard.ts` `kit/lib/pitch/storyboard.test.ts` `kit/pitch-engine/scenes.tsx` `kit/lib/pitch/check` `kit/lib/pitch/storyboard.fixture.ts` `kit/pitch-engine/test/` | — | 3 |
| s5 | A `stats` scene shows 1 to 3 figures counting up, each with a required `source`, formatted for `meta.locale`; the stats scene gets its reference frame | `kit/lib/pitch/storyboard.ts` `kit/lib/pitch/storyboard.test.ts` `kit/pitch-engine/scenes.tsx` `kit/pitch-engine/figures` `kit/lib/pitch/check` `kit/lib/pitch/storyboard.fixture.ts` `kit/pitch-engine/test/` | — | 4 |
| s7 | `/omni:pitch` writes the new fields: the title rules with one accent, bodies, a step's own media, the "Which team built this?" question, figures only from the spec, the release note or the person, each with its source, and the new default arc | `kit/plugin/skills/pitch/` | s1, s3, s4, s5, s6 | 5 |

**Shared ground.**

- `kit/lib/pitch/storyboard.ts` and `kit/lib/pitch/storyboard.test.ts`: s3, s6, s4 and s5 each add
  fields to the schema (waves 1, 2, 3 and 4).
- `kit/pitch-engine/scenes.tsx`: s3, s6, s4 and s5 each change scene templates (waves 1, 2, 3 and 4).
- `kit/lib/pitch/check` (`check.ts` and its test): s3, s1, s4 and s5 each add findings (waves 1, 2,
  3 and 4).
- `kit/lib/pitch/storyboard.fixture.ts`: s1 accents the intro title, s4 gives a step its own media,
  s5 adds a stats scene (waves 2, 3 and 4). Each later fixture change keeps the earlier references
  matching, and s5 moves `render.test.ts`'s outro index when its scene goes in before the outro.
- `kit/pitch-engine/test/` (`render.test.ts` and `references/`): s2 renews the outro's reference, s1,
  s4 and s5 each add one (waves 1, 2, 3 and 4).
- `kit/dist/` is generated (`pnpm kit:build`): no slice lists or commits it; the wave rebuilds it.

## Per slice: done when

**s2: settled stills**

- `stillFrame` returns the frame 0.3 s before a scene's exit (the last scene: before the video's end),
  and never one before its entrances start; `timeline.test.ts` pins both.
- On a 6.5 s feature scene with a zoom at 3.2 s and a callout at 3.4 s, the still shows the zoom and
  the callout.
- The outro's reference image is renewed at its new still; the intro and feature references are
  unchanged.

**s3: supporting lines**

- The schema accepts `eyebrow` and `body` on `statement`, `feature`, `steps` and `beforeAfter`, and
  `body` on `outro`; today's fixture storyboard still parses unchanged.
- A feature with an eyebrow and a body shows both beside its media, the body arriving after the
  title's last word; in the `full` layout the body sits under the title, above the media.
- `omni pitch check` warns on a body over 20 words, and its reading-time warning counts eyebrows and
  bodies.

**s1: accent words**

- `text.ts` parses `Invoice straight from the **worksite**.` into words with accent flags and a tinted
  final stop; word counts exclude the markers.
- The intro draws "worksite" and the stop in the look's accent, with no asterisk; its new reference
  frame matches.
- `omni pitch check` reports an error naming the field for `**worksite.`, and a warning for two
  accents in one title.

**s6: the team in the outro**

- The schema accepts `outro.team`.
- The outro's credits read `Built by <team>` then the music's credit, each only when present; neither
  shows when the settings' `outro.credits` is false; `render.test.ts` pins the three cases.

**s4: steps with their own media, and the wipe's start**

- A step accepts `body` and `media`; a `steps` scene with no media at all is refused, naming it.
- A step's media rises in from its `at` and stays until the next step that brings one; its times
  count from the step's `at`; its reference frame matches.
- `beforeAfter.wipeAt: 1.8` starts the wipe 1.8 s into the scene; without it the wipe starts at 35%.
- `omni pitch check` reports a step's missing media file by its path and a `wipeAt` that leaves less
  than 1.4 s, and warns on a step body over 12 words.

**s5: the stats scene**

- The schema accepts a `stats` scene with 1 to 3 items and refuses an item without `source`, naming
  its path; `meta.locale` is optional.
- `{ value: 16790, prefix: "€" }` settles on `€16,790` with no locale and on `€16 790` with `fr`.
- The stats scene's reference frame matches, settled; every earlier reference still matches.

**s7: the skill**

- `kit/plugin/skills/pitch/SKILL.md` holds the title rules (at most 8 words, one `**accent**`, a
  finding), the body rule, steps with their own media, the team question asked once, the figures rule
  with each item's `source`, and the new default arc.
- A storyboard the skill's examples describe passes `omni pitch check`.
