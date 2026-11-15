---
id: s5-02-feature-branches-merged-not-rebased
prd: 2896
slice: s5
rank: medium
bears-on: none
raised: 2026-11-15
wave: 5
---

## The question, in plain words

The spec says each open feature branch of the mission is rebased onto the mission branch's new tip. Should the app rewrite those branches, or bring the new tip in by merging it?

## The decision, in plain words

The app brings the new tip into each feature branch by merging it, as GitHub's Update branch does, only while that branch's head is still the one it read. Only the mission branch itself is rebased, so it stays one commit per PRD.

## The intro, for fun

Two ways to catch a moving train: jump on it, or rebuild the station beside it.

## The punchline, for fun

The app jumps on, and leaves the station standing.

## The options, in plain words

A. A. Merge the new tip into each feature branch, under the lease of its head (built).
B. B. Rebase each feature branch onto the new tip and write it with force.

## What I had to decide

Keep merging the new tip into feature branches, or ask for a true rebase of each one, with a forced write under any work still on it.

## What I did meanwhile

A feature branch whose PRD has no job running is updated by merge when it is behind; its own commits and its slices' pull requests stay as they are, and it is squashed onto the mission branch when it joins, so the merge never reaches it.

## What it costs to change later

Switching to a rebase later costs one function in the mission's keeping up and its tests; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A feature branch here holds merge commits of its slices, which a rebase through GitHub's API cannot replay one by one; the skill that looks after a pull request already merges the mission branch in on a conflict.
- (author) A feature branch whose PRD has a job running is left to that job, so no write lands under an agent at work.
