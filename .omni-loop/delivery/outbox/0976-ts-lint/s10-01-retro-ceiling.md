---
id: s10-01-retro-ceiling
prd: 976
slice: s10
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

Giving the App's test helpers their real types also removed fourteen lint findings from the retro's own tests, which belong to a later slice. The retro's counter fails unless its number goes down to match, and that counter sits outside this slice's own files: may the slice lower it?

## The decision, in plain words

The slice lowered the retro's count of lint findings by fourteen, from 438 to 424, so the counter stays exact and the full lint check passes. No retro file was changed.

## The intro, for fun

Tidying the toolbox fixed fourteen squeaks in the neighbour's workshop.

## The punchline, for fun

The neighbour's to-do list just got shorter, and nobody had to knock on the door.

## The options, in plain words

A. A. Lower the retro's ceiling to 424 in this slice, as built.
B. B. Leave the ceiling at 438 for the wave check to lower once this slice merges.
C. C. Keep the helpers loosely typed so the retro's count stays at 438, leaving those findings for the retro's slice.

## What I had to decide

Whether a lint slice may lower another area's ceiling when typing its own shared test helpers removes findings there, or must leave that area's file to its own slice.

## What I did meanwhile

The retro's ceiling reads 424. The retro's own slice, in the next wave, starts from that number and takes it to zero.

## What it costs to change later

One number in one file: putting 438 back costs nothing, but the helpers would have to lose their types again for the count to match.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives each slice one ceiling file and is silent on a slice whose shared test helpers clear findings in another area's files.
