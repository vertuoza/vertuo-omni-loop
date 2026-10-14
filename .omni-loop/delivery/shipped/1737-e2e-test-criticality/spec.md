---
prd: 1737
title: A test's criticality is decided by the critical flows it covers
blocked-by: none
spec: file
phase0: server
---

## Problem

Every PRD that asks for `e2e: validate` adds tests, and nothing ever says which of them deserve to run after each deploy or to block it. Roadmap #1280 would run the whole suite after each deploy on QA (#1277), add a mobile trial (#1278) and clean up unstable tests (#1279). Without a rule, the suite that blocks a deploy grows with every PRD: in two weeks it is slow, flaky and ignored. PRD #1279 retires and quarantines tests, but it does not decide which tests are worth keeping in the first place.

## Solution

A test's level, `critical` or `standard`, is decided by the critical flows of the product it covers. Each product keeps a list of its critical flows. When `/omni:validate-e2e` writes a test, it asks which flow the test covers and whether its failure breaks that flow, then classifies the test from the answers. A `critical` test runs after each deploy and blocks; a `standard` test runs at night and never blocks.

## Decisions

- **Critical means a business flow.** A test is `critical` when it covers a flow whose failure costs the business (signing in, invoicing, the main entry screen), never because of the PRD that wrote it or how fast it runs.
- **The list lives in each product.** A versioned file in the e2e folder (`<e2e.dir>/critical-flows.md`), reviewed in a pull request by QA or the product owner. Each flow has an id, a name and what its failure costs. The loop never edits it on its own: a flow the skill proposes is added in the sub-PR and a person confirms it there.
- **Two levels.** `critical` runs after each deploy on QA and blocks. `standard` runs at night and does not block. Which job runs which level is PRD #1277's work, which reads the level this PRD defines.
- **The level is declared in the test, as tags.** A test file carries `flow-<id>` when it covers a listed flow, and `critical` when its failure breaks that flow. A file with no `critical` tag is `standard`. `omni e2e status` reads the tags as it already reads `prd-<n>`.
- **The skill asks, then classifies.** For each test it writes, a manual run asks: which flow of the list does this test cover (or none), and does its failure break that flow. A flow and a breaking failure give `critical`. No flow gives `standard`. A flow the list does not hold is proposed as a new entry.
- **Under `/omni:yolo`, nothing is asked on the way.** The test enters as `standard`, and the question becomes an outbox item with its recommended answer. A person promotes the test by answering. The medium default (`standard`) is adopted, so the gate does not turn red on it.
- **A `critical` test needs a known flow.** `omni e2e status` lists each test's level and flow, and reports a `critical` test whose flow is not in the list; that stops the run as a missing recording does.
- **Out of scope.** Running tests after a deploy (#1277), the mobile trial (#1278), quarantine and retirement of tests (#1279, which will read the level). A metric of a test's cost or flakiness is not part of the level.
- **Objection from the voice, answered:** a question per test must not slow a PM who ships fast (persona:Paul - Product Manager). Under `/omni:yolo` the skill asks nothing and takes `standard`; only a hand-run skill asks.

## User stories

1. As QA, I keep one list of the flows whose failure costs us, and only tests that cover one can block a deploy.
2. As a PM, I run `/omni:yolo` and get my tests as `standard` without being asked anything; I promote one when I answer the outbox item.
3. As a developer running `/omni:validate-e2e` by hand, I am asked which flow a new test covers and the test is classified from my answer.
4. As a lead engineer, `omni e2e status` shows me each test's level and flow, so I see how many tests block a deploy.

## Scope

- The format of `<e2e.dir>/critical-flows.md` and its check.
- The `flow-<id>` and `critical` tags, read by `omni e2e status` (JSON gains `level` and `flow` per test).
- The skill's questions, its default under `/omni:yolo`, and the guide that describes both.
- Not in scope: the CI jobs, the mobile trial, quarantine and retirement, any metric.

## Test seams

- The tag reading and the level rule are pure functions next to `kit/lib/e2e/status.ts`, tested with plain strings.
- The list's parser is a pure module with its own tests.
- `omni e2e status` is tested through `main()` on a fixture repository, as `kit/test/fixture.ts` builds one.
- The skill's questions are text in the skill; they are checked by the plugin test that reads the skill, not by running a model.

## Risks

Merging publishes a new `omni e2e status` output field and new skill text: a repository that does not use e2e sees nothing. Roll back by reverting the PR; a product's `critical-flows.md` is a file it owns and stays harmless if the kit ignores it. The risk worth reading is the default: a wrong `standard` hides a flow from the blocking suite, so the list's review matters more than the code.

## Acceptance criteria

1. `omni e2e status` prints, for each tagged test, its level (`critical` or `standard`) and its flow, and a test with no `critical` tag is `standard`.
2. A test tagged `critical` whose `flow-<id>` is not in `<e2e.dir>/critical-flows.md` makes the command exit 1 and names the test and the missing flow.
3. A test tagged `critical` with no `flow-<id>` tag is refused the same way.
4. A list that does not parse (a missing id or name, an id used twice) is refused by name.
5. A hand-run `/omni:validate-e2e` asks which flow a new test covers and whether its failure breaks it; a flow and a breaking failure write `critical`, no flow writes `standard`.
6. Under `/omni:yolo` the skill writes `standard`, asks nothing, and records one medium outbox item carrying the question and its recommended answer.
7. The guide describes the list, the two tags, the two levels and who runs which level (the last pointing to PRD #1277).
