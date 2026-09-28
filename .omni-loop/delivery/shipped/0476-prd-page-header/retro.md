---
prd: 476
feature-pr: 477
merge-sha: 5961854
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 476, PRD page — a pinned compact header, full-width content, readable contrast

_Dropped: it holds a word the rules refuse._

## Findings

None: nothing crossed a threshold of the rules.

## Proposed lessons

None proposed.

## Timeline

- Feature PR [#477](https://github.com/vertuoza/vertuo-omni-loop/pull/477): opened `2026-09-28T14:00:25Z`, ready `2026-09-28T14:31:05Z`, merged `2026-09-28T14:33:13Z`, 33 minutes in all.
- 2 slices; waves: 2 planned, 2 as merged; median slice: 10 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#480](https://github.com/vertuoza/vertuo-omni-loop/pull/480) | `2026-09-28T14:05:57Z` | `2026-09-28T14:13:56Z` | 8 | 1 | 1 |
| s2 | [#482](https://github.com/vertuoza/vertuo-omni-loop/pull/482) | `2026-09-28T14:17:10Z` | `2026-09-28T14:28:53Z` | 12 | 2 | 2 |

## Decisions

- Decisions: 3 raised and settled — 3 adopted, 0 agreed, 0 drifted; by rank: 3 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 2 merged sub-PRs graded against the plan — no path outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 3 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

## Churn

- 9 commits read across 2 merged pull requests: 616 lines added, 616 in the final diff, 0 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0476-prd-page-header/s1-01-faded-text-replaced.md`, `.omni-loop/delivery/outbox/0476-prd-page-header/s1-02-which-borders-stay-quiet.md`, `.omni-loop/delivery/outbox/0476-prd-page-header/s2-01-pinned-box-height-on-a-laptop.md`.

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
