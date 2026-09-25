---
id: s5-03-drop-model-sizing
prd: 7
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

Should the slice builder keep the upstream advice on picking a cheaper model when it hands work to helpers?

## The decision, in plain words

No: a slice is built by one agent, and the wave already runs it two levels deep, so handing work further down is not something it should do.

## The options, in plain words

A. Drop the section, the option built.
B. Keep it only for a lone run, never under a wave.
C. Keep it as upstream wrote it.

## What I had to decide

Whether to port upstream's 'Right-Size The Model (When Delegating)' section into do-work.

## What I did meanwhile

Dropped it and recorded the drop in kit/porting/plugin--do-work.md.

## What it costs to change later

Re-adding one section of prose.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a hand-run do-work on a large slice should still be allowed to delegate (author).
