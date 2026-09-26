---
id: s5-02-backup-test-outside-the-slice
prd: 160
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

Keeping the crew's scores in the weekly backup broke an older test of the backup command, which this piece of work was not planned to touch. May it change there?

## The decision, in plain words

I updated that older test so it expects the scores file among the backup's files, and checks the file holds only the chosen company space's scores.

## The intro, for fun

The backup bag got a new pocket, and the old packing list only knew five.

## The punchline, for fun

The list now says six, and checks the new pocket holds nobody else's things.

## The options, in plain words

A. Update the older backup test to expect the scores file: the option built.
B. Write the scores in a backup step of their own, so the older test stays as it was.

## What I had to decide

The plan's territory for s5 names game/cli/export.mjs and game/workflow.test.mjs. The test that runs the game scripts as processes, game/cli/scripts.test.mjs, pins the export to exactly five files, so writing arcade_scores.jsonl fails it.

## What I did meanwhile

`game/cli/scripts.test.mjs` › game:export now expects six files, arcade_scores.jsonl among them, with a score in each of two workspaces and only the named one's written. The export's tables come from `backupFiles()` in `game/cli/export.mjs`, which now runs its command only as a script (the same isMain guard as game/cli/xp.mjs), so `game/workflow.test.mjs` imports it and pins arcade_scores in and player_xp out against the fake PostgREST.

## What it costs to change later

Low: one test's expected list of files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan left that test out of the slice's territory on purpose.
