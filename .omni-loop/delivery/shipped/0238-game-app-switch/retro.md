---
prd: 238
feature-pr: 239
merge-sha: d890114
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 238, Game and app switch — one tap between the arcade and the app

This delivery aimed to join the two sides of Omni Loop with a single tap, so that the fun side and the plain reading pages each lead to the other. The counted facts hold no findings for it: no failed job, rewritten code or comment was flagged along the way. Because the record is empty, it confirms only that nothing was flagged. It does not show whether the switch works as the request intended on both a phone and a computer. That is worth checking directly rather than inferring from the absence of findings.

## Findings

None: nothing crossed a threshold of the rules.

## Proposed lessons

None proposed.

## Timeline

- Feature PR [#239](https://github.com/vertuoza/vertuo-omni-loop/pull/239): opened `2026-09-27T09:08:37Z`, ready `2026-09-27T10:53:08Z`, merged `2026-09-27T11:21:00Z`, 132 minutes in all.
- 5 slices; waves: 4 planned, 4 as merged; median slice: 23 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#241](https://github.com/vertuoza/vertuo-omni-loop/pull/241) | `2026-09-27T09:16:36Z` | `2026-09-27T09:37:26Z` | 21 | 1 | 1 |
| s2 | [#243](https://github.com/vertuoza/vertuo-omni-loop/pull/243) | `2026-09-27T09:40:11Z` | `2026-09-27T10:04:01Z` | 24 | 2 | 2 |
| s3 | [#244](https://github.com/vertuoza/vertuo-omni-loop/pull/244) | `2026-09-27T09:40:15Z` | `2026-09-27T10:04:22Z` | 24 | 2 | 2 |
| s4 | [#246](https://github.com/vertuoza/vertuo-omni-loop/pull/246) | `2026-09-27T10:06:41Z` | `2026-09-27T10:29:34Z` | 23 | 3 | 3 |
| s5 | [#248](https://github.com/vertuoza/vertuo-omni-loop/pull/248) | `2026-09-27T10:31:51Z` | `2026-09-27T10:50:46Z` | 19 | 4 | 4 |

## Decisions

- Decisions: 11 raised and settled — 11 adopted, 0 agreed, 0 drifted; by rank: 11 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 5 merged sub-PRs graded against the plan — no path outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 6 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

## Churn

- 22 commits read across 5 merged pull requests: 1428 lines added, 1422 in the final diff, 6 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0238-game-app-switch/s1-01-signed-out-links-land-on-coin.md`, `.omni-loop/delivery/outbox/0238-game-app-switch/s1-02-level-up-before-menu-link.md`, `.omni-loop/delivery/outbox/0238-game-app-switch/s1-03-menu-link-without-galaxy.md`, `.omni-loop/delivery/outbox/0238-game-app-switch/s1-04-switch-is-a-link.md`, `.omni-loop/delivery/outbox/0238-game-app-switch/s2-01-game-mode-on-a-phone.md`, `.omni-loop/delivery/outbox/0238-game-app-switch/s2-02-knowledge-bar-sideways.md`, `.omni-loop/delivery/outbox/0238-game-app-switch/s3-01-ready-screen-pauses-before-confirm.md`, `.omni-loop/delivery/outbox/0238-game-app-switch/s3-02-timed-screens-wait-under-confirm.md`, `.omni-loop/delivery/outbox/0238-game-app-switch/s3-03-wide-menu-rows-tightened.md`, `.omni-loop/delivery/outbox/0238-game-app-switch/s4-01-sideways-switch-at-the-wing-foot.md`, `.omni-loop/delivery/outbox/0238-game-app-switch/s4-02-season-label-gives-way-on-small-phones.md`.

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
