---
id: s1-01-steps-only-act
prd: 1205
slice: s1
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

When the loop's next step is only waiting, for a running check or a claim another session holds, should it still be listed among the steps to launch?

## The decision, in plain words

The list of steps to launch holds only steps that have work to start. A step that only waits is left out, and a step kept back only because every slot is full is not listed as held.

## The intro, for fun

Three slots, and one step that only waits for a check to finish.

## The punchline, for fun

Sending a helper to watch paint dry still costs the helper.

## The options, in plain words

A. A. Steps lists only steps that act; held only what a rule keeps back (built).
B. B. Steps also carries today's step when it waits, so with one slot it always equals step.
C. C. As A, and held also names each step left out because every slot is taken.

## What I had to decide

The spec says the first entry of steps is today's step with today's verdict, and that with one slot steps holds step alone. Today's step can be a wait (a check running, a claim held). Launching an agent for a wait does nothing but cost tokens, and a step already running must never be launched twice. So steps lists only act verdicts: today's step comes first whenever it acts and is not running, and with one slot steps equals [step] exactly when step acts. held lists only what one of the four rules keeps back; a step left out because every slot is taken is simply next.

## What I did meanwhile

followSteps offers act verdicts only; tested against every existing followPlan case with one slot.

## What it costs to change later

A constant: let a wait verdict through in candidatesOf and add a slot-full held line, in kit/lib/next/follow.ts. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the drive skills (slice s2) would rather see the wait in steps to set their wake; today step and verdict still carry it.
