---
id: s8-03-the-model-at-day-14
prd: 72
slice: s8
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

Fourteen days after the merge, should the model rewrite the words of the whole retro, or only write about what is new?

## The decision, in plain words

The model is asked again about the whole retro, the first findings and the new ones, and its words replace the first ones. When it gives nothing back, because it is down or has no key, the words from the first look stay.

## The intro, for fun

Two weeks later the pen is handed back for a second draft.

## The punchline, for fun

If the ink has dried up, the first draft stays on the page.

## The options, in plain words

A. Ask again about the whole retro, keeping the first words when nothing comes back, the option built.
B. Ask only about the new findings, and keep the first words for the rest.
C. Do not ask the model at all the second time.

## What I had to decide

`render` takes one set of prose for the whole `retro.md`, and `retro.json` keeps no prose, so the day-14 run must either ask again about every finding or carry the merge run's prose forward. The spec only says the same steps run again.

## What I did meanwhile

The day-14 `narrate` and `guard` steps get a sheet holding both runs' findings. With no prose back, the merge run's accepted prose is used, and the day-14 record says why its own is missing.

## What it costs to change later

A constant in `retro.mjs`: which sheet the day-14 `narrate` step is given.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a reviewer wants the first look's words kept exactly as they read at the merge.
