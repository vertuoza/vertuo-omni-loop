---
id: s4-02-endless-waves-from-chapter-four-rows
prd: 1633
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 4
---

## The question, in plain words

The spec says the endless waves come from one fixed seed, at the last chapter's speed or above, rising slowly and never ending, but not what they are made of or how fast they may get. What should they be?

## The decision, in plain words

Each endless wave is one to three rows taken from the last chapter's own rows, drawn from the fixed seed. The speed starts just above the last chapter's fastest, rises a little every five waves and stops rising after about 150 waves, so every wave stays passable however long a run lasts.

## The intro, for fun

Endless mode needed an endless supply of trouble, and the last chapter had a full pantry.

## The punchline, for fun

So the storm keeps cooking from the same recipes, just a little faster each round.

## The options, in plain words

A. A. One to three of the last chapter's rows a wave, speed 120 rising one every five waves up to 150
B. B. The same rows, with the speed rising without a ceiling
C. C. New rows written for endless mode alone

## What I had to decide

Keep A: endless waves are built from chapter IV's rows, one to three a wave, starting at speed 120, one more every five waves, and no faster than 150; the check proves the first 200 passable from any angle. B would keep speeding up without a ceiling, which no check can prove passable forever.

## What I did meanwhile

Built as A: apps/galaxy/src/arcade/duet/waves.ts adds ENDLESS_SEED, the ENDLESS constants block, the row pool and endlessWave; duet/waves.test.ts runs waveProblems on the first 200 endless waves, chained and each from any angle.

## What it costs to change later

A constant: the numbers sit in one block and the rows in one list, so a follow-up tunes them without touching the engine; the passability test keeps any tuning honest.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether endless speed keeps rising forever or stops at a ceiling; a ceiling of 150 was chosen by eye so the check can hold.
