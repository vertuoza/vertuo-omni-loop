---
id: s1-02-nothing-in-progress-under-a-full-bar
prd: 315
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When every PRD has shipped, what should the line under the progress bar say?

## The decision, in plain words

It says nothing in progress. The spec only shows that line while some PRDs are still waiting or being built.

## The intro, for fun

The spec drew the bar with work still to do, never on the day it is all done.

## The punchline, for fun

A full bar now gets a quiet line under it: nothing in progress.

## The options, in plain words

A. Nothing in progress, under a full bar: the option built.
B. Zero in progress, the same shape as the line when work remains.
C. No line at all under a full bar.

## What I had to decide

What the line under the bar says once the bar is full. The spec draws it as `<n> in progress: <k> in the inbox, <m> in the outbox`, which would read `0 in progress: ` with nothing after the colon once every PRD has shipped.

## What I did meanwhile

`formatOverview` in `kit/lib/status/format.mjs` prints `nothing in progress` under a full bar, and the in-progress line names only the stages that hold a PRD. Pinned in `kit/lib/status/format.test.mjs`.

## What it costs to change later

One string in `kit/lib/status/format.mjs` and its test. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's example and the plan's checks always have something in progress, and say nothing of a full bar.
