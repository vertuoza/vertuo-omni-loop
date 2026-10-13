---
id: s4-01-picker-lists-runners-that-would-take-it
prd: 1830
slice: s4
rank: medium
bears-on: none
raised: 2026-10-13
wave: 2
---

## The question, in plain words

The spec says the picker lists every target the person may send to, but some of those would never pick up the job: a machine that does not hold the project, or the shared choice when every machine belongs to a team. Should the picker still show them?

## The decision, in plain words

The picker lists only machines that hold the page's project, and offers the shared choice only when a machine without a team would take it, so a job sent from it is always one some machine can run.

## The intro, for fun

A taxi rank that lists every car in town, including the ones parked in another city.

## The punchline, for fun

We only list the cars that can actually reach you.

## The options, in plain words

A. List only targets that would claim the job, and hide the button when none is left.
B. List every target the viewer may address, whether or not a runner would take it.
C. List every target, with the ones no runner would take shown disabled and saying why.

## What I had to decide

Whether Send to terminal's picker lists only targets that would claim the job (a runner holding the page's repository; Any runner only with a runner of no fleet), or every target the viewer may address, as the spec's words read literally.

## What I did meanwhile

apps/galaxy/src/runners/send/targets.ts filters the board's runners to those holding the repository (case-insensitive) and the viewer may use, lists their fleets and the runners themselves, and adds Any runner only when one of them has no fleet; with no option left, the button is not drawn. Covered by targets.test.ts.

## What it costs to change later

One filter in one pure function and its tests; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists the picker's targets by who may send, and is silent on runners that do not hold the repository; the service's claim rule (a job is claimed only by a runner holding its repository, and Any only by a runner with no fleet) is what this follows.
