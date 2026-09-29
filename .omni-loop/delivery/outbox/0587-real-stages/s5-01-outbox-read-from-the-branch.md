---
id: s5-01-outbox-read-from-the-branch
prd: 587
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The terminal summary tells whether a change waits for your review from what its building branch holds, not by asking GitHub. Is that fine?

## The decision, in plain words

We read it from the branch: once the final check has filed the PRD as shipped on its building branch, the change counts as waiting for you, because that step always comes right before it is marked ready.

## The intro, for fun

The summary had to guess whether the change was ready without phoning anyone.

## The punchline, for fun

It checked whether the suitcase was packed instead.

## The options, in plain words

A. A. Read it from the branch, offline: the option built.
B. B. Ask GitHub for the feature PR's draft flag, which needs the gh command and the network on every omni status.
C. C. Ask GitHub only with --fetch, and read the branch otherwise.

## What I had to decide

Whether omni status reads the outbox stage from git (the feature branch moved the PRD folder to shipped/, which omni ship does just before the feature PR is marked ready) or from GitHub's draft flag on the feature PR.

## What I did meanwhile

kit/lib/status/facts.mjs reads `ships` per feature branch (its shipped folder holds the PRD); overview.mjs counts such a PRD as outbox, and a built feature branch or one with open items as building. omni status still never calls GitHub and only touches the network with --fetch.

## What it costs to change later

A constant: facts.mjs would add one gh pr list call and overview.mjs would read its isDraft in place of `ships`. No stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A feature PR marked ready by hand without omni ship reads as building here, and one returned to draft after omni ship reads as outbox
