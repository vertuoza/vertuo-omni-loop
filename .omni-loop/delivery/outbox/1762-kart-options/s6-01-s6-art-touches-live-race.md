---
id: s6-01-s6-art-touches-live-race
prd: 1762
slice: s6
rank: medium
bears-on: none
raised: 2026-10-12
wave: 4
---

## The question, in plain words

The race that is played live is started from a file the plan did not list for this slice. Should this slice touch it, or should the plan list it?

## The decision, in plain words

The slice changed two lines of the file that starts a live race: it hands the grid's lap count to the race and sends the whole-race time to the other players while the board gets the three-lap time.

## The intro, for fun

Two lines slipped over the fence of the plan.

## The punchline, for fun

The fence is now a little wider.

## The options, in plain words

A. A. Keep the two small edits and list that file in the plan for later slices
B. B. Move the wiring into a new file inside this slice and call it from the old one

## What I had to decide

Territory is a list of paths; the live race is created in kart/art.ts, which is not on the s6 row but is the only place the start's laps and the finish message can be wired. Moving them elsewhere would mean duplicating the race's creation. Built as option A: two small edits in art.ts, no other change there.

## What I did meanwhile

The slice works with the two edits in place.

## What it costs to change later

Later slices that edit art.ts may meet these two lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Why the plan row left art.ts out (author)
