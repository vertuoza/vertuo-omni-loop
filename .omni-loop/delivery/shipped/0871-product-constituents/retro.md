---
prd: 871
feature-pr: 874
merge-sha: 8dd18a1
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 871, Product constituents

The constituents work landed across several slices, but the database check failed the same way on every run of the first slice. Each of the three red runs stopped at the same line of `supabase/checks/constituents.sql`, with permission denied for function `constituents_of_product`, so the pushes between them did not touch the cause. Three slices also edited files outside their declared territory: a workflow file, shared kit test and client files, and a settings render test. These breaches are the familiar kind, where a plan leaves out shared files that a slice must touch.

## Findings

### F1 · Database check failed on the same permission error three times — `repeated-red:check` · [#887](https://github.com/vertuoza/vertuo-omni-loop/issues/887)

- **What happened:** The check `check` was red on 3 commits in 1 slice (s1): 3 of its 3 runs were red. The rules flag a check red on 2 or more commits, or in 2 or more slices.
- **Why it matters:** The check stopped at the same line on every commit with permission denied for function `constituents_of_product`. The role the check signs in as could not run the new function. Each new push repeated the failure without addressing it, so the time spent on red runs taught nothing new after the first one.
- **Proposed lesson:** When a slice adds a database function that a check calls under a signed-in role, grant execute on it to that role in the same change. When a check repeats the same error, fix that error before pushing again.
- **Kept:** Neither the knowledge nor earlier lessons say that a new function needs an explicit execute grant for the role the checks run under, and this blocked the slice three times.
- **Evidence:** [check on 331e710 in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/36842199431/job/110303697695), [check on d9cb54f in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/36842984528/job/110306220335), [check on cd15cf5 in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/36844170755/job/110310199164)

### F2 · First slice edited the database workflow outside its territory — `territory:s1`

- **What happened:** Slice s1 changed 1 path outside its territory and off the plan’s shared ground: `.github/workflows/supabase.yml`.
- **Why it matters:** The slice changed `.github/workflows/supabase.yml`, most likely to wire the new check into the workflow where database checks run. The plan did not declare that file, so the change fell outside the slice's territory.
- **Proposed lesson:** A plan whose slice adds a database check should list the database workflow in that slice's territory or as shared ground.
- **Evidence:** [#877](https://github.com/vertuoza/vertuo-omni-loop/pull/877/files)

### F3 · Third slice edited shared kit tests and the ask client — `territory:s3`

- **What happened:** Slice s3 changed 3 paths outside its territory and off the plan’s shared ground: `kit/bin/ask-hook.test.mjs`, `kit/lib/ask/client.mjs`, `kit/lib/help/entries.test.mjs`.
- **Why it matters:** The slice changed `kit/bin/ask-hook.test.mjs`, `kit/lib/ask/client.mjs` and `kit/lib/help/entries.test.mjs`, none of which the plan gave it. Edits outside a slice's territory can collide with parallel work.
- **Proposed lesson:** Declare shared test files and touched clients as shared ground in the plan.
- **Evidence:** [#882](https://github.com/vertuoza/vertuo-omni-loop/pull/882/files)

### F4 · Fourth slice edited a settings render test outside its territory — `territory:s4`

- **What happened:** Slice s4 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/src/jev/settings/render.test.ts`.
- **Why it matters:** The slice changed a settings render test in the app that the plan did not give it. Any other slice working on that file could have collided with this change.
- **Proposed lesson:** List the render tests a slice will update in the plan's table.
- **Evidence:** [#883](https://github.com/vertuoza/vertuo-omni-loop/pull/883/files)

## Proposed lessons

- A slice that adds a database function called by a check under a signed-in role must grant execute to that role in the same change. When a check repeats the same error, fix that error before pushing again. (F1)

## Timeline

- Feature PR [#874](https://github.com/vertuoza/vertuo-omni-loop/pull/874): opened `2026-10-01T08:31:53Z`, ready `2026-10-01T11:55:35Z`, merged `2026-10-01T12:08:56Z`, 217 minutes in all.
- 6 slices; waves: 3 planned, 4 as merged; median slice: 30 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#877](https://github.com/vertuoza/vertuo-omni-loop/pull/877) | `2026-10-01T09:09:37Z` | `2026-10-01T09:40:55Z` | 31 | 1 | 1 |
| s2 | [#881](https://github.com/vertuoza/vertuo-omni-loop/pull/881) | `2026-10-01T09:49:45Z` | `2026-10-01T10:28:26Z` | 39 | 2 | 2 |
| s3 | [#882](https://github.com/vertuoza/vertuo-omni-loop/pull/882) | `2026-10-01T09:49:54Z` | `2026-10-01T10:15:32Z` | 26 | 2 | 2 |
| s4 | [#883](https://github.com/vertuoza/vertuo-omni-loop/pull/883) | `2026-10-01T09:50:03Z` | `2026-10-01T10:23:35Z` | 34 | 2 | 2 |
| s5 | [#884](https://github.com/vertuoza/vertuo-omni-loop/pull/884) | `2026-10-01T10:32:35Z` | `2026-10-01T11:01:57Z` | 29 | 3 | 3 |
| settle | [#886](https://github.com/vertuoza/vertuo-omni-loop/pull/886) | `2026-10-01T11:22:45Z` | `2026-10-01T11:22:54Z` | 0 | — | 4 |

## Decisions

- Decisions: 9 raised and settled — 8 adopted, 1 agreed, 0 drifted; by rank: 1 high, 8 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 5 merged sub-PRs graded against the plan — 5 paths outside a slice’s territory; 1 more sub-PR names a slice the plan does not hold.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 7 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F2 · First slice edited the database workflow outside its territory; F3 · Third slice edited shared kit tests and the ask client; F4 · Fourth slice edited a settings render test outside its territory

## Checks

- 3 runs of 1 check on 3 commits in 1 slice, read from GitHub Actions: 3 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| check | 3 | 3 | 3 | s1 | 0 |

Red runs:

| red run | slice | commit | from its log |
| --- | --- | --- | --- |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/36842199431/job/110303697695) | s1 | `331e710` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/36842984528/job/110306220335) | s1 | `d9cb54f` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/36844170755/job/110310199164) | s1 | `cd15cf5` | no test named: its last lines are kept as an excerpt |

Findings: F1 · Database check failed on the same permission error three times · [#887](https://github.com/vertuoza/vertuo-omni-loop/issues/887)

## Churn

- 26 commits read across 6 merged pull requests: 4232 lines added, 4175 in the final diff, 63 lines of churn.
- Left out as generated, by `.gitattributes`: `kit/dist/omni.mjs`.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0871-product-constituents/accounts/s2.md`, `.omni-loop/delivery/outbox/0871-product-constituents/s1-01-constituents-check-in-ci.md`, `.omni-loop/delivery/outbox/0871-product-constituents/s1-02-statement-shape-and-never-numbers.md`, `.omni-loop/delivery/outbox/0871-product-constituents/s2-01-hide-never-claims.md`, `.omni-loop/delivery/outbox/0871-product-constituents/s2-02-history-times-in-utc.md`, `.omni-loop/delivery/outbox/0871-product-constituents/s3-01-constituents-call-in-shared-client.md`, `.omni-loop/delivery/outbox/0871-product-constituents/s4-01-judge-reply-always-carries-answer.md`, `.omni-loop/delivery/outbox/0871-product-constituents/s4-02-settings-test-outside-territory.md`, `.omni-loop/delivery/outbox/0871-product-constituents/s5-01-judge-asked-on-every-check.md`, `.omni-loop/delivery/outbox/0871-product-constituents/s5-02-jev-broken-without-quote-is-not-red.md`, `.omni-loop/delivery/outbox/0871-product-constituents/settled.md`.

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
