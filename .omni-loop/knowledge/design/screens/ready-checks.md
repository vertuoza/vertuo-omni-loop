---
screen: ready-checks
status: draft
kind: page
mock: ready-checks.html
implements: []
reads: []
routes: []
supersedes: null
---

## Purpose

What "ready for review" proves, for one pull request a mission marked ready: five checks in plain
labels, each opening its proof, so a reviewer trusts it without asking an engineer. Ready is never
merged: only a person merges.

## Regions

- **The title:** `PR <n> ready for review · 5 of 5 checks`.
- **The five checks:** CI green on the latest commit · full tests and lint ran · every success
  criterion has its proof · no test was loosened · the change stayed in its area; each a link to
  its evidence.
- **The line:** `Ready for review, not merged. Only a person merges.`
- **The primary action:** `Review PR <n>`.

## States

- **5 of 5:** ready.
- **A check missing:** the pull request is not marked ready; the missing check is named.

## Words

- `Ready for review`, `not merged`, `Only a person merges.`, `Review PR <n>`.

## Refusals

- No check passes on an agent's word: each one links to a run, a test or a proof.
- No "Merged" state here.

## Open questions

- Whether this opens as its own page or as a panel over `fleet-room`.
- Where the proof of a success criterion lives (a test name, a proof screenshot, a run).

## Source

/omni:think-big, concept #2800, crowned A on 2026-11-13: .omni-loop/delivery/inbox/concepts/2800-fleet-operation-room/vision.html
