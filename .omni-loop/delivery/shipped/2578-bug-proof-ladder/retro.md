---
prd: 2578
feature-pr: 2579
merge-sha: e92e7a5
runs: [merge, day-14]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 2578, A bug fix proves its change before and after

The delivery added a proof step to the bug fix flow and reached its goal, but the check `quick` turned red along the way. In `s4` the new `bug-fix.proof` hook site joined the flow catalog before the bug fix skill called `omni flow show` there, and before the test that counts the catalog's entries was updated. The next commit wired the skill, but the count test stayed red until a later push. The earlier red in `s2` came from an unrelated assertion in the ask wait test. Three slices also edited flow test files and the flow command outside their declared territory, which repeats a sharing pattern already on record.

## Findings

### F1 · The quick check went red in two slices — `repeated-red:quick`

- **What happened:** The check `quick` was red on 3 commits in 2 slices (s2, s4): 3 of its 12 runs were red. The rules flag a check red on 2 or more commits, or in 2 or more slices.
- **Why it matters:** Each red push of `quick` cost a full test run of several minutes. Most of the reds came from one change in `s4` that landed in pieces. The red in `s2` was an unrelated assertion about the abandoned round message.
- **Evidence:** [quick on 3b89d57 in s2](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/41477059604/job/125386387621), [quick on fe6de34 in s4](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/41486803138/job/125419712900), [quick on 0fa1f82 in s4](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/41488511694/job/125425455178)

### F2 · A new catalog entry outran its skill wiring and its count test — `failing-test:kit/lib/flow/resolve.test.ts > resolveTerritory > names every point of the catalog, with no hook where none applies` · [#2977](https://github.com/vertuoza/vertuo-omni-loop/issues/2977)

- **What happened:** The test `kit/lib/flow/resolve.test.ts > resolveTerritory > names every point of the catalog, with no hook where none applies` failed in 2 red runs, of the check `quick`, in s4. The rules flag a test failing in 2 or more runs.
- **Why it matters:** Adding `bug-fix.proof` to the flow catalog broke two guards at once: the skill did not yet call `omni flow show` at it, and `kit/lib/flow/resolve.test.ts` still expected the old count. Fixing them across separate commits kept `quick` red for two runs in `s4`.
- **Proposed lesson:** A change that adds an entry to the flow catalog also, in the same commit, makes each listed skill call `omni flow show` at that entry and updates the tests that count or enumerate the catalog, so the catalog, the skills and their guards never disagree.
- **Kept:** Neither the knowledge nor the earlier lessons say that a new flow catalog entry must land together with its skill call and its count test.
- **Evidence:** [quick on fe6de34 in s4](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/41486803138/job/125419712900), [quick on 0fa1f82 in s4](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/41488511694/job/125425455178)

### F3 · Slice s3 changed files outside its territory — `territory:s3`

- **Title:** _Dropped: it holds a digit._
- **What happened:** Slice s3 changed 1 path outside its territory and off the plan’s shared ground: `kit/lib/flow/resolve.test.ts`.
- **Why it matters:** `kit/lib/flow/resolve.test.ts` was edited by more than one slice without being declared shared ground, so the territory check flagged it.
- **Evidence:** [#2601](https://github.com/vertuoza/vertuo-omni-loop/pull/2601/files)

### F4 · Slice s4 changed files outside its territory — `territory:s4`

- **Title:** _Dropped: it holds a digit._
- **What happened:** Slice s4 changed 4 paths outside its territory and off the plan’s shared ground: `kit/bin/__snapshots__/flow.test.ts.snap`, `kit/bin/commands/flow.ts`, `kit/bin/flow.test.ts`, `kit/lib/flow/resolve.test.ts`.
- **Why it matters:** Wiring the new hook site reached `kit/bin/commands/flow.ts`, its test and its snapshot, none of which the plan gave to `s4`. The plan did not foresee that the new entry touches the flow command.
- **Evidence:** [#2603](https://github.com/vertuoza/vertuo-omni-loop/pull/2603/files)

### F5 · Slice s5 changed files outside its territory — `territory:s5`

- **Title:** _Dropped: it holds a digit._
- **What happened:** Slice s5 changed 1 path outside its territory and off the plan’s shared ground: `kit/test/plan-repo-old-way.test.ts`.
- **Why it matters:** `kit/test/plan-repo-old-way.test.ts` was changed by `s5` without the plan listing it.
- **Evidence:** [#2605](https://github.com/vertuoza/vertuo-omni-loop/pull/2605/files)

## Proposed lessons

- A change that adds an entry to the flow catalog also, in the same commit, makes each listed skill call `omni flow show` at that entry and updates the tests that count or enumerate the catalog, so the catalog, the skills and their guards never disagree. (F2, F1)

## Timeline

- Feature PR [#2579](https://github.com/vertuoza/vertuo-omni-loop/pull/2579): opened `2026-10-30T14:47:33Z`, ready `2026-11-02T19:07:21Z`, merged `2026-11-02T20:47:59Z`, 4680 minutes in all.
- 5 slices; waves: 3 planned, 3 as merged; median slice: 84 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#2599](https://github.com/vertuoza/vertuo-omni-loop/pull/2599) | `2026-11-02T14:56:24Z` | `2026-11-02T16:19:57Z` | 84 | 1 | 1 |
| s2 | [#2600](https://github.com/vertuoza/vertuo-omni-loop/pull/2600) | `2026-11-02T14:57:04Z` | `2026-11-02T16:21:02Z` | 84 | 1 | 1 |
| s3 | [#2601](https://github.com/vertuoza/vertuo-omni-loop/pull/2601) | `2026-11-02T14:57:43Z` | `2026-11-02T16:21:46Z` | 84 | 1 | 1 |
| s4 | [#2603](https://github.com/vertuoza/vertuo-omni-loop/pull/2603) | `2026-11-02T16:46:57Z` | `2026-11-02T18:16:10Z` | 89 | 2 | 2 |
| s5 | [#2605](https://github.com/vertuoza/vertuo-omni-loop/pull/2605) | `2026-11-02T18:26:48Z` | `2026-11-02T18:52:54Z` | 26 | 3 | 3 |

## Decisions

- Decisions: 1 raised and settled — 1 adopted, 0 agreed, 0 drifted; by rank: 1 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 5 merged sub-PRs graded against the plan — 6 paths outside a slice’s territory, 1 more on shared ground.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 6 pull requests — 1 review (1 by people, 0 by bots), 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F3 · Slice s3 changed files outside its territory; F4 · Slice s4 changed files outside its territory; F5 · Slice s5 changed files outside its territory

## Checks

- 60 runs of 4 checks on 12 commits in 5 slices, read from GitHub Actions: 3 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| gitleaks | 17 | 0 | 0 | — | 0 |
| open-source | 17 | 0 | 0 | — | 0 |
| quick | 12 | 3 | 3 | s2, s4 | 0 |
| settle | 14 | 0 | 0 | — | 0 |

Failing tests, as the red runs’ logs name them:

| test | red runs | checks | slices |
| --- | --- | --- | --- |
| `kit/lib/flow/resolve.test.ts > resolveTerritory > names every point of the catalog, with no hook where none applies` | 2 | quick | s4 |
| `kit/bin/ask-question.test.ts > omni ask wait > resumes to 3 when the round was abandoned meanwhile, or is not one asked here` | 1 | quick | s2 |
| `kit/test/flow-points.test.ts > the flow points, as the skills follow them > every skill the catalog lists calls omni flow show at each of its points, and passes hooks to omni flow verdict` | 1 | quick | s4 |
| `kit/test/flow-points.test.ts > the flow points, as the skills follow them > names the skill and the point when a listed skill does not call it` | 1 | quick | s4 |

Red runs:

| red run | slice | commit | from its log |
| --- | --- | --- | --- |
| [quick](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/41477059604/job/125386387621) | s2 | `3b89d57` | Vitest: 1 failed, 3066 passed, 8 skipped, 3075 total |
| [quick](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/41486803138/job/125419712900) | s4 | `fe6de34` | Vitest: 3 failed, 7888 passed, 11 skipped, 7902 total |
| [quick](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/41488511694/job/125425455178) | s4 | `0fa1f82` | Vitest: 1 failed, 7921 passed, 11 skipped, 7933 total |

Findings: F1 · The quick check went red in two slices; F2 · A new catalog entry outran its skill wiring and its count test · [#2977](https://github.com/vertuoza/vertuo-omni-loop/issues/2977)

## Churn

- 16 commits read across 5 merged pull requests: 1362 lines added, 1348 in the final diff, 15 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/2578-bug-proof-ladder/s4-01-flow-show-prints-modes-and-inputs.md`.

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.

## After merge

- No `bug` issue naming #2578 was opened within 14 days of the merge.
- 3 GitHub Actions jobs ran on the merge commit `e92e7a5`: 3 green, 0 red.
