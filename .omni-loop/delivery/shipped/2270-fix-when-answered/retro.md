---
prd: 2270
feature-pr: 2273
merge-sha: ad40ff6
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 2270, A runner job waiting on answers fixes by itself once they are in

The delivery made a runner job waiting on answers fix itself once the answers are in. Along the way, the `check` job failed on every commit but one, across three slices. Each failure had the same cause. The schema read step in `pnpm schemas:verify --local` refused the row a function answers in `repositories/store`, because it carried a new key, `fix_when_answered`, that the reader's parse schema did not yet accept. One slice also changed the runners service and its test, which were outside its declared territory.

## Findings

### F1 · Read schema refused the new column until late in the delivery — `repeated-red:check` · [#2295](https://github.com/vertuoza/vertuo-omni-loop/issues/2295)

- **What happened:** The check `check` was red on 5 commits in 3 slices (s1, s4, s2): 5 of its 6 runs were red. The rules flag a check red on 2 or more commits, or in 2 or more slices.
- **Why it matters:** The migration added `fix_when_answered` to the rows a repositories function returns. The reader's parse schema in `repositories/store` refuses keys it does not know, so `pnpm schemas:verify --local` failed on every commit until that schema was updated. The red check carried across three slices and hid any other failure behind the same line.
- **Proposed lesson:** When a migration adds a column to rows that a function or table returns, the slice that adds it also extends every parse schema that reads those rows, in the same change. The schema verify step refuses unknown keys, so the column and its reader must land together.
- **Kept:** Earlier lessons cover regenerating the types file and migration dating, but none says that strict reader schemas must gain a new returned column in the same slice.
- **Evidence:** [check on a15c45c in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39446738956/job/118710527471), [check on 2a5662e in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39447394025/job/118712832632), [check on c68d11a in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39449808262/job/118721288532), [check on c7707d5 in s4](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39458980232/job/118753156221), [check on 8353a4e in s2](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39460873068/job/118759693190)

### F2 · A slice edited the runners service outside its territory — `territory:s2`

- **What happened:** Slice s2 changed 2 paths outside its territory and off the plan’s shared ground: `apps/galaxy/src/runners/runners.service.test.ts`, `apps/galaxy/src/runners/runners.service.ts`.
- **Why it matters:** Changing files that no slice declared risks conflicts with the slice that owns them, and leaves the plan's map of the work inaccurate. Here the slice needed the runners service and its test to make the job row react to answers.
- **Proposed lesson:** A plan whose slices each need a central service should declare that service as shared ground, or give it to one slice that lands first.
- **Evidence:** [#2287](https://github.com/vertuoza/vertuo-omni-loop/pull/2287/files)

## Proposed lessons

- When a migration adds a column to rows that a function or table returns, the slice that adds it also extends every parse schema that reads those rows, in the same change, so the schema verify step does not stay red across slices. (F1)

## Timeline

- Feature PR [#2273](https://github.com/vertuoza/vertuo-omni-loop/pull/2273): opened `2026-10-20T14:54:28Z`, ready `2026-10-20T18:32:09Z`, merged `2026-10-20T18:45:49Z`, 231 minutes in all.
- 4 slices; waves: 2 planned, 2 as merged; median slice: 37 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#2274](https://github.com/vertuoza/vertuo-omni-loop/pull/2274) | `2026-10-20T15:02:02Z` | `2026-10-20T15:36:55Z` | 35 | 1 | 1 |
| s2 | [#2287](https://github.com/vertuoza/vertuo-omni-loop/pull/2287) | `2026-10-20T16:14:54Z` | `2026-10-20T16:51:33Z` | 37 | 2 | 2 |
| s3 | [#2288](https://github.com/vertuoza/vertuo-omni-loop/pull/2288) | `2026-10-20T16:15:14Z` | `2026-10-20T16:52:03Z` | 37 | 2 | 2 |
| s4 | [#2289](https://github.com/vertuoza/vertuo-omni-loop/pull/2289) | `2026-10-20T16:15:34Z` | `2026-10-20T16:52:39Z` | 37 | 2 | 2 |

## Decisions

- Decisions: 4 raised and settled — 4 adopted, 0 agreed, 0 drifted; by rank: 4 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 4 merged sub-PRs graded against the plan — 2 paths outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 5 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F2 · A slice edited the runners service outside its territory

## Checks

- 26 runs of 3 checks on 10 commits in 4 slices, read from GitHub Actions: 5 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| check | 6 | 5 | 5 | s1, s4, s2 | 0 |
| quick | 10 | 0 | 0 | — | 0 |
| settle | 10 | 0 | 0 | — | 0 |

Red runs:

| red run | slice | commit | from its log |
| --- | --- | --- | --- |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39446738956/job/118710527471) | s1 | `a15c45c` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39447394025/job/118712832632) | s1 | `2a5662e` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39449808262/job/118721288532) | s1 | `c68d11a` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39458980232/job/118753156221) | s4 | `c7707d5` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39460873068/job/118759693190) | s2 | `8353a4e` | no test named: its last lines are kept as an excerpt |

Findings: F1 · Read schema refused the new column until late in the delivery · [#2295](https://github.com/vertuoza/vertuo-omni-loop/issues/2295)

## Churn

- 14 commits read across 4 merged pull requests: 1418 lines added, 1398 in the final diff, 30 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/2270-fix-when-answered/s1-01-switch-owner-only.md`, `.omni-loop/delivery/outbox/2270-fix-when-answered/s1-02-sync-does-not-decide.md`, `.omni-loop/delivery/outbox/2270-fix-when-answered/s1-03-unlisted-repository-off.md`, `.omni-loop/delivery/outbox/2270-fix-when-answered/s2-01-fix-with-answers-route.md`.

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
