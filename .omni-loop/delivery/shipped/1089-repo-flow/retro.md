---
prd: 1089
feature-pr: 1090
merge-sha: 995a2c3
runs: [merge, day-14]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 1089, Repository flow — rules, areas and hooks that tailor the loop per repository

The repository flow request was delivered as a chain of slices, and the merged work held together. The friction was in how the plan drew its boundaries. Several slices changed files the plan never gave them. Three of them reached into the same app entry file, `apps/omni-app/api/inngest.mjs`, which no slice owned and the plan did not name as shared ground. The new `kit/bin/commands/flow.ts` command file was also rewritten at the same lines by successive slices, as each one extended it. The rest of the breaches were expected side effects: test snapshots, a decision record and a guide page.

## Findings

### F1 · First slice touched the app's API entry files — `territory:s1` · [#1101](https://github.com/vertuoza/vertuo-omni-loop/issues/1101)

- **What happened:** Slice s1 changed 2 paths outside its territory and off the plan’s shared ground: `apps/omni-app/api/github.mjs`, `apps/omni-app/api/inngest.mjs`.
- **Why it matters:** The slice changed `apps/omni-app/api/github.mjs` and `apps/omni-app/api/inngest.mjs`, which the plan neither gave it nor marked as shared. Edits there can collide with other slices that register work in the same entry file.
- **Proposed lesson:** When several slices each register something in one entry file, the plan declares that file as shared ground, or gives it to a single slice that lays it down first.
- **Kept:** Neither the knowledge nor earlier lessons cover planning for a common registration file outside tests; ADR-0053 covers shared tests only.
- **Evidence:** [#1093](https://github.com/vertuoza/vertuo-omni-loop/pull/1093/files)

### F2 · Another slice edited the same app job entry file — `territory:s3` · [#1102](https://github.com/vertuoza/vertuo-omni-loop/issues/1102)

- **What happened:** Slice s3 changed 1 path outside its territory and off the plan’s shared ground: `apps/omni-app/api/inngest.mjs`.
- **Why it matters:** This is the second slice to change `apps/omni-app/api/inngest.mjs` outside its territory. That shows the file is a common registration point the plan missed.
- **Proposed lesson:** When several slices each register something in one entry file, the plan declares that file as shared ground, or gives it to a single slice that lays it down first.
- **Kept:** It is the same new pattern as the first slice: an unplanned common entry file edited by several slices.
- **Evidence:** [#1095](https://github.com/vertuoza/vertuo-omni-loop/pull/1095/files)

### F3 · Snapshot files changed beside the tests that own them — `territory:s4`

- **What happened:** Slice s4 changed 2 paths outside its territory and off the plan’s shared ground: `kit/bin/__snapshots__/flow.test.ts.snap`, `kit/lib/flow/__snapshots__/show.test.ts.snap`.
- **Why it matters:** The slice updated `kit/bin/__snapshots__/flow.test.ts.snap` and `kit/lib/flow/__snapshots__/show.test.ts.snap`. These are generated companions of tests the slice changed.
- **Evidence:** [#1096](https://github.com/vertuoza/vertuo-omni-loop/pull/1096/files)

### F4 · A late slice reached into planning and the app entry file — `territory:s6` · [#1103](https://github.com/vertuoza/vertuo-omni-loop/issues/1103)

- **What happened:** Slice s6 changed 4 paths outside its territory and off the plan’s shared ground: `apps/omni-app/api/inngest.mjs`, `apps/omni-app/src/inbox-check/evaluate-inbox.ts`, `kit/bin/commands/plan.ts`, `kit/bin/plan.test.ts`.
- **Why it matters:** The slice changed `kit/bin/commands/plan.ts`, `kit/bin/plan.test.ts`, the inbox evaluator and `apps/omni-app/api/inngest.mjs`. These are files outside its territory, and the last of them was already touched by other slices.
- **Proposed lesson:** When several slices each register something in one entry file, the plan declares that file as shared ground, or gives it to a single slice that lays it down first.
- **Kept:** It is a third slice editing the same undeclared app entry file, which confirms the new planning lesson.
- **Evidence:** [#1098](https://github.com/vertuoza/vertuo-omni-loop/pull/1098/files)

### F5 · Documentation slice wrote a decision record and a guide page — `territory:s8`

- **What happened:** Slice s8 changed 2 paths outside its territory and off the plan’s shared ground: `.omni-loop/knowledge/adr/0069-a-repository-s-flow-may-replace-the-act-at-a-named-point-never-a-guard.md`, `docs/guide/landings.md`.
- **Why it matters:** The slice added a decision record and changed `docs/guide/landings.md` outside its declared paths. This is ordinary documentation that accompanies the feature.
- **Evidence:** [#1100](https://github.com/vertuoza/vertuo-omni-loop/pull/1100/files)

### F6 · One line of the flow command was rewritten by successive slices — `churn:kit/bin/commands/flow.ts:34-34`

- **What happened:** Lines 34-34 of `kit/bin/commands/flow.ts`, as merged, were written and rewritten in 3 commits, in s4, s5 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** Three slices rewrote the same line of `kit/bin/commands/flow.ts` as each one extended the command. That means repeated edits and a risk of conflicts between slices.
- **Evidence:** [01baecf (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/01baecf5e026058c08ef600ea1a53d5092321c5e), [a72e74c (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/a72e74cc6800328606c2267d4b303cf200c02190), [087deb3 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/087deb3e897618d065fd1fd0577d0cb0f25e7b14), [`kit/bin/commands/flow.ts` lines 34-34, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/cb7f69a83b94790df9d144d979962ad7638c888f/kit/bin/commands/flow.ts#L34-L34)

### F7 · A nearby line of the flow command churned the same way — `churn:kit/bin/commands/flow.ts:40-40`

- **What happened:** Lines 40-40 of `kit/bin/commands/flow.ts`, as merged, were written and rewritten in 3 commits, in s4, s5 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** Another line of `kit/bin/commands/flow.ts` was rewritten by the same three slices. This confirms the file was grown piece by piece.
- **Evidence:** [01baecf (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/01baecf5e026058c08ef600ea1a53d5092321c5e), [a72e74c (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/a72e74cc6800328606c2267d4b303cf200c02190), [087deb3 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/087deb3e897618d065fd1fd0577d0cb0f25e7b14), [`kit/bin/commands/flow.ts` lines 40-40, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/cb7f69a83b94790df9d144d979962ad7638c888f/kit/bin/commands/flow.ts#L40-L40)

### F8 · A later line of the flow command was reworked across slices — `churn:kit/bin/commands/flow.ts:145-145`

- **What happened:** Lines 145-145 of `kit/bin/commands/flow.ts`, as merged, were written and rewritten in 3 commits, in s4 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** One line of `kit/bin/commands/flow.ts` was written and rewritten within one slice and then again in a later one.
- **Evidence:** [01baecf (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/01baecf5e026058c08ef600ea1a53d5092321c5e), [5f6fb1f (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/5f6fb1f1858dded3d5a6f4ca9ef1cbc845db0bc8), [087deb3 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/087deb3e897618d065fd1fd0577d0cb0f25e7b14), [`kit/bin/commands/flow.ts` lines 145-145, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/cb7f69a83b94790df9d144d979962ad7638c888f/kit/bin/commands/flow.ts#L145-L145)

## Proposed lessons

- When several slices each register something in one entry file or extend one command file, the plan declares that file as shared ground, or gives it to a single slice that lays it down first. (F1, F2, F4, F6)

## Timeline

- Feature PR [#1090](https://github.com/vertuoza/vertuo-omni-loop/pull/1090): opened `2026-10-06T07:18:21Z`, ready `2026-10-06T09:56:04Z`, merged `2026-10-06T10:30:42Z`, 192 minutes in all.
- 8 slices; waves: 7 planned, 7 as merged; median slice: 19 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#1093](https://github.com/vertuoza/vertuo-omni-loop/pull/1093) | `2026-10-06T07:23:11Z` | `2026-10-06T07:46:20Z` | 23 | 1 | 1 |
| s2 | [#1094](https://github.com/vertuoza/vertuo-omni-loop/pull/1094) | `2026-10-06T07:23:18Z` | `2026-10-06T07:46:34Z` | 23 | 1 | 1 |
| s3 | [#1095](https://github.com/vertuoza/vertuo-omni-loop/pull/1095) | `2026-10-06T07:48:59Z` | `2026-10-06T07:58:54Z` | 10 | 2 | 2 |
| s4 | [#1096](https://github.com/vertuoza/vertuo-omni-loop/pull/1096) | `2026-10-06T07:59:18Z` | `2026-10-06T08:17:31Z` | 18 | 3 | 3 |
| s5 | [#1097](https://github.com/vertuoza/vertuo-omni-loop/pull/1097) | `2026-10-06T08:17:49Z` | `2026-10-06T08:28:35Z` | 11 | 4 | 4 |
| s6 | [#1098](https://github.com/vertuoza/vertuo-omni-loop/pull/1098) | `2026-10-06T08:31:57Z` | `2026-10-06T08:51:15Z` | 19 | 5 | 5 |
| s7 | [#1099](https://github.com/vertuoza/vertuo-omni-loop/pull/1099) | `2026-10-06T08:51:34Z` | `2026-10-06T09:19:50Z` | 28 | 6 | 6 |
| s8 | [#1100](https://github.com/vertuoza/vertuo-omni-loop/pull/1100) | `2026-10-06T09:21:42Z` | `2026-10-06T09:34:50Z` | 13 | 7 | 7 |

## Decisions

- Decisions: 11 raised and settled — 11 adopted, 0 agreed, 0 drifted; by rank: 11 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 8 merged sub-PRs graded against the plan — 11 paths outside a slice’s territory, 2 more on shared ground.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 9 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F1 · First slice touched the app's API entry files · [#1101](https://github.com/vertuoza/vertuo-omni-loop/issues/1101); F2 · Another slice edited the same app job entry file · [#1102](https://github.com/vertuoza/vertuo-omni-loop/issues/1102); F3 · Snapshot files changed beside the tests that own them; F4 · A late slice reached into planning and the app entry file · [#1103](https://github.com/vertuoza/vertuo-omni-loop/issues/1103); F5 · Documentation slice wrote a decision record and a guide page

## Checks

- 8 runs of 1 check on 8 commits in 2 slices, read from GitHub Actions: 0 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| check | 8 | 0 | 0 | — | 0 |

## Churn

- 44 commits read across 8 merged pull requests: 6964 lines added, 7104 in the final diff, 184 lines of churn.
- Left out as generated, by `.gitattributes`: `kit/dist/omni.mjs`.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/1089-repo-flow/accounts/s8.md`, `.omni-loop/delivery/outbox/1089-repo-flow/s1-01-area-inheritance.md`, `.omni-loop/delivery/outbox/1089-repo-flow/s1-02-check-config-shape.md`, `.omni-loop/delivery/outbox/1089-repo-flow/s1-03-app-bundles-outside-territory.md`, `.omni-loop/delivery/outbox/1089-repo-flow/s2-01-other-skills-find-by-base.md`, `.omni-loop/delivery/outbox/1089-repo-flow/s3-01-plan-rules-order-and-reach.md`, `.omni-loop/delivery/outbox/1089-repo-flow/s4-01-flow-show-shapes.md`, `.omni-loop/delivery/outbox/1089-repo-flow/s5-01-merge-gate-reading.md`, `.omni-loop/delivery/outbox/1089-repo-flow/s6-01-target-flow-copy-and-grading.md`, `.omni-loop/delivery/outbox/1089-repo-flow/s7-01-skill-points-placement.md`, `.omni-loop/delivery/outbox/1089-repo-flow/s7-02-target-flow-read-in-clone.md`, `.omni-loop/delivery/outbox/1089-repo-flow/s8-01-adr-number-and-guide-place.md`.
- GitHub sent no patch for `apps/omni-app/api/inngest.mjs` in 108edf3 (s1): counted by its totals, 1173 added and 1020 removed, its lines not followed.

Findings: F6 · One line of the flow command was rewritten by successive slices; F7 · A nearby line of the flow command churned the same way; F8 · A later line of the flow command was reworked across slices

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.

## After merge

- No `bug` issue naming #1089 was opened within 14 days of the merge.
- 2 GitHub Actions jobs ran on the merge commit `995a2c3`: 2 green, 0 red.
