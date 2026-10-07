---
prd: 1089
feature-pr: 1090
merge-sha: 995a2c3
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 1089, Repository flow — rules, areas and hooks that tailor the loop per repository

The repository flow feature was delivered as a series of sub-PRs into the feature branch, and the retro found no failed checks, only territory breaches and churn. Three slices each edited `apps/omni-app/api/inngest.mjs`, a file the plan gave to none of them and did not declare as shared ground. One slice touched test snapshots outside its territory, and the closing slice wrote its decision record and guide page outside its own. In `kit/bin/commands/flow.ts`, a few lines were rewritten by successive slices, which suggests a common entry file that each slice extended in turn. The one lesson worth keeping concerns registration files that several slices must touch.

## Findings

### F1 · Registration files edited outside the slice's territory — `territory:s1` · [#1101](https://github.com/vertuoza/vertuo-omni-loop/issues/1101)

- **What happened:** Slice s1 changed 2 paths outside its territory and off the plan’s shared ground: `apps/omni-app/api/github.mjs`, `apps/omni-app/api/inngest.mjs`.
- **Why it matters:** This slice changed `apps/omni-app/api/github.mjs` and `apps/omni-app/api/inngest.mjs`. The plan had placed neither in its territory nor on shared ground, so the plan check could not see slices overlapping on them.
- **Proposed lesson:** When several slices each register something in one central file, such as a function registry, the plan should declare that file as shared ground or give it to one slice that lands first.
- **Kept:** Three slices edited inngest.mjs undeclared; no knowledge line or earlier lesson covers shared registration files beyond tests (ADR-0053).
- **Evidence:** [#1093](https://github.com/vertuoza/vertuo-omni-loop/pull/1093/files)

### F2 · `apps/omni-app/api/inngest.mjs` edited outside the slice's territory — `territory:s3` · [#1102](https://github.com/vertuoza/vertuo-omni-loop/issues/1102)

- **What happened:** Slice s3 changed 1 path outside its territory and off the plan’s shared ground: `apps/omni-app/api/inngest.mjs`.
- **Why it matters:** This is a second slice editing the same registry file off the plan's shared ground. That shows the file was common ground the plan never named.
- **Proposed lesson:** A registry file that more than one slice must extend belongs on the plan's shared ground from the outset.
- **Kept:** Same new pattern as territory:s1, confirmed across a second slice; not stated in knowledge or earlier lessons.
- **Evidence:** [#1095](https://github.com/vertuoza/vertuo-omni-loop/pull/1095/files)

### F3 · Test snapshots changed outside the slice's territory — `territory:s4`

- **What happened:** Slice s4 changed 2 paths outside its territory and off the plan’s shared ground: `kit/bin/__snapshots__/flow.test.ts.snap`, `kit/lib/flow/__snapshots__/show.test.ts.snap`.
- **Why it matters:** The slice regenerated `kit/bin/__snapshots__/flow.test.ts.snap` and `kit/lib/flow/__snapshots__/show.test.ts.snap`, which the plan did not list. Generated test artefacts then show up as breaches.
- **Evidence:** [#1096](https://github.com/vertuoza/vertuo-omni-loop/pull/1096/files)

### F4 · Registry, inbox check and plan command edited outside territory — `territory:s6` · [#1103](https://github.com/vertuoza/vertuo-omni-loop/issues/1103)

- **What happened:** Slice s6 changed 4 paths outside its territory and off the plan’s shared ground: `apps/omni-app/api/inngest.mjs`, `apps/omni-app/src/inbox-check/evaluate-inbox.ts`, `kit/bin/commands/plan.ts`, `kit/bin/plan.test.ts`.
- **Why it matters:** The slice changed `apps/omni-app/api/inngest.mjs` again, along with `apps/omni-app/src/inbox-check/evaluate-inbox.ts`, `kit/bin/commands/plan.ts` and `kit/bin/plan.test.ts`. It reached well past what the plan gave it.
- **Proposed lesson:** When a slice must wire its work into the plan command or a common registry, the plan should list those files for that slice rather than leave them implicit.
- **Kept:** A third slice touching the undeclared registry confirms the shared-registration lesson, which is absent from knowledge.
- **Evidence:** [#1098](https://github.com/vertuoza/vertuo-omni-loop/pull/1098/files)

### F5 · Decision record and guide page written outside territory — `territory:s8`

- **What happened:** Slice s8 changed 2 paths outside its territory and off the plan’s shared ground: `.omni-loop/knowledge/adr/0069-a-repository-s-flow-may-replace-the-act-at-a-named-point-never-a-guard.md`, `docs/guide/landings.md`.
- **Why it matters:** The closing slice wrote the decision record and `docs/guide/landings.md` outside its declared paths. Documentation was added late without being planned.
- **Evidence:** [#1100](https://github.com/vertuoza/vertuo-omni-loop/pull/1100/files)

### F6 · A line in `kit/bin/commands/flow.ts` rewritten by three slices — `churn:kit/bin/commands/flow.ts:34-34`

- **What happened:** Lines 34-34 of `kit/bin/commands/flow.ts`, as merged, were written and rewritten in 3 commits, in s4, s5 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** _Dropped: it holds a word the rules refuse._
- **Evidence:** [01baecf (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/01baecf5e026058c08ef600ea1a53d5092321c5e), [a72e74c (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/a72e74cc6800328606c2267d4b303cf200c02190), [087deb3 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/087deb3e897618d065fd1fd0577d0cb0f25e7b14), [`kit/bin/commands/flow.ts` lines 34-34, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/cb7f69a83b94790df9d144d979962ad7638c888f/kit/bin/commands/flow.ts#L34-L34)

### F7 · Another line in `kit/bin/commands/flow.ts` rewritten by three slices — `churn:kit/bin/commands/flow.ts:40-40`

- **What happened:** Lines 40-40 of `kit/bin/commands/flow.ts`, as merged, were written and rewritten in 3 commits, in s4, s5 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** A second nearby line saw the same churn across the same slices, so the whole entry block was reworked repeatedly.
- **Evidence:** [01baecf (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/01baecf5e026058c08ef600ea1a53d5092321c5e), [a72e74c (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/a72e74cc6800328606c2267d4b303cf200c02190), [087deb3 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/087deb3e897618d065fd1fd0577d0cb0f25e7b14), [`kit/bin/commands/flow.ts` lines 40-40, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/cb7f69a83b94790df9d144d979962ad7638c888f/kit/bin/commands/flow.ts#L40-L40)

### F8 · A later line in `kit/bin/commands/flow.ts` rewritten repeatedly — `churn:kit/bin/commands/flow.ts:145-145`

- **What happened:** Lines 145-145 of `kit/bin/commands/flow.ts`, as merged, were written and rewritten in 3 commits, in s4 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** This line was written twice within one slice and again in a later one, adding to the rework in the same command file.
- **Evidence:** [01baecf (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/01baecf5e026058c08ef600ea1a53d5092321c5e), [5f6fb1f (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/5f6fb1f1858dded3d5a6f4ca9ef1cbc845db0bc8), [087deb3 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/087deb3e897618d065fd1fd0577d0cb0f25e7b14), [`kit/bin/commands/flow.ts` lines 145-145, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/cb7f69a83b94790df9d144d979962ad7638c888f/kit/bin/commands/flow.ts#L145-L145)

## Proposed lessons

- When several slices must each register work in one central file, such as a function registry or the plan command, the plan should declare that file as shared ground or give it to one slice that lands first. (F1, F2, F4)

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

Findings: F1 · Registration files edited outside the slice's territory · [#1101](https://github.com/vertuoza/vertuo-omni-loop/issues/1101); F2 · `apps/omni-app/api/inngest.mjs` edited outside the slice's territory · [#1102](https://github.com/vertuoza/vertuo-omni-loop/issues/1102); F3 · Test snapshots changed outside the slice's territory; F4 · Registry, inbox check and plan command edited outside territory · [#1103](https://github.com/vertuoza/vertuo-omni-loop/issues/1103); F5 · Decision record and guide page written outside territory

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

Findings: F6 · A line in `kit/bin/commands/flow.ts` rewritten by three slices; F7 · Another line in `kit/bin/commands/flow.ts` rewritten by three slices; F8 · A later line in `kit/bin/commands/flow.ts` rewritten repeatedly

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
