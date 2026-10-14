---
id: s6-01-frost-eight-scenery-in-art-snow
prd: 1923
slice: s6
rank: medium
bears-on: none
raised: 2026-10-14
wave: 4
---

## The question, in plain words

The spec puts each circuit's scenery in the circuit register, but this step was not allowed to touch the register or the track file. Where should FROST EIGHT's trees, chalets, pylons, snowmen, signs and stands live?

## The decision, in plain words

They are drawn from fills in a new drawing file of the kart folder, placed once from a fixed seed on any circuit that has a snowy floor. Moving them into the register later is a rename, not a rebuild.

## The intro, for fun

Somebody has to decide where the snowmen stand.

## The punchline, for fun

For now they stand wherever the seed says, and they do not complain.

## The options, in plain words

A. A. Drawing code, keyed on the floor, props placed from a fixed seed (built).
B. B. Move props into FROST EIGHT's source and the register, with new prop kinds and sprites in the design package.

## What I had to decide

Keep the scenery in the drawing code keyed on the circuit having a floor, or move it into the register's scenery field once a third circuit needs its own.

## What I did meanwhile

FROST EIGHT looks as specified; COMET RING is untouched.

## What it costs to change later

A third circuit with a floor would share this look until the register carries scenery.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a third circuit is planned is not stated anywhere (author).
