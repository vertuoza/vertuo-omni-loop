---
id: s11-03-phase-0-pr-follows-the-lifecycle
prd: 7
slice: s11
rank: medium
bears-on: none
raised: 2026-09-25
wave: 6
---

## The question, in plain words

Once the review packet for an idea is opened as a pull request, should the agent watch its checks until green, or open it and walk away?

## The decision, in plain words

It watches it like any other pull request it owns: opened as a draft, checks watched, marked ready for review once green. A person still reviews and merges it.

## The options, in plain words

A. Follow /omni:pr's lifecycle: draft, watch, ready when green (built).
B. Open it ready for review and stop, as upstream did.
C. Open it as a draft and stop, leaving ready to the reviewer.

## What I had to decide

Upstream brainstorming opened the phase-0 pull request (not as a draft) and stopped. The pr skill built in s4 says a phase-0 PR is opened by /omni:brainstorm and follows its lifecycle with labels.phase0 and prLinks.phase0; that lifecycle opens a draft, watches CI, and marks a non-feature PR ready once green.

## What I did meanwhile

Step 9 of the brainstorm skill opens the phase-0 PR through /omni:pr's lifecycle; the person reviewing sees it only once its checks are green.

## What it costs to change later

A constant: if the answer is B, step 9 opens the PR ready for review with gh pr create and stops, and the pr skill's phase-0 sentence says so.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether this repository's CI runs anything on a docs-only pull request was not checked (author).
