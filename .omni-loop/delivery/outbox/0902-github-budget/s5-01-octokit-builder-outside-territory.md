---
id: s5-01-octokit-builder-outside-territory
prd: 902
slice: s5
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

The plan gave this slice only the outbox check's folder, but the place where the GitHub App builds its connection for every check lives next to it, in the app's shared wiring. Was it right to change that shared wiring too?

## The decision, in plain words

Yes: the shared wiring now builds every connection on the shared budget, so all six of the app's jobs spend the one budget with galaxy, not only the outbox check. The change there is a few lines, and the outbox check's folder holds the tests.

## The intro, for fun

The map said stay in your room, but the light switch was in the hallway.

## The punchline, for fun

We flipped it, and every room got the same light.

## The options, in plain words

A. A. Change the shared connection builder and its wiring so every job of the app spends the shared budget (built).
B. B. Keep the change inside the outbox check's folder, for the outbox check alone, leaving the other five jobs outside the budget until a later slice.
C. C. Leave the builder as it was and only prove the client in the end-to-end test, wiring it in a later slice.

## What I had to decide

Whether the shared connection builder (outside the slice's listed territory) may be changed so every job of the app goes through the shared budget.

## What I did meanwhile

Every job of the app (outbox check, inbox check, retro, harvest, statistics, canon buttons) calls GitHub through the shared budget-aware client, at background priority.

## What it costs to change later

Reverting means building the connection without the shared fetch again: a few lines in two files, no data and no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's done-when says every Octokit the app builds goes through the client, which cannot be met inside the outbox check's folder alone; the territory row looks under-declared rather than deliberate.
