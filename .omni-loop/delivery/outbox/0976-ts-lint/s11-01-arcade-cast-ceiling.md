---
id: s11-01-arcade-cast-ceiling
prd: 976
slice: s11
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Clearing the arcade's lint findings also removed two type casts, and the older cast counter fails unless its number for the arcade app goes down to match. That counter sits outside this slice's own files: may the slice lower it?

## The decision, in plain words

The slice lowered the arcade app's cast count by two, from 153 to 151, so the older counter stays exact and the test suite passes.

## The intro, for fun

Two casts walked out of the arcade, and the bouncer at the door insists on updating the head count.

## The punchline, for fun

The tally now matches the room, and nobody had to sneak back in to keep the numbers tidy.

## The options, in plain words

A. A. Lower the arcade app's cast count to 151 in this slice, as built.
B. B. Keep both casts and leave the count at 153: the linter would then still report the needless one, so the arcade could not reach zero.
C. C. Leave the count to the wave check, which lowers it once after every arcade slice has merged.

## What I had to decide

Whether a lint slice may lower the shared cast count of the app it clears when a fix removes a cast, or must keep the cast to stay inside its own files.

## What I did meanwhile

The arcade app's cast count reads 151. Other arcade slices of this wave that remove casts lower the same number; the wave merges them one at a time, each conflict on that one line settled by taking the lower count.

## What it costs to change later

One number in one file: putting 153 back costs nothing, but the two casts would have to come back with it, and one of them is a finding the linter refuses.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names one lint ceiling file per area and is silent on the older cast counter from PRD 942, which counts by app, not by area. (author)
