---
prd: 394
feature-pr: 396
merge-sha: 254c96d
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 394, HOME hero polish — aligned, readable, alive, full screen

This delivery addressed the poster above the fold on HOME: aligning the slanted text column with the shared left edge, making the kicker readable against the purple, adding motion to the illustration, letting the top section fill a tall desktop screen, and keeping the crest close to the illustration. No findings were recorded, so no failed jobs, rewritten code or review comments were flagged as worth a closer look. Without flagged events, this retro has nothing specific to draw lessons from.

## Findings

None: nothing crossed a threshold of the rules.

## Proposed lessons

None proposed.

## Timeline

- Feature PR [#396](https://github.com/vertuoza/vertuo-omni-loop/pull/396): opened `2026-09-28T10:04:23Z`, ready `2026-09-28T10:34:07Z`, merged `2026-09-28T10:40:14Z`, 36 minutes in all.
- 3 slices; waves: 3 planned, 3 as merged; median slice: 7 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#398](https://github.com/vertuoza/vertuo-omni-loop/pull/398) | `2026-09-28T10:07:47Z` | `2026-09-28T10:14:29Z` | 7 | 1 | 1 |
| s2 | [#399](https://github.com/vertuoza/vertuo-omni-loop/pull/399) | `2026-09-28T10:16:05Z` | `2026-09-28T10:23:10Z` | 7 | 2 | 2 |
| s3 | [#401](https://github.com/vertuoza/vertuo-omni-loop/pull/401) | `2026-09-28T10:24:34Z` | `2026-09-28T10:29:55Z` | 5 | 3 | 3 |

## Decisions

- Decisions: 1 raised and settled — 1 adopted, 0 agreed, 0 drifted; by rank: 1 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 3 merged sub-PRs graded against the plan — no path outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 4 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

## Churn

- 7 commits read across 3 merged pull requests: 558 lines added, 557 in the final diff, 2 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0394-home-hero-polish/s2-01-planet-tested-without-a-browser.md`.

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
