---
id: s3-03-held-target-holds-plan-pr
prd: 2746
slice: s3
rank: medium
bears-on: none
raised: 2026-11-13
wave: 2
---

## The question, in plain words

When a feature spans several repositories and one of its pull requests waits for another to be merged and served, should the main planning pull request also stay a draft until then?

## The decision, in plain words

Yes: the waiting pull request stays a draft, the build goes on with the others, and the planning pull request waits until the waiting one is ready or merged, as it already does for a chain of pull requests merged in order.

## The intro, for fun

One train waits at the platform for the other to arrive.

## The punchline, for fun

The station master keeps the whole timetable on hold until it does.

## The options, in plain words

A. A. The planning pull request waits until every held pull request is ready or merged.
B. B. The planning pull request is marked ready anyway, with the held ones named in its body.

## What I had to decide

Whether a held pull request in one repository keeps the planning pull request a draft, or the planning pull request is marked ready around it.

## What I did meanwhile

The planning pull request stays a draft while any of its pull requests is held; the drive loop reads the hold again each tick.

## What it costs to change later

Marking the planning pull request ready around a held one later is one paragraph of the build skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the consumer stays a draft but says nothing of the planning pull request (author)
