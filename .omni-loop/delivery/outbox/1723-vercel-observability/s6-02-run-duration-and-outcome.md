---
id: s6-02-run-duration-and-outcome
prd: 1723
slice: s6
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

Each call to the App and each background job now writes one line saying how it ended and how long it took, but the spec did not say which answers count as refused or failed, nor what a job of several steps is timed by. Are the readings we picked the ones you want?

## The decision, in plain words

A call the App turns away (a wrong signature, a wrong method, a body it cannot read) is refused; an answer of the server-error kind, like a missing secret or a job that could not be sent on, is failed. A background job's duration is the time of the last step, the one that ended it, not the whole job from start to end, because each step runs separately.

## The intro, for fun

Every run now gets a stopwatch and a verdict at the finish line.

## The punchline, for fun

The stopwatch only sees the last lap, but it never lies about it.

## The options, in plain words

A. Turned-away calls are refused, server-error answers failed, a background job timed by the step that ended it (as built).
B. The same readings, but a background job timed from its first step to its end, carried from step to step.

## What I had to decide

Answer A to keep these readings, or B to time a background job from its very first step to its end.

## What I did meanwhile

Turned-away calls are written refused, server-error answers failed, and a background job's duration is that of the step that ended it.

## What it costs to change later

Changing what refused and failed mean is one small rule in one place. Timing a whole job would need its start time carried through every step, a bigger but still contained change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec asks for each run's duration in milliseconds, but a background job made of several steps runs as separate calls, so a single clock cannot see it whole.
- A job that fails and is retried writes one failed line per try, each try being a run of its own.
