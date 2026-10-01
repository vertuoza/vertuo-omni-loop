---
id: s5-01-fallow-skips-generated-database-types
prd: 725
slice: s5
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

The new generated description of the database repeats one shape per table, so the dead-code and copy-paste checker flags it as duplicated and unused. Should that checker leave the generated file alone?

## The decision, in plain words

The checker now treats the generated file as a starting point and skips it when looking for copy-paste, so it reports nothing on code nobody writes by hand.

## The intro, for fun

A machine wrote a very repetitive file, and another machine complained about the repetition.

## The punchline, for fun

We asked the second machine to look away politely.

## The options, in plain words

A. Skip the generated file: List it as an entry and ignore it for duplication in the checker's config. Built.
B. Grade it like any file: Remove the two lines; the feature's pull request into main fails the checker until a baseline is regenerated to absorb the file.
C. Absorb it in the baseline: Regenerate the checker's baselines on the feature branch so today's findings on the file are inherited, and new ones still count.

## What I had to decide

Whether the copy-paste and dead-code checker should skip the generated database types file, or keep grading it like hand-written code.

## What I did meanwhile

The checker skips the generated file for copy-paste, and counts it as a starting point, so the feature's pull request into main stays green on it.

## What it costs to change later

Undoing it is two lines of the checker's config; nothing else depends on them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The briefing says never add a suppression to turn a check green; skipping a generated file reads as a narrow exception, but a person should confirm it (author)
- The checker's config file sits outside this slice's territory (author)
