---
id: s2-01-note-step-checks-outside-ground
prd: 262
slice: s2
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

The checks that prove the two shipping skills write the release note live in the plugin's test file, which is outside the ground this slice was given. Should the slice add them there anyway?

## The decision, in plain words

Yes. The checks were added to the plugin's test file: no other slice of this wave touches it, and without them nothing would notice a later edit dropping the note step or moving it after the ship.

## The intro, for fun

The test file sat just past the fence, and the slice had a note to prove.

## The punchline, for fun

It proved it over the fence, and wrote down that it did.

## The options, in plain words

A. Add the checks to the plugin's test file, outside the slice's ground: the option built.
B. Keep to the ground: no new check, only the guards that already run on every skill.
C. Keep the checks, and widen the plan so the slice's ground names that test file.

## What I had to decide

Add the checks for the new release-note steps in `kit/test/plugin.test.mjs`, outside the slice's territory (`kit/plugin/skills/yolo/`, `kit/plugin/skills/yolo-fix/`, their porting notes and `.omni-loop/config.yml`), or keep to the territory and rely only on the guards that already run on every skill. The plan asks only that this test file pass; acceptance criterion 10 asks that the two skills write and commit the note before `omni ship`, and says each criterion becomes an ordinary test or a manual step.

## What I did meanwhile

One new block at the end of `kit/test/plugin.test.mjs`, `the release note in the skills that ship`: `/omni:yolo` step 5 names the switch, `omni kb show releasing`, `omni check releases` and the `docs(release)` commit in that order, before `omni ship` and `gh pr ready`, and its red gate names none of them; the resume pointer lands on the item that marks the PR ready; `/omni:yolo-fix` step 7 does the same and rewrites the note; neither skill restates the voice's limits; and this repository's shim prints `releaseNotes.enabled` as `true`. Nothing else outside the ground changed. PRD 216's slice s5 did the same (its item s5-01).

## What it costs to change later

Deleting one block of tests at the end of the file. Nothing depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan only asks that this test file stay green; whether leaving it out of the slice's ground was deliberate is unknown.
