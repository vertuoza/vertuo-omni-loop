---
prd: 7
feature-pr: 12
merge-sha: merge1
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 7, Widgets that remember their colour

The delivery went as planned, and one slice ran long.

## Repositories

- acme/plan (plan repository): feature PR [#12](https://github.com/acme/plan/pull/12)
- acme/backend: feature PR [#40](https://github.com/acme/backend/pull/40)
- acme/frontend: feature PR [#50](https://github.com/acme/frontend/pull/50)
- acme/mobile: not read — the App is not installed there

## Findings

### acme/backend

#### F1 · acme/backend: Lines 5-8 of `src/store/colour.js` were rewritten again and again — `backend/churn:src/store/colour.js:5-8` · [#900](https://github.com/acme/plan/issues/900)

- **What happened:** Lines 5-8 of `src/store/colour.js`, as merged, were written and rewritten in 3 commits, in s1, s2 and s3; the rules flag a line range rewritten in 3 or more commits.
- **Proposed lesson:** Keep each slice small enough to merge within the day.
- **Kept:** Neither the knowledge nor an earlier lesson says this yet.
- **Evidence:** [b100000 (s1)](https://github.com/acme/backend/commit/b100000000000000000000000000000000000000), [b200000 (s2)](https://github.com/acme/backend/commit/b200000000000000000000000000000000000000), [b300000 (s3)](https://github.com/acme/backend/commit/b300000000000000000000000000000000000000), [`src/store/colour.js` lines 5-8, as merged](https://github.com/acme/backend/blob/head40/src/store/colour.js#L5-L8)

#### F2 · acme/backend: Slice s3 took far longer than the others — `backend/slow-slice:s3` · [#901](https://github.com/acme/plan/issues/901)

- **What happened:** Slice s3 took 120 minutes from its claim to its merge, against a median of 30 minutes; the rules flag a slice slower than 3 times the median.
- **Proposed lesson:** Keep each slice small enough to merge within the day.
- **Kept:** Neither the knowledge nor an earlier lesson says this yet.
- **Evidence:** [#43](https://github.com/acme/backend/pull/43)

## Proposed lessons

- Keep each slice small enough to merge within the day. (F1, F2)

## Timeline

### acme/plan

- Feature PR [#12](https://github.com/acme/plan/pull/12): opened `2026-09-20T09:00:00Z`, ready `2026-09-20T11:00:00Z`, merged `2026-09-20T12:00:00Z`, 180 minutes in all.
- 0 slices; waves: 3 planned, 0 as merged; median slice: not known from its claim to its merge.

### acme/backend

- Feature PR [#40](https://github.com/acme/backend/pull/40): opened `2026-09-19T09:00:00Z`, ready `2026-09-20T09:30:00Z`, merged `2026-09-20T10:00:00Z`, 1500 minutes in all.
- 3 slices; waves: 3 planned, 2 as merged; median slice: 30 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#41](https://github.com/acme/backend/pull/41) | `2026-09-19T09:10:00Z` | `2026-09-19T09:40:00Z` | 30 | 1 | 1 |
| s2 | [#42](https://github.com/acme/backend/pull/42) | `2026-09-19T09:45:00Z` | `2026-09-19T10:05:00Z` | 20 | 2 | 2 |
| s3 | [#43](https://github.com/acme/backend/pull/43) | `2026-09-19T09:46:00Z` | `2026-09-19T11:46:00Z` | 120 | 2 | 2 |

Findings: F2 · acme/backend: Slice s3 took far longer than the others · [#901](https://github.com/acme/plan/issues/901)

### acme/frontend

- Feature PR [#50](https://github.com/acme/frontend/pull/50): opened `2026-09-19T12:00:00Z`, ready: not known, merged `2026-09-20T11:00:00Z`, 1380 minutes in all.
- 1 slices; waves: 3 planned, 1 as merged; median slice: 40 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s4 | [#51](https://github.com/acme/frontend/pull/51) | `2026-09-19T12:10:00Z` | `2026-09-19T12:50:00Z` | 40 | 3 | 1 |

## Decisions

### acme/plan

- Decisions: no settled file at the merge, so no decision is counted.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 0 merged sub-PRs graded against the plan — no path outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 1 pull request; the reviews of 1 and the review threads of 1 could not be read.

### acme/backend

- Decisions: no settled file at the merge, so no decision is counted.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 0 merged sub-PRs graded against the plan — no path outside a slice’s territory; the files of 3 more sub-PRs could not be read.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once; the label events of 3 sub-PRs could not be read, so only the labels they carry now count.
- Review: 4 pull requests; the reviews of 4 and the review threads of 4 could not be read.

### acme/frontend

- Decisions: no settled file at the merge, so no decision is counted.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 0 merged sub-PRs graded against the plan — no path outside a slice’s territory; the files of 1 more sub-PR could not be read.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once; the label events of 1 sub-PR could not be read, so only the labels they carry now count.
- Review: 2 pull requests; the reviews of 2 and the review threads of 2 could not be read.

## Checks

### acme/backend

- 3 runs of 1 check on 3 commits in 3 slices, read from GitHub Actions: 0 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| unit | 3 | 0 | 0 | — | 0 |

### acme/frontend

- 1 run of 1 check on 1 commit in 1 slice, read from GitHub Actions: 0 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| unit | 1 | 0 | 0 | — | 0 |

## Churn

### acme/backend

- 3 commits read across 3 merged pull requests: 28 lines added, 20 in the final diff, 8 lines of churn.

Findings: F1 · acme/backend: Lines 5-8 of `src/store/colour.js` were rewritten again and again · [#900](https://github.com/acme/plan/issues/900)

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
