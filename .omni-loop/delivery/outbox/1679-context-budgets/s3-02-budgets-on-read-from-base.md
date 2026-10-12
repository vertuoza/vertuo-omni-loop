---
id: s3-02-budgets-on-read-from-base
prd: 1679
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The budgets check reads whether budgets are on from the branch a pull request goes into, so the pull request that first turns budgets on gets no budgets check until it merges. Is that right?

## The decision, in plain words

The check reads whether budgets are on from the branch the pull request goes into, like the App's other checks, and measures everything else at the pull request's head.

## The intro, for fun

A switch flipped in a pull request only counts once it lands.

## The punchline, for fun

The guard starts its shift the day after it is hired.

## The options, in plain words

A. A. Read the switch from the base branch, as the outbox and approved checks read their settings.
B. B. Read the switch from the head, so the pull request that turns budgets on is checked at once.

## What I had to decide

Whether turning budgets on should take effect on the very pull request that turns it on, or only after it merges.

## What I did meanwhile

A pull request that turns budgets on, such as this repository's own, gets no omni / budgets check; every pull request after it does. Measuring, ceilings and paths are read at the head.

## What it costs to change later

Switching to the head's setting is a one-line change in the check's first step.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the App's checks also run only on pull requests into the default branch, so a sub-PR into a feature branch gets no omni / budgets either; omni check context covers it locally
