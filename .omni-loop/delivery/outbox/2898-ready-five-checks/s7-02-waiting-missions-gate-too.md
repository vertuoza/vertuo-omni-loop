---
id: s7-02-waiting-missions-gate-too
prd: 2898
slice: s7
rank: medium
bears-on: none
raised: 2026-11-15
wave: 2
---

## The question, in plain words

With the gate set to missions only, the App checks the PRDs of running or paused missions, but a mission can also be waiting on a person. Does a waiting mission count?

## The decision, in plain words

Yes: a mission waiting on a person is still under way, so its PRD keeps its ready check. Draft, delivered and stopped missions do not count.

## The intro, for fun

The bus stopped at a red light. Is it still on its route?

## The punchline, for fun

We said yes, and kept the passengers on board.

## The options, in plain words

A. A. A running, waiting or paused mission gates its PRDs: what was built.
B. B. Only a running or paused mission does, as the spec words it; a waiting one gets no check until it runs again.

## What I had to decide

The missions table holds `draft`, `running`, `waiting`, `paused`, `delivered` and `stopped` (`20270122093000_missions.sql`). The spec says "a running or paused mission". A mission most often waits on a person while its feature PR is open, which is when the check matters, so `LIVE_MISSIONS` in `apps/omni-app/src/ready-check/store.ts` is `running`, `waiting`, `paused`. s3 decides the same for `omni ready` in `kit/lib/mission/`; the two should agree.

## What I did meanwhile

Built the store with the three states and a test pinning the query.

## What it costs to change later

One constant and one test line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the spec's "running or paused" meant to leave a waiting mission out
- (author) what s3 reads as a live mission for `omni ready`
