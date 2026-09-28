---
id: s2-03-branch-without-shared-history-skipped
prd: 315
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When a feature branch shares no history with the main line, so the overview cannot tell what it built, should it still count its open questions?

## The decision, in plain words

No: the whole branch is skipped, the way a branch the overview cannot read is, and its PRD stays in the inbox. The overview still shows everything else.

## The intro, for fun

A branch with no common past cannot say what it changed since it left.

## The punchline, for fun

So the overview lets it sit this one out rather than guess.

## The options, in plain words

A. Skip the whole branch, its open items included: the option built.
B. Read it as not built, and still count its open items, so a PRD with open questions on such a branch shows in the outbox.

## What I had to decide

What a feature branch that cannot be compared with the base does to the counts. The spec skips a branch whose tree cannot be read, and decides built from `git diff <base>...<feature>`, which fails when the two share no commit. Its tree can still be read, so the spec's rule does not say whether its open items count.

## What I did meanwhile

`featuresOf` in `kit/lib/status/facts.mjs` reads a feature branch's built check and its open items together, and skips the branch when any of those git calls fails, so a branch with no merge base is left out like an unreadable one. Pinned in `kit/bin/status.test.mjs` with a feature branch that has no history in common with `main`, beside two remote branches that point at a file instead of a commit.

## What it costs to change later

One helper in `kit/lib/status/facts.mjs` and one test. No stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names an unreadable tree only; a feature branch cut outside the main line's history is not considered, and none of this repository's branches is one.
