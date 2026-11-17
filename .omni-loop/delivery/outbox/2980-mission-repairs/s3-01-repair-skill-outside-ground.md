---
id: s3-01-repair-skill-outside-ground
prd: 2980
slice: s3
rank: high
bears-on: none
raised: 2026-11-17
wave: 2
---

## The question, in plain words

Adding the repair skill means a few lists and tests outside this slice's own ground must name it too. May this slice change them?

## The decision, in plain words

The slice added repair to the list of skills a runner may run, in both the app and the kit, to the Engineer's starting skills in the kit, to the help table, to the tests that hold those lists equal to the database, and to the guide's Runners page. Nothing else in those files changed.

## The intro, for fun

A new name on the guest list means every doorman needs the updated sheet.

## The punchline, for fun

Nobody noticed until the bouncers disagreed.

## The options, in plain words

A. A. Keep the edits outside the slice's ground, as built.
B. B. Move each into a slice of its own and leave this slice with the skill folder only.

## What I had to decide

May the slice keep these edits outside its ground: kit/lib/runner/line.ts, kit/lib/virtual-fleet/roles.ts and its test, kit/lib/help/entries.ts and its test, apps/galaxy/src/runners/runners.contract.ts, apps/galaxy/src/runners/runners.skills.migration.test.ts, apps/galaxy/src/runners/runners.ultra-skills.migration.test.ts, apps/galaxy/src/virtual-fleets/roles-sql.test.ts, apps/galaxy/src/virtual-fleets/virtual-fleets.controller.test.ts, kit/test/repair-skill.test.ts and docs/guide/runners.md.

## What I did meanwhile

Each of these is one added word or one updated count, so the database and the app agree on repair and the tests that held them apart now hold them equal.

## What it costs to change later

Undoing it removes repair from those lists again; the skill folder then fails the help table test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan lists none of these paths in s3's territory, though the wave's note named them.

## Raised to high by the wave

Two of these files prove rules: `runners.skills.migration.test.ts` (BR-PRODUCT-140) and
`virtual-fleets.controller.test.ts` (BR-GAME-2). Each only adds `repair` to an expected list of
skills; the rules' own assertions are unchanged. A change to a rule's proof is answered by a person.
