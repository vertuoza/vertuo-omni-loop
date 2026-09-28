---
prd: 499
feature-pr: 502
merge-sha: 17d8f03
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 499, Waiting-for-you notifications — tab count, menu badges and bell, live on every page

The delivery added live waiting notifications across pages: a tab count, menu counts and a bell. It was split into several slices merged into the feature branch. Two slices each edited the same switch headers test file, which neither had declared and the plan did not mark as shared. A line of the sidebar render test and a line of the waiting provider were each rewritten across several slices. Two slices took far longer than the median from claim to merge, and the evidence does not say why.

## Findings

### F1 · A shared headers test was edited outside the slice's territory — `territory:s1` · [#512](https://github.com/vertuoza/vertuo-omni-loop/issues/512)

- **What happened:** Slice s1 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/src/switch/headers.test.ts`.
- **Why it matters:** _Dropped: it holds a word the rules refuse._
- **Proposed lesson:** When several slices will all have to touch a common test file, the plan's table should declare that file as shared ground so the edits are expected and graded as such.
- **Kept:** Neither the knowledge nor the earlier lessons say that the plan should declare common test files as shared ground.
- **Evidence:** [#506](https://github.com/vertuoza/vertuo-omni-loop/pull/506/files)

### F2 · The same headers test was edited by a second slice — `territory:s4` · [#513](https://github.com/vertuoza/vertuo-omni-loop/issues/513)

- **What happened:** Slice s4 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/src/switch/headers.test.ts`.
- **Why it matters:** A second slice changed the same undeclared switch headers test file. That confirms the file was common ground the plan missed.
- **Proposed lesson:** When several slices will all have to touch a common test file, the plan's table should declare that file as shared ground so the edits are expected and graded as such.
- **Kept:** This is the second sighting behind the same new planning lesson about declaring common test files as shared.
- **Evidence:** [#509](https://github.com/vertuoza/vertuo-omni-loop/pull/509/files)

### F3 · One line of the sidebar render test was rewritten across slices — `churn:apps/galaxy/src/nav/Sidebar.render.test.ts:28-28`

- **What happened:** Lines 28-28 of `apps/galaxy/src/nav/Sidebar.render.test.ts`, as merged, were written and rewritten in 3 commits, in s1 and s3; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The same line was written and rewritten in several commits spread over two slices. The expectation it holds kept shifting as the menu gained its live counts.
- **Evidence:** [2edb8d5 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/2edb8d546c7ae024a64e41c053e77e8b72428cf3), [1b1ea94 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/1b1ea9472d165b2a2470eb2a35a64cd72846d872), [5aac7c0 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/5aac7c080d7c83fe0127824c224c460b723c9852), [`apps/galaxy/src/nav/Sidebar.render.test.ts` lines 28-28, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/e473d3587315991ab73b3651a552b8772088b0f8/apps/galaxy/src/nav/Sidebar.render.test.ts#L28-L28)

### F4 · One line of the waiting provider was rewritten across slices — `churn:apps/galaxy/src/waiting/WaitingProvider.tsx:13-13`

- **What happened:** Lines 13-13 of `apps/galaxy/src/waiting/WaitingProvider.tsx`, as merged, were written and rewritten in 3 commits, in s1, s3 and s5; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** A line of the waiting provider was rewritten in several slices. The shared source of the waiting counts kept changing shape while later slices built on it.
- **Evidence:** [2edb8d5 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/2edb8d546c7ae024a64e41c053e77e8b72428cf3), [5aac7c0 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/5aac7c080d7c83fe0127824c224c460b723c9852), [994ebc7 (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/994ebc78fb7869be8b0f952fb6e2b9c770160e93), [`apps/galaxy/src/waiting/WaitingProvider.tsx` lines 13-13, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/e473d3587315991ab73b3651a552b8772088b0f8/apps/galaxy/src/waiting/WaitingProvider.tsx#L13-L13)

### F5 · A slice took far longer than the median — `slow-slice:s3`

- **What happened:** Slice s3 took 80 minutes from its claim to its merge, against a median of 22 minutes; the rules flag a slice slower than 3 times the median.
- **Why it matters:** The slice ran well past the median time from claim to merge. That slowed the feature, but the evidence gives no reason.
- **Evidence:** [#508](https://github.com/vertuoza/vertuo-omni-loop/pull/508)

### F6 · A slice took the longest of all — `slow-slice:s4`

- **What happened:** Slice s4 took 146 minutes from its claim to its merge, against a median of 22 minutes; the rules flag a slice slower than 3 times the median.
- **Why it matters:** The slice ran many times longer than the median. It is also one of the slices that edited the undeclared headers test file.
- **Evidence:** [#509](https://github.com/vertuoza/vertuo-omni-loop/pull/509)

## Proposed lessons

- When several slices will all have to touch a common test file, the plan's table should declare that file as shared ground so the edits are expected and graded as such. (F1, F2)

## Timeline

- Feature PR [#502](https://github.com/vertuoza/vertuo-omni-loop/pull/502): opened `2026-09-28T15:12:05Z`, ready `2026-09-28T18:28:16Z`, merged `2026-09-28T18:44:35Z`, 213 minutes in all.
- 5 slices; waves: 3 planned, 3 as merged; median slice: 22 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#506](https://github.com/vertuoza/vertuo-omni-loop/pull/506) | `2026-09-28T15:19:22Z` | `2026-09-28T15:40:51Z` | 21 | 1 | 1 |
| s2 | [#507](https://github.com/vertuoza/vertuo-omni-loop/pull/507) | `2026-09-28T15:19:32Z` | `2026-09-28T15:41:30Z` | 22 | 1 | 1 |
| s3 | [#508](https://github.com/vertuoza/vertuo-omni-loop/pull/508) | `2026-09-28T15:49:06Z` | `2026-09-28T17:08:45Z` | 80 | 2 | 2 |
| s4 | [#509](https://github.com/vertuoza/vertuo-omni-loop/pull/509) | `2026-09-28T15:49:14Z` | `2026-09-28T18:15:33Z` | 146 | 2 | 2 |
| s5 | [#511](https://github.com/vertuoza/vertuo-omni-loop/pull/511) | `2026-09-28T18:18:15Z` | `2026-09-28T18:25:36Z` | 7 | 3 | 3 |

Findings: F5 · A slice took far longer than the median; F6 · A slice took the longest of all

## Decisions

- Decisions: 7 raised and settled — 7 adopted, 0 agreed, 0 drifted; by rank: 7 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 5 merged sub-PRs graded against the plan — 2 paths outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 6 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F1 · A shared headers test was edited outside the slice's territory · [#512](https://github.com/vertuoza/vertuo-omni-loop/issues/512); F2 · The same headers test was edited by a second slice · [#513](https://github.com/vertuoza/vertuo-omni-loop/issues/513)

## Churn

- 20 commits read across 5 merged pull requests: 2287 lines added, 2249 in the final diff, 38 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0499-waiting-notifications/s1-01-own-question-counts-while-page-can-answer.md`, `.omni-loop/delivery/outbox/0499-waiting-notifications/s1-02-app-headers-test-questions-badge.md`, `.omni-loop/delivery/outbox/0499-waiting-notifications/s2-01-outbox-item-id-joins-dossier.md`, `.omni-loop/delivery/outbox/0499-waiting-notifications/s3-01-outbox-read-when-tab-returns-early.md`, `.omni-loop/delivery/outbox/0499-waiting-notifications/s4-01-bell-age-past-a-day.md`, `.omni-loop/delivery/outbox/0499-waiting-notifications/s4-02-app-headers-test-bell.md`, `.omni-loop/delivery/outbox/0499-waiting-notifications/s5-01-no-notifications-reads-blocked.md`.

Findings: F3 · One line of the sidebar render test was rewritten across slices; F4 · One line of the waiting provider was rewritten across slices

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
