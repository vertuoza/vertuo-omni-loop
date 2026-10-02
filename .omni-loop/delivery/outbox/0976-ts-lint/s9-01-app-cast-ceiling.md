---
id: s9-01-app-cast-ceiling
prd: 976
slice: s9
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Clearing the App's lint findings also removed two type escape hatches from a test helper, and the older counter of those escape hatches fails unless its number for the App goes down to match. That counter sits outside this slice's own files: may the slice lower it?

## The decision, in plain words

The slice lowered the App's count of escape hatches by two, from 26 to 24, so the older counter stays exact and the test suite passes.

## The intro, for fun

Two escape hatches were bricked up in the App, and the building inspector wants the floor plan redrawn.

## The punchline, for fun

The plan now shows two fewer doors, and nobody has to reopen one to keep the drawing honest.

## The options, in plain words

A. Lower the App's count to 24 in this slice, as built.
B. Keep both escape hatches and leave the count at 26: the linter would then still report them, so the App's area could not reach zero.
C. Leave the count to the wave check, which lowers it once after every App slice has merged.

## What I had to decide

Whether a lint slice may lower the shared escape-hatch count of the App it clears when a fix removes one, or must keep it to stay inside its own files.

## What I did meanwhile

The App's count reads 24. Other App slices that remove escape hatches lower the same number; the wave merges them one at a time, each conflict on that one line settled by taking the lower count.

## What it costs to change later

One number in one file: putting 26 back costs nothing, but the two escape hatches would have to come back with it, and both are findings the linter refuses.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names one lint ceiling file per area and is silent on the older escape-hatch counter from PRD 942, which counts by app, not by area. (author)
