---
id: s4-01-embed-job-runs-again-when-out-of-time
prd: 2728
slice: s4
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

A very large knowledge base can take longer to read into the meaning search than one background run is allowed. What should happen then?

## The decision, in plain words

The background run stops after about two and a half minutes, keeps everything it already finished, and comes back a minute later to carry on with what is left.

## The intro, for fun

Two thousand rules walk into a background job with four minutes on the clock.

## The punchline, for fun

It takes a breather, keeps its place, and finishes the rest after a short coffee.

## The options, in plain words

A. A. Stop after about 150 seconds, keep what is done, and run again a minute later (built).
B. B. Embed the whole pack in one run, and let the ledger retry it when the run is cut off.
C. C. Split the pack into one job per batch of 64 from the start.

## What I had to decide

Whether a large pack is embedded over several short runs (as built), or the run is given more time.

## What I did meanwhile

A pack of a few hundred entries finishes in one run; only a pack of thousands takes a second or third run, a minute apart.

## What it costs to change later

Changing it is one constant (the run's time budget) in the embed job.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The 150-second budget is a guess under the worker's 240 seconds; the real speed of the model per batch is not measured yet.
