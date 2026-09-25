---
id: s5-01-in-wave-input
prd: 7
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

How does the slice builder know whether it is running on its own or as part of a wave, since that changes whether it settles routine decisions itself?

## The decision, in plain words

It is told explicitly: the wave passes a flag, and without that flag the builder assumes it runs alone and settles routine decisions on the spot.

## The options, in plain words

A. An explicit in-wave flag, absent by default so a lone run adopts, the option built.
B. An explicit adopt flag instead, off by default so nothing is adopted unless asked.
C. Infer it from context, as upstream did, with no flag at all.

## What I had to decide

The name and default of the input that switches do-work between running alone (medium items adopted with --adopt, full /omni:pr lifecycle) and running under /omni:wave (no --adopt, stop once the sub-PR is open, return the result shape). Built as `--in-wave`, absent by default.

## What I did meanwhile

Built `--in-wave` as the explicit input in kit/plugin/skills/do-work/SKILL.md; absent means alone.

## What it costs to change later

A rename of one flag in two skills (do-work and wave), no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person running do-work by hand would rather have medium items left open for review by default, as the wave does (author).
