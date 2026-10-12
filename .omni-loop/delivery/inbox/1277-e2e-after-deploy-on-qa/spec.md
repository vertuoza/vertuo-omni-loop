---
prd: 1277
title: The e2e tests run after each deploy on QA
blocked-by: [1276]
spec: file
---

## Problem

The idea's second half is missing: once a PRD has merged, its e2e tests are only useful if they run again, on QA, after each deploy, and a mismatch is a plain failure, with no healing.

## Solution

A CI job replays the tests tagged `prd-*` with `--strict-cache` against QA after each deploy, fails on a missing or stale recording, and reports which PRD's tests failed.

## Decisions

- **A mismatch is a failure, never healed on QA.**
- **The job reads recordings from the plan repository** unless Q7 is answered otherwise.
- **Q7 — recommended default, accepted when the phase-0 PR merges:** The plan repository (vertuo-automation-plan), which starts the environment they run against. (Where do the recordings of a product spanning several repositories live?)
- **Q8 — waits on a person:** For the job after each deploy on QA: which runner (Node 24.8 or newer) and which access to the target?

## User stories

1. As QA, I learn after a deploy which PRD's behaviour changed.
2. As a maintainer, a missing recording fails the job instead of passing silently.

## Scope

In: the job definition, the runner setup, the report, the guide. Out: quarantine of unstable tests (P7), mobile (P6).

## Test seams

A fixture repository with a stale and a missing recording; the job's failure message is tested; the runner is exercised on QA once.

## Risks

The job needs a Node 24.8 runner and access to QA. A flaky target makes the job red: PRD P7 handles quarantine. Revert the PR to remove the job.

## Acceptance criteria

1. After a deploy on QA, the job replays every `prd-*` test with `--strict-cache`.
2. A recording that is missing fails the job and names the test.
3. A recording that no longer replays (`REPLAY_STALE`) fails the job and names the PRD.
4. A run with all recordings matching passes with no model call.
