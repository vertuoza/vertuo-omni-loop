---
id: s1-05-guide-runner-lines
prd: 2873
slice: s1
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

May this part of the work add the three new skills to the guide's list of what a runner takes, though the guide belongs to another part of the same feature?

## The decision, in plain words

Yes: the guide's one sentence listing what a runner takes now names the three new skills too. A test holds that sentence equal to the runner's own list, so without it this part could not go green.

## The intro, for fun

The guide keeps a list, and a test checks it word for word.

## The punchline, for fun

Three new names on the door, before the sign painter arrives.

## The options, in plain words

A. A. Add the three skills to the guide's sentence here, so this part is green on its own (built).
B. B. Leave the guide to slice s2 and let this part stay red until both are merged.

## What I had to decide

The plan gives the guide to slice s2, which says runners take the ultra skills. A test of the arcade's docs holds the guide's sentence on the Runners page equal to the runner's list of skills, so adding the skills to that list here turned the preflight red. Both slices run in the same wave.

## What I did meanwhile

Added the three skills at the end of that one sentence in docs/guide/runners.md, and changed nothing else of the guide. Slice s2 may write the same sentence: the wave meets the two when it merges them.

## What it costs to change later

A constant: one sentence of the guide.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether slice s2 rewrites that sentence its own way (author): the two slices run at the same time.
