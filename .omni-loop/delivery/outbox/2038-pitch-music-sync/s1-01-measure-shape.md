---
id: s1-01-measure-shape
prd: 2038
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

When a track is measured, how is the loudness of a stretch of it worked out, and how are a fall and the energy written down?

## The decision, in plain words

A stretch's loudness is the average of its small slices' loudness. A fall is written as a loss below zero, and the energy as one moment and level per two seconds, like the rises.

## The intro, for fun

Every song has a loud bit; the question is how loud is loud.

## The punchline, for fun

We averaged it, and wrote the quiet parts down with a minus sign.

## The options, in plain words

A. A. Average the slices' loudness; a fall below zero; the energy as moments with a level, as built.
B. B. Take the loudness of the slices' average power, which weighs a short loud burst more; the rest as built.
C. C. Write a fall as a positive loss and the energy as a plain list of levels, one per 2 seconds; the averaging as built.

## What I had to decide

How the measure of a track (PRD 2038 s1, kit/lib/pitch/energy.ts) compares two stretches and what shape music.json will carry: a stretch's level is the mean of its 50 ms windows' dB; a fall's db is negative (the change), a rise's positive; the energy is a list of { at, db }, one per 2-second block, the last shorter when the track does not end on a block; a track's first 4 s and last 1 s hold no rise or fall, the stretches there not being whole.

## What I did meanwhile

The measure is built so; s3, s5, s6 and s7 read it. Changing any of it is one function in energy.ts and its tests, before music.json is written by anyone.

## What it costs to change later

A few lines in energy.ts and its tests, and the same in whatever slice has read the shape by then.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether release-videos averages the windows' dB or their power, and how it writes a fall: its source was not readable here, so the spec's description was followed
