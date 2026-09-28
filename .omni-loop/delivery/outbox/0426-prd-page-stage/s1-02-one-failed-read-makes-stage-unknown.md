---
id: s1-02-one-failed-read-makes-stage-unknown
prd: 426
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When GitHub answers most questions about a PRD but fails on the one that decides its stage, should the page still show a stage?

## The decision, in plain words

The page shows the stage as unknown whenever a read it needs to decide the stage failed, and still lists the links it could read. A stage already decided by a later read, like the retro, is shown.

## The intro, for fun

Half an answer from GitHub is still half a question.

## The punchline, for fun

The page would rather say it does not know than guess the wrong stage.

## The options, in plain words

A. A: unknown when a deciding read failed, links kept (built)
B. B: treat a failed read as none yet and show the stage it gives

## What I had to decide

Whether a partly read PRD shows unknown, or the stage worked out from what was read.

## What I did meanwhile

A PRD whose feature or retro read failed shows Stage unknown for up to a minute, until the next read.

## What it costs to change later

A constant: one rule in the stage function.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No figure on how often a single GitHub read fails while the others answer (author).
