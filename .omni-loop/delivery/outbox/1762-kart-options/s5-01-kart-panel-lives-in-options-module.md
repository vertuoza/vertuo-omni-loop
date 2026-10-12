---
id: s5-01-kart-panel-lives-in-options-module
prd: 1762
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The new KART screen needs its place in the options panel, but the panel's moves live in a file that belongs to the first slice, not this one. Where should it go?

## The decision, in plain words

The KART lines and their moves were added to the existing options file, as a small change next to the keys, laps and difficulty lines, instead of a second copy of the panel's logic.

## The intro, for fun

The kart wants a garage, and the garage plan was drawn on the neighbour's land.

## The punchline, for fun

We put up the door where the street already had one.

## The options, in plain words

A. A. Keep it in the options file: one place for every line of the panel (built).
B. B. Move it to a file of its own, and have the options file call it.

## What I had to decide

Say whether the KART panel's logic may stay in the options file, or must move to a file of its own.

## What I did meanwhile

The KART panel works from the options file, with its tests beside the others.

## What it costs to change later

Moving it later is a rename of a few functions and a type, with the tests following.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the first slice's owner wants the panel's logic kept apart from the options file (author)
