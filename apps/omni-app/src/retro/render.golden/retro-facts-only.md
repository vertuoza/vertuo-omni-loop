---
prd: 7
feature-pr: 12
merge-sha: a1b2c3d
runs: [merge]
model: none
rules: 1
---

# Retro — PRD 7, Widgets that remember their colour

Facts only: no model key

## Findings

### F1 · Slice s3 took far longer than the others — `slow-slice:s3`

- **What happened:** Slice s3 took 120 minutes from its claim to its merge, against a median of 30 minutes; the rules flag a slice slower than 3 times the median.
- **Evidence:** [#15](https://github.com/acme/widgets/pull/15)

## Proposed lessons

None proposed: facts only.

## Timeline

- Feature PR [#12](https://github.com/acme/widgets/pull/12): opened `2026-09-20T09:00:00Z`, ready `2026-09-20T11:50:00Z`, merged `2026-09-20T12:00:00Z`, 180 minutes in all.
- 3 slices; waves: 2 planned, 2 as merged; median slice: 30 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#13](https://github.com/acme/widgets/pull/13) | `2026-09-20T09:10:00Z` | `2026-09-20T09:40:00Z` | 30 | 1 | 1 |
| s2 | [#14](https://github.com/acme/widgets/pull/14) | `2026-09-20T09:45:00Z` | `2026-09-20T10:05:00Z` | 20 | 2 | 2 |
| s3 | [#15](https://github.com/acme/widgets/pull/15) | `2026-09-20T09:46:00Z` | `2026-09-20T11:46:00Z` | 120 | 2 | 2 |

Findings: F1 · Slice s3 took far longer than the others

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
