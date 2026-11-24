---
id: s1-01-baseline-file-serializes-slices
prd: 3219
slice: s1
rank: medium
bears-on: none
raised: 2026-11-24
wave: 1
---

## The question, in plain words

The speed ratchet is one file that every page's improvement must lower. Do the page slices run one after the other, or does each page get its own baseline file?

## The decision, in plain words

The four slices run in four waves, one behind the other, because they all lower rows of the same baseline file; the pages themselves do not depend on each other.

## The intro, for fun

One ledger, four editors, one pen.

## The punchline, for fun

So they queue.

## The options, in plain words

A. A. Chain the slices on the shared baseline file (as planned)
B. B. Ask the profiler PRD for one baseline file per page, so the page slices share a wave

## What I had to decide

Taken without asking: the most reversible option, an ordering in the plan, not a change to the profiler PRD's file layout.

## What I did meanwhile

The plan chains s2, s3 and s4 for that file alone.

## What it costs to change later

Four waves instead of two; a per-page baseline file in the profiler PRD would let the page slices run together.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The profiler PRD's final file layout is not built yet (author)
