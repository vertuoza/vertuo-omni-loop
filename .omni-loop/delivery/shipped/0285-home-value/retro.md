---
prd: 285
feature-pr: 288
merge-sha: ce95a90
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 285, HOME, value first — agents ship, you steer

This PRD set out to rework the front page so it leads with what the loop is worth instead of how it works. The aims were a headline that states a benefit, spreads that say who gains what, direct answers to the questions each kind of reader brings, the missing promises about easy adoption, human ownership and observable steps, and plain explanations for jargon such as PRD, slice, wave and outbox. The retro recorded no findings for this delivery: no failed checks, no rewritten code and no review comments. On the evidence available, the work went through without notable friction, and there are no lessons to carry forward from it.

## Findings

None: nothing crossed a threshold of the rules.

## Proposed lessons

None proposed.

## Timeline

- Feature PR [#288](https://github.com/vertuoza/vertuo-omni-loop/pull/288): opened `2026-09-27T18:19:36Z`, ready `2026-09-28T05:01:30Z`, merged `2026-09-28T05:25:56Z`, 666 minutes in all.
- 8 slices; waves: 3 planned, 3 as merged; median slice: 6 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#307](https://github.com/vertuoza/vertuo-omni-loop/pull/307) | `2026-09-28T04:35:03Z` | `2026-09-28T04:44:04Z` | 9 | 1 | 1 |
| s2 | [#308](https://github.com/vertuoza/vertuo-omni-loop/pull/308) | `2026-09-28T04:35:11Z` | `2026-09-28T04:44:14Z` | 9 | 1 | 1 |
| s3 | [#309](https://github.com/vertuoza/vertuo-omni-loop/pull/309) | `2026-09-28T04:35:21Z` | `2026-09-28T04:44:26Z` | 9 | 1 | 1 |
| s4 | [#310](https://github.com/vertuoza/vertuo-omni-loop/pull/310) | `2026-09-28T04:46:17Z` | `2026-09-28T04:52:35Z` | 6 | 2 | 2 |
| s5 | [#311](https://github.com/vertuoza/vertuo-omni-loop/pull/311) | `2026-09-28T04:46:26Z` | `2026-09-28T04:52:42Z` | 6 | 2 | 2 |
| s6 | [#312](https://github.com/vertuoza/vertuo-omni-loop/pull/312) | `2026-09-28T04:46:34Z` | `2026-09-28T04:52:49Z` | 6 | 2 | 2 |
| s7 | [#313](https://github.com/vertuoza/vertuo-omni-loop/pull/313) | `2026-09-28T04:46:42Z` | `2026-09-28T04:52:55Z` | 6 | 2 | 2 |
| s8 | [#314](https://github.com/vertuoza/vertuo-omni-loop/pull/314) | `2026-09-28T04:53:59Z` | `2026-09-28T04:59:30Z` | 6 | 3 | 3 |

## Decisions

- Decisions: 1 raised and settled — 1 adopted, 0 agreed, 0 drifted; by rank: 1 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 8 merged sub-PRs graded against the plan — no path outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 9 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

## Churn

- 18 commits read across 8 merged pull requests: 1262 lines added, 1225 in the final diff, 37 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0285-home-value/s2-01-share-card-kicker.md`.

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
