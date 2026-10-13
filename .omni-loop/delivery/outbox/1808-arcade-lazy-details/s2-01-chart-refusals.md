---
id: s2-01-chart-refusals
prd: 1808
slice: s2
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The spec says who may read the star chart, but not what the game is told when someone else asks, or when the chart cannot be read.

## The decision, in plain words

A person in no workspace is refused as not allowed, and a chart that cannot be read comes back as a server failure in the game's own words. A build that has no knowledge at all says so, rather than out of reach.

## The intro, for fun

Somebody knocks on the observatory door without a crew badge.

## The punchline, for fun

We say no politely, and say sorry when the telescope is broken.

## The options, in plain words

A. A. 403 for an outsider, 500 out of reach, 'none' only without a config (as built)
B. B. 404 for an outsider, so the route does not say a chart exists
C. C. 200 with a null chart when out of reach, so the game reads one shape

## What I had to decide

Whether these answers suit the game, which reads them when the star chart opens.

## What I did meanwhile

The star chart route answers 403 to an outsider, 500 with THE STAR CHART IS OUT OF REACH when the chart or the membership cannot be read, and 'none' only when no Omni Loop config sits above the app.

## What it costs to change later

A constant per answer in one controller and its tests; the game's hook (s4) reads any non-200 as out of reach.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The out-of-reach status could as well be 503; nothing in the knowledge picks one (author)
