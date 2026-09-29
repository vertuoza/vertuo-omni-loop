---
id: s1-01-stage-links-same-repository
prd: 572
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When a pull request says which PRD it belongs to, should we also understand links that point at a PRD kept in another repository?

## The decision, in plain words

We only understand the short form that points at a PRD in the same repository, in any letter case. A PRD kept in another repository, as multi-repository PRDs are, gets no started or shipped event for now.

## The intro, for fun

A pull request waves at its PRD, but only if they live under the same roof.

## The punchline, for fun

Long-distance relationships are on the roadmap, not in this release.

## The options, in plain words

A. Same-repository links only (Refs #n, Closes #n), any case.
B. Also follow links that name another repository, and read the PRD issue there.
C. Same-repository links, exact case only, as the kit writes them.

## What I had to decide

Whether stage events should also follow links to a PRD issue in another repository.

## What I did meanwhile

Phase-0 and feature PRs whose PRD issue lives in another repository give no prd-started or prd-shipped row; their merges still count as pr-merged.

## What it costs to change later

A second link pattern and a gh issue view against that repository; rows already written stay valid.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often multi-repository PRDs link their phase-0 and feature PRs across repositories today (author)
