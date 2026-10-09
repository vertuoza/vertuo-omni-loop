---
prd: 1275
title: The e2e skill is followed by /omni:yolo when the spec asks
blocked-by: [1273, 1274]
spec: file
---

## Problem

The e2e skill is a manual command. `/omni:yolo` follows `/omni:prove` by itself when a spec says `proof: video`, but nothing does the same for e2e, so each use depends on someone remembering to run it.

## Solution

A spec front-matter field asks for the e2e validation, as `proof: video` asks for the proof, and `/omni:yolo` follows `/omni:validate-e2e` once the feature PR is ready and before it reports, whatever the skill prints, without changing the PR's state. `/omni:brainstorm` asks the question when the repository has configured e2e.

## Decisions

- **The field is opt-in per PRD,** like `proof`; a repository that has not enabled e2e is never asked.
- **The run never blocks:** a ✗ or a stop line is reported, never a reason to leave the PR in draft.
- **Two questions are open and decide the rest:**
- **Q4 — waits on a person:** Who on QA confirms or rejects a healed step when it lands in the outbox?
- **Q5 — waits on a person:** Which existing e2e suites should this sit beside, and what would make QA trust it enough to keep it?

## User stories

1. As a person who writes a spec for a screen, I ask once for the e2e validation and the loop runs it.
2. As a reviewer, I find its verdict table as a sub-PR on the feature PR without having asked anyone.

## Scope

In: the front-matter field and its check, the brainstorm question, the yolo step, the guide. Out: the job on QA (P5), changes to the skill itself (P1, P2).

## Test seams

Kit tests for the front-matter check and for the `omni check inbox` refusal of an unknown value; a guard that `/omni:yolo` names the new step after the ready step.

## Risks

Each automatic run costs a model session and a few minutes. Merging publishes a field and a yolo step; revert to return to the manual command. A repository with the switch off sees no change.

## Acceptance criteria

1. A spec with the field set makes `/omni:yolo` follow `/omni:validate-e2e` after the feature PR is ready.
2. A spec without the field, or a repository with e2e off, sees no e2e step.
3. A ✗ verdict, a stop line or a failed run never changes the feature PR's draft or ready state, labels or checks.
4. `omni check inbox` refuses an unknown value of the field, naming the PRD.
