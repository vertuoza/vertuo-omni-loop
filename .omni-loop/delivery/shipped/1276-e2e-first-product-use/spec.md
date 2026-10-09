---
prd: 1276
title: First e2e use on a Vertuoza product
blocked-by: [1273]
spec: file
---

## Problem

The beta has only run on this repository's own galaxy. Vertuoza's products span several repositories, whose tests the idea places in the plan repository, against an environment built from the target PRs together, with a seeded QA tenant, a test account and a login Google refuses to type into an automated browser.

## Solution

The kit supports the plan-repository case: the e2e folder and recordings live in the plan repository, the target is the environment it builds, each run creates records with a name unique to the run, and a saved session signs the run in, as `/omni:prove` already does. The first real use is then done on one flow QA picks.

## Decisions

- **The work lands here only as kit support;** the first real run is done by QA in the plan repository.
- **Records get a name unique to the run** unless QA answers otherwise (Q2).
- **Q1 — waits on a person:** What are the three user flows to cover first?
- **Q2 — recommended default, accepted when the phase-0 PR merges:** Records with a name unique to each run (the idea's own answer). (Seeded QA tenant: a reset, or records with a name unique to each run?)
- **Q3 — waits on a person:** Which test account do automated runs sign in with, and how is it kept out of the code?
- **Q7 — recommended default, accepted when the phase-0 PR merges:** The plan repository (vertuo-automation-plan), which starts the environment they run against. (Where do the recordings of a product spanning several repositories live?)

## User stories

1. As QA, I run the beta on a flow I chose, in the plan repository, and get a sub-PR there.
2. As a maintainer, I know the test account's credentials never enter the code or the model's view.

## Scope

In: the plan-repository path of the skill, the unique-name rule, the saved-session login, the guide. Out: the job after deploy (P5), mobile (P6), the choice of flows and account (QA).

## Test seams

Kit tests with a fixture plan repository; a guard that the skill never writes a credential; the login is exercised once against QA by hand.

## Risks

The first run changes the shared QA tenant: unique names keep runs apart, and a person confirms the account. Merging publishes kit support only; revert the PR to remove it.

## Acceptance criteria

1. In a plan repository, the skill writes the tests and recordings there, not in a target repository.
2. Each test creates records whose name is unique to the run.
3. The run signs in from a saved session, and no credential is printed, logged or committed.
4. The skill states, in its sub-PR, which QA flow and which account the run used.
