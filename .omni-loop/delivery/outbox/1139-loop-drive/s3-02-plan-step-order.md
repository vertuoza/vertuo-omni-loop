---
id: s3-02-plan-step-order
prd: 1139
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

When two PRDs need the same files, which one goes first, and what is one step of the plan?

## The decision, in plain words

One step is one wave of one PRD, plus a last step that finishes it. The PRD with the lower number goes first, except that a PRD with a stuck slice gives way, and a PRD waiting on a person is passed over while the others carry on.

## The intro, for fun

Two PRDs reach for the same file at once.

## The punchline, for fun

The older one goes first, unless it is stuck in traffic.

## The options, in plain words

A. A. A step per wave plus a finish step; lower number first, stuck PRDs give way; parked PRDs passed over.
B. B. The PRD closest to shipping goes first in a collision.
C. C. A parked PRD holds every later step, and the loop stops at the first parked step.

## What I had to decide

The size of a step, the order between two PRDs whose slices share ground, and what the loop does with the steps of a PRD parked on a person.

## What I did meanwhile

Each PRD's waves become steps in order, then one finish step for the gate and review. Between PRDs, blockers come first, then PRDs with no stuck slice, then the lower number. A step already merged orders nothing. A parked PRD's steps are passed over, and steps that come after them wait; when nothing else can move, the loop stops and says what each PRD waits on.

## What it costs to change later

Small: the order is one sort key in the plan and one rule in following it; plans are recomputed, nothing stored needs moving.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec replaced 'closest to shipping first' with a frozen plan but did not say which PRD goes first in a collision; the lower number is a stand-in for the older PRD.
- (author) The spec says the first step not done is taken; passing over a parked PRD's steps is read from the stop rule, which needs every PRD parked or done.
