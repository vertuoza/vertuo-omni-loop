---
id: s4-01-target-state-is-the-prds
prd: 1612
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

On the approval proof page, what state should each linked pull request in another repository show?

## The decision, in plain words

Each open one shows the state the page reads for the whole PRD, since the approved plan lives in one place; a merged one shows merged.

## The intro, for fun

Three pull requests walk into a page and ask whether they are approved.

## The punchline, for fun

The page answers once for all of them, since they share one plan.

## The options, in plain words

A. A. Each open target shows the PRD's verdict read on this page; merged shows merged.
B. B. Each target shows its own check's state, read from the check run GitHub holds for it.
C. C. Show the target pull requests with their GitHub state only (open, draft, merged), no approval state.

## What I had to decide

A target PR's own head holds no plan files: they live in the PRD's home repository. The page judges the approval once, against the head it was opened with, and each open target PR shows that verdict; merged ones say merged, closed unmerged ones are left out. Target PRs are found among the product's other repositories, as the 50 most recent PRs whose body starts `Part of <home>#<n>`.
Decided by: Jev (hardToRevert 0.40) · agent said false

## What I did meanwhile

Built in apps/galaxy/src/dossier/attestation/attestation.service.ts (targetRows) and attestation-github.ts (targets).

## What it costs to change later

A constant: reading each target's own omni/approved check run instead is one more GitHub read per target, in the same two files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The App's check on a target PR (s3) is not built yet: how it judges a target's head may differ from the page (author).
- A PRD whose target repository is not in its product's repositories shows no target (author).
