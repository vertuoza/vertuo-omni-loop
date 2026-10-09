---
prd: 1274
title: Healed e2e steps are safe to accept
blocked-by: none
spec: file
---

## Problem

The idea behind the beta says a healed step never passes silently: it becomes an outbox item with before and after screenshots, and the new recording is not committed until a person confirms it. The beta of PRD 1233 does less: the item holds the action before and after in words, and the sub-PR commits every recording from the start, so a healed one counts as accepted at merge.

## Solution

A healed step's outbox item carries the before and after screenshots, taken from the framework's own artifacts. A healed recording is not committed with the rest: the sub-PR holds the recordings that are unchanged or new, and the healed ones wait for a person's confirmation, then are committed by a follow-up step.

## Decisions

- **The screenshots come from the framework's artifacts** if it keeps them for a healed step; the first slice checks this, and says so if it does not.
- **A healed recording waits outside the branch** until a person confirms; rejecting it leaves the committed recording as it was and the test red.
- **Who confirms is not decided here:** the PRD that wires this into `/omni:yolo` asks QA (Q4).

## User stories

1. As a reviewer, I see what the screen looked like before and after a healed step, not only the action's words.
2. As a maintainer, I know a healed recording is not in the repository until someone said it was wanted.

## Scope

In: screenshots in the item, holding back healed recordings, the confirm and reject commands or comments, the guide page. Out: who confirms (a QA answer), after-merge behaviour, a replay on QA.

## Test seams

Kit tests for pairing a healed step with its before and after files; a fixture repository with a changed recording; a skill guard that the sub-PR holds no healed recording.

## Risks

The framework may not keep a screenshot per step; the first slice finds out. Merging publishes a skill and command change; revert the PR to return to the beta.

## Acceptance criteria

1. A healed step's outbox item shows its before and after screenshots, or says that none was kept and why.
2. The sub-PR of a run with a healed step contains no healed recording.
3. Confirming a healed step commits its recording; rejecting it leaves the committed one and keeps the test red.
4. A later run with no screen change lists no healed step.
