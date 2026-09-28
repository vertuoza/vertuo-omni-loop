---
prd: 400
feature-pr: 403
merge-sha: 90c1733
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 400, Your own fleets, or none

The delivery aimed to let a workspace created by sign-up manage its own groups, or run with none, instead of relying on the demo data written into code. The only findings concern scope. The slice behind `territory:s3` edited the switch module and its tests, and the slice behind `territory:s4` edited the main app shell, its group helpers and `packages/design/src/forge.mjs`. None of those files was in either slice's planned territory or on the plan's shared ground. Nothing here says the changes were wrong, but the plan did not foresee them, which makes overlap between slices and review gaps more likely.

## Findings

### F1 · Switch module and its tests edited outside the slice's territory — `territory:s3` · [#444](https://github.com/vertuoza/vertuo-omni-loop/issues/444)

- **What happened:** Slice s3 changed 3 paths outside its territory and off the plan’s shared ground: `apps/galaxy/src/switch/render.test.ts`, `apps/galaxy/src/switch/switch.test.ts`, `apps/galaxy/src/switch/switch.ts`.
- **Why it matters:** The slice changed the switch module and both of its test files, none of which the plan gave it. When a slice leaves its territory, another slice working in parallel may touch the same files, and review of the slice may not cover code it was never expected to change.
- **Proposed lesson:** Before slicing, trace which modules read group data, such as the switch module, and either assign them to a slice or list them as shared ground.
- **Evidence:** [#424](https://github.com/vertuoza/vertuo-omni-loop/pull/424/files)

### F2 · App shell, group helpers and design forge edited outside the slice's territory — `territory:s4` · [#445](https://github.com/vertuoza/vertuo-omni-loop/issues/445)

- **What happened:** Slice s4 changed 3 paths outside its territory and off the plan’s shared ground: `apps/galaxy/src/arcade/ArcadeApp.tsx`, `apps/galaxy/src/arcade/fleets.ts`, `packages/design/src/forge.mjs`.
- **Why it matters:** The slice changed the main app shell, the group helper module and `packages/design/src/forge.mjs`. All of them sit off its planned territory, and the design package is likely used well beyond this feature. Unplanned edits there can collide with other slices and spread visual changes the plan never reviewed.
- **Proposed lesson:** When a slice must remove hard-coded demo names from shared packages like the design forge, name those files in the plan up front so the edit is expected and owned.
- **Evidence:** [#425](https://github.com/vertuoza/vertuo-omni-loop/pull/425/files)

## Proposed lessons

- Removing hard-coded demo data reaches every module that keys flavour or logic off those names. Map all such readers during planning and place each one in a slice's territory or on shared ground, so edits outside territory do not come as a surprise. (F1, F2)

## Timeline

- Feature PR [#403](https://github.com/vertuoza/vertuo-omni-loop/pull/403): opened `2026-09-28T10:41:58Z`, ready `2026-09-28T12:09:46Z`, merged `2026-09-28T12:34:14Z`, 112 minutes in all.
- 5 slices; waves: 2 planned, 2 as merged; median slice: 19 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#410](https://github.com/vertuoza/vertuo-omni-loop/pull/410) | `2026-09-28T11:16:11Z` | `2026-09-28T11:35:23Z` | 19 | 1 | 1 |
| s2 | [#411](https://github.com/vertuoza/vertuo-omni-loop/pull/411) | `2026-09-28T11:16:19Z` | `2026-09-28T11:35:39Z` | 19 | 1 | 1 |
| s5 | [#412](https://github.com/vertuoza/vertuo-omni-loop/pull/412) | `2026-09-28T11:16:26Z` | `2026-09-28T11:35:54Z` | 19 | 1 | 1 |
| s3 | [#424](https://github.com/vertuoza/vertuo-omni-loop/pull/424) | `2026-09-28T11:40:05Z` | `2026-09-28T12:02:04Z` | 22 | 2 | 2 |
| s4 | [#425](https://github.com/vertuoza/vertuo-omni-loop/pull/425) | `2026-09-28T11:40:14Z` | `2026-09-28T12:02:19Z` | 22 | 2 | 2 |

## Decisions

- Decisions: 12 raised and settled — 12 adopted, 0 agreed, 0 drifted; by rank: 12 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 5 merged sub-PRs graded against the plan — 6 paths outside a slice’s territory, 2 more on shared ground.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 6 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F1 · Switch module and its tests edited outside the slice's territory · [#444](https://github.com/vertuoza/vertuo-omni-loop/issues/444); F2 · App shell, group helpers and design forge edited outside the slice's territory · [#445](https://github.com/vertuoza/vertuo-omni-loop/issues/445)

## Checks

- 2 runs of 1 check on 2 commits in 1 slice, read from GitHub Actions: 0 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| check | 2 | 0 | 0 | — | 0 |

## Churn

- 20 commits read across 5 merged pull requests: 2763 lines added, 2759 in the final diff, 6 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0400-own-fleets/s1-01-mascot-choices.md`, `.omni-loop/delivery/outbox/0400-own-fleets/s1-02-fleet-refusal-shape.md`, `.omni-loop/delivery/outbox/0400-own-fleets/s1-03-fleet-key-from-label.md`, `.omni-loop/delivery/outbox/0400-own-fleets/s2-01-fleets-menu-with-none.md`, `.omni-loop/delivery/outbox/0400-own-fleets/s2-02-disbanded-with-no-fleets.md`, `.omni-loop/delivery/outbox/0400-own-fleets/s3-01-fleets-card-in-app-sections.md`, `.omni-loop/delivery/outbox/0400-own-fleets/s3-02-member-cannot-see-owner-name.md`, `.omni-loop/delivery/outbox/0400-own-fleets/s4-01-demo-fleets-invented.md`, `.omni-loop/delivery/outbox/0400-own-fleets/s4-02-scan-reach-and-spy-key.md`, `.omni-loop/delivery/outbox/0400-own-fleets/s4-03-outside-territory-touches.md`, `.omni-loop/delivery/outbox/0400-own-fleets/s4-04-title-invite-placement.md`, `.omni-loop/delivery/outbox/0400-own-fleets/s5-01-dashboard-play-copy.md`.

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
