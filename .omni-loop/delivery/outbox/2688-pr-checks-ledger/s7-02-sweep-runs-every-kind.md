---
id: s7-02-sweep-runs-every-kind
prd: 2688
slice: s7
rank: medium
bears-on: none
raised: 2026-11-10
wave: 3
---

## The question, in plain words

The quarter-hourly sweep only knew how to run the knowledge pack's work, so it would have dropped a check's work and left the check hanging. Should it run every kind of work, though its file belongs to no slice of this wave?

## The decision, in plain words

The sweep now runs every kind of work with the same handlers the webhook uses. It is a two-line change outside this slice's own files.

## The intro, for fun

The night shift only knew one machine on the factory floor.

## The punchline, for fun

Now it knows all five, so nothing waits for the morning.

## The options, in plain words

A. A. As built: the sweep runs every kind of work, changed in this slice.
B. B. Undo it here and make it a slice of its own.

## What I had to decide

Answer A to keep it in this slice (apps/omni-app/src/jobs/sweep.ts wires liveWorkers), B to move it into a slice of its own before the feature pull request is ready.

## What I did meanwhile

The sweep runs the checks' work: retries, and work whose runner died, are picked up within 15 minutes.

## What it costs to change later

B costs one more sub-pull-request for the same two lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan gave the sweep to s6, which added the delayed post only; no slice was given the sweep's handlers, and its file is outside s7's territory.
