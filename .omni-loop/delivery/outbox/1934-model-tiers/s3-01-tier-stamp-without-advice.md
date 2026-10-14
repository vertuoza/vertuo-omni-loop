---
id: s3-01-tier-stamp-without-advice
prd: 1934
slice: s3
rank: medium
bears-on: none
raised: 2026-10-14
wave: 2
---

## The question, in plain words

The spec says what a sub-PR shows when its tier has no model set, but not what it shows when the plan advised no tier at all, or when a slice was started without being told its tier.

## The decision, in plain words

A slice the plan gave no tier shows a dash and says it inherited for lack of advice. A slice started without being told its tier says it inherited because nothing was passed.

## The intro, for fun

A slice with no tier still has to say what it ran on.

## The punchline, for fun

So it owns up: no advice, same model as the terminal.

## The options, in plain words

A. Two extra reasons: no advice (with a dash for the tier) and not passed.
B. One reason for every unmapped case: no mapping.

## What I had to decide

Whether these two extra reasons on the Tier line are the words you want, or the slice should say no mapping in both cases.

## What I did meanwhile

Every sub-PR still carries a Tier line, and the wave's report reads the same reasons.

## What it costs to change later

Changing the words later is an edit to two skill texts, nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a reader of the wave's report can tell a slice with no advice from one with no mapping matters only once a later PRD tunes tiers from the stamps (author).
