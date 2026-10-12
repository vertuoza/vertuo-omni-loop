---
id: s4-01-kart-art-takes-laps
prd: 1762
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The kart's drawing file builds the race, but the plan gives that file to a later slice. How does a single race get the player's laps and difficulty now?

## The decision, in plain words

I added two optional settings, laps and difficulty, to the one place that makes the race, and nothing else in that file changed.

## The intro, for fun

The race builder sat in a room this slice had no key to.

## The punchline, for fun

We slipped two optional notes under the door instead of moving in.

## The options, in plain words

A. A. Add the two optional settings to the race maker (built).
B. B. Pass the settings through a field of the track instead.
C. C. Wait for the slice that owns the drawing file.

## What I had to decide

A later slice may keep or move the two optional settings; removing them is a two-line change. Decided without asking: the plan lists no other way to reach the race maker from the options.

## What I did meanwhile

Single races already run the player's laps and difficulty; MULTI is untouched.

## What it costs to change later

A merge conflict is possible with the slice that owns the kart drawing file, limited to one line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the slice that owns the kart drawing file wants the two settings kept as they are (author)
