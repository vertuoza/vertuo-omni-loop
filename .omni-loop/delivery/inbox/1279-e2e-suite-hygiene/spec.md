---
prd: 1279
title: Hygiene of the e2e suite
blocked-by: [1277]
spec: file
---

## Problem

Every PRD adds tests to the suite and none leaves it: slow or flaky tests pile up, and a test a later PRD replaces keeps running.

## Solution

Each test is tagged with its PRD; a test that fails then passes without a code change is moved to quarantine, still run but not blocking; a PRD can retire the tests it replaces.

## Decisions

- **Quarantine is by tag,** reported but never blocking.
- **Retirement names the replacing PRD** so the removal is traceable.

## User stories

1. As QA, a flaky test stops blocking deploy reports while it is fixed.
2. As a maintainer, a replaced test leaves the suite with a record of why.

## Scope

In: the quarantine tag and report, the retirement step. Out: new tests, the job itself (P5).

## Test seams

A fixture suite with a flaky test; a quarantined test is run and reported but does not fail the job.

## Risks

A quarantined test hides a real failure if nobody reads the report; the report is part of the job's output. Revert the PR to remove quarantine.

## Acceptance criteria

1. A test marked quarantined is run, reported, and never fails the job.
2. A test that failed then passed on the same code is proposed for quarantine, not quarantined silently.
3. Retiring a test records the PRD that replaces it.
4. A retired test no longer runs.
