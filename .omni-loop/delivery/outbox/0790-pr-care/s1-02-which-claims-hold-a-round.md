---
id: s1-02-which-claims-hold-a-round
prd: 790
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

PR care must not push while a wave is building. Which unfinished pieces count as a wave still building?

## The decision, in plain words

Any piece whose pull request is still open counts, even a claim gone quiet, except one marked stuck. When the list of pieces cannot be read, PR care only reports and pushes nothing.

## The intro, for fun

Is anyone still in the kitchen?

## The punchline, for fun

If a pan is on the stove, nobody mops the floor.

## The options, in plain words

A. Open sub-PRs (in flight or stale claim) hold the round, stuck ones do not, the option built.
B. Only fresh claims hold the round; a stale claim no longer freezes it.
C. Any sub-PR not yet merged holds the round, stuck ones included.

## What I had to decide

Which board states make `omni care state` report `wave.holdsClaims: true`, and what happens when the board cannot be read.

## What I did meanwhile

in-flight and claimed-stale count as claims; stuck, merged, runnable and blocked do not; an unreadable board gives holdsClaims null, which decideRound treats as report-only.

## What it costs to change later

One set of state names in kit/bin/commands/care.mjs.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a stuck sub-PR should also freeze PR care (author)
