---
id: s1-03-stream-takes-a-timing-prop
prd: 2401
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

To put the timings at the end of a PRD's page, the page's streaming wrapper, which the plan does not list for this slice, gained one optional slot. Is that change fine?

## The decision, in plain words

The streaming wrapper of a PRD's page takes an optional timing element and draws it after the page; nothing else about it changed.

## The intro, for fun

The wrapper had a seat for everything but the clock.

## The punchline, for fun

One optional seat later, the clock sits at the back.

## The options, in plain words

A. A. An optional timing slot on the streaming wrapper (built).
B. B. Return the wrapper and the timings side by side, and change the tests that read the route's shape.

## What I had to decide

Keep the optional slot in the streaming wrapper, or move the timings into a place inside this slice's own files, which the existing tests of the route's shape would need to follow.

## What I did meanwhile

The slot is empty everywhere but on a numbered PRD's page, so nothing else changes.

## What it costs to change later

Moving it means changing tests that read the route's result by its exact shape, in files that belong to no slice of this PRD either.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The streaming wrapper is outside the territory of s1 and of every other slice of the plan (author).
