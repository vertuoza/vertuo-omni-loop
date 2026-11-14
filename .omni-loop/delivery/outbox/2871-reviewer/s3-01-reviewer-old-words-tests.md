---
id: s3-01-reviewer-old-words-tests
prd: 2871
slice: s3
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

Giving the Reviewer its skill broke five older checks outside this slice's ground, which still expected a Reviewer with nothing to do. Should this slice have updated them?

## The decision, in plain words

Yes: the five checks now expect what the spec asks, the Reviewer working alone with its review. Only what they expect of the Reviewer changed; nothing else in them moved.

## The intro, for fun

The Reviewer got a job, and five old notes still said it was unemployed.

## The punchline, for fun

We updated its file before anyone called it a ghost hire.

## The options, in plain words

A. Keep the five updated expectations in this slice (built).
B. Move the five changes to a slice of their own, the feature staying red until it merges.

## What I had to decide

Keep the five updated checks (A), or have the wave hand them to a slice whose ground holds them (B).

## What I did meanwhile

The checks expect the new Reviewer, so the whole test run stays green with the new defaults.

## What it costs to change later

Undoing it is a revert of five test expectations, a line or two each; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for this slice named none of the five files: the Virtual Fleet drawer test, its render test, the Heroes tab's row test, the fleets database check, and the Operation room test, whose person-held seat is now a PM since the Reviewer works alone (that file is the ground of a later slice, s6, cut after this one merges) (author).
