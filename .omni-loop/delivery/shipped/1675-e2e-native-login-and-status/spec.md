---
prd: 1675
title: validate-e2e follows the native login and accepts a test with no agent step
blocked-by: none
spec: file
phase0: server
---

## Problem

The first real run of `/omni:validate-e2e` (PRD 180 of the plan repository, issue #1375) showed two gaps.

1. `omni e2e status` fails a test with no recording. A test made only of exact steps (`goto`, `expect`) has no agent step, so nothing is ever recorded, and the skill stops before any sub-PR. The run only went on once an `agent.act` was added for navigation.
2. The skill (step 2) and the guide ("A saved session") describe a login through `e2e.setup`, a command that writes `storage-state.json`. The run that worked used the framework's own login: `credentials` in `e2e.config.ts`, a `test.setup` that fills the form and calls `session.save`, and tests that declare `{ session: '<name>' }`. The skill neither names that path nor generates the setup.

## Solution

`omni e2e status` tells a test that expects a recording from one that cannot have one. The skill and the guide describe the native login as the way in, and the skill generates the setup when none exists.

## Decisions

- **A test is "no agent step expected" when its file holds no `agent.` call.** `omni e2e status` reads the file's text, as it already does for the `prd-<n>` tag. A test with an `agent.act` or `agent.assert` and no recording still fails. The JSON keeps `recording` as a boolean and adds `expected`. A test that fails at replay is caught by the strict replay, not by `status`.
- **The native login is the documented path.** The skill finds an existing setup (a file using `test.setup`) and makes each generated test depend on its session. When none exists it writes one for a classic form, asking only for the account and the names of the environment variables that hold it, never a password.
- **`e2e.setup` stays as a secondary path** for a login a person completes by hand, marked as not verified until it is tried.
- **`omni e2e guard` keeps its rules.** It already refuses `storage-state.json` by name, and the framework writes none under `e2e.dir`. Its message and the guide change, not its code.
- **Objection from the voice, accepted:** a generated setup is read by the guard before the sub-PR (persona:Lead Engineer). The skill keeps step 8 (`omni e2e guard`) on the generated file; a value in clear makes it fail and no sub-PR opens.

## User stories

1. As QA, I run `/omni:validate-e2e` on a criterion that needs no model step and still get a sub-PR.
2. As QA on a classic login form, I run it with no setup in the repository and the skill writes one that signs in from environment variables.
3. As a maintainer, a test that should have a recording and has none still stops the run.

## Scope

In: `omni e2e status` and its tests; the skill's login step and its setup generation; the guide's login section and the guard's message. Out: the ephemeral environment, the roadmap's PRDs 1277 to 1279, any change to the framework.

## Test seams

`kit/lib/e2e/status.test.ts` covers a test with a recording, a test with an agent step and none, and a test with no agent step. The guard keeps its tests. The skill is checked by the next real run, not by an automated test.

## Risks

Merging publishes kit and skill text only; revert the PR to remove it. The text scan can miss an `agent` call made through an alias, so such a test would pass `status` and rely on the strict replay.

## Acceptance criteria

- `omni e2e status` exits 0 for a `prd-<n>` test whose file has no `agent.` call and no recording, and reports it as no recording expected.
- `omni e2e status` exits non-zero for a `prd-<n>` test with an `agent.act` or `agent.assert` and no recording.
- The skill's login step names `credentials`, a `test.setup` and `session.save`, and says the tests depend on `{ session: '<name>' }`.
- With no setup in `e2e.dir`, the skill writes one that reads the account from environment variables and no password into a file; `omni e2e guard` stays green on it.
- The guide's login section describes the native path first and `e2e.setup` as the secondary one.
