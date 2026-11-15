---
id: s5-05-joins-held-while-behind
prd: 2896
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 5
---

## The question, in plain words

While the mission branch cannot follow the default branch, should a ready PRD still join it, and how close is the app's lease to git's own?

## The decision, in plain words

No PRD joins while the branch cannot follow; each waits, saying the branch must follow first, and joins once it does. The app writes the rebased branch only if its head, read again just before the write, is still the one it rebased.

## The intro, for fun

Nobody boards a train that is still looking for its track.

## The punchline, for fun

Once the track is found, everyone gets on.

## The options, in plain words

A. A. Hold every join while the branch cannot follow (built).
B. B. Let ready PRDs join a branch that lags behind.

## What I had to decide

Keep joins held while the branch cannot follow, or let PRDs join a branch that lags behind the default branch.

## What I did meanwhile

A conflict, a merge commit on the branch or a branch that moved meanwhile holds every join of that run; the rest of the mission carries on, and the next run, a minute on, reads the branch again.

## What it costs to change later

Letting joins through costs one condition in the mission's run and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) GitHub's REST API has no write that checks a branch's old head, so the lease is a read just before the forced write; only the mission's own run writes that branch, one run at a time.
- (author) The merges are made on a scratch branch named after the mission branch with --keep-up, removed at the end of each run; a deploy service watching every branch may build it.
