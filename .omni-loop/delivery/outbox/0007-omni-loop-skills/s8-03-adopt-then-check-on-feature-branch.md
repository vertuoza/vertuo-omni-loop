---
id: s8-03-adopt-then-check-on-feature-branch
prd: 7
slice: s8
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

After a wave merges, in which order does it accept the minor decisions and run the final checks, and where does that change go?

## The decision, in plain words

The wave first accepts the minor decisions in one change made straight on the shared feature line, then runs the full checks once over everything. One check pass then covers both the merged work and the accepted decisions.

## The options, in plain words

A. Adopt, commit on the feature branch, then check once (built).
B. Check, adopt, commit, then check again.
C. Adopt through a small sub-PR of its own.

## What I had to decide

The brief lists the full preflight and `omni check all` on the feature branch first, then adopting medium items and committing. Adopting changes settled.md and removes item files, which the outbox guard inside `omni check all` grades too.

## What I did meanwhile

Step 5 runs `omni adopt <file>` for each medium item a merged slice returned, commits once directly on the feature branch (no PR), then runs the preflight, `commands.checks` and `omni check all`, then pushes. A refused adoption stays open and is reported.

## What it costs to change later

Low: reordering is a prose edit, and the commit reverts cleanly on the feature branch.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Committing directly on the feature branch, with no sub-PR, mirrors what PRD 7's human orchestrator did after wave 2; no written rule states it. (author)
