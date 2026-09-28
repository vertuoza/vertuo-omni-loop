---
prd: 384
feature-pr: 386
merge-sha: ae82308
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 384, The PRD page is easier to use

The work to make the PRD page easier to use was delivered in slices, and the record shows no failed checks or rewritten code among the findings. The only issues raised concern scope: two slices each touched one file that belonged neither to their own territory nor to the shared ground named in the plan. In one case it was the version picker component, and in the other the main dossier page component. Both files sit at the heart of the page being reworked, which suggests the plan drew slice boundaries more tightly than the changes actually needed.

## Findings

### F1 · A slice edited the version picker outside its territory — `territory:s1` · [#404](https://github.com/vertuoza/vertuo-omni-loop/issues/404)

- **What happened:** Slice s1 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/src/dossier/page/VersionPicker.tsx`.
- **Why it matters:** The version picker was not assigned to this slice or listed as shared ground, so another slice could have been changing it at the same time. Edits outside the plan risk merge conflicts and overlapping changes, and they make it harder to tell from the plan which slice owns which behaviour on the page.
- **Proposed lesson:** When a slice changes how versions of the spec or plan appear, list the version picker in its territory or as shared ground from the start.
- **Evidence:** [#388](https://github.com/vertuoza/vertuo-omni-loop/pull/388/files)

### F2 · A slice edited the main dossier page outside its territory — `territory:s4` · [#405](https://github.com/vertuoza/vertuo-omni-loop/issues/405)

- **What happened:** Slice s4 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/src/dossier/page/DossierPage.tsx`.
- **Why it matters:** The main dossier page component holds the tabs, the question flow and the page's data loading, which are the very things this PRD reworks. A slice that edits it without it being planned as shared ground can collide with other slices on the file most likely to be contested.
- **Proposed lesson:** Treat the main page component of a reworked screen as shared ground in the plan, since most slices will need to touch it.
- **Evidence:** [#393](https://github.com/vertuoza/vertuo-omni-loop/pull/393/files)

## Proposed lessons

- When a PRD reworks a single page, the page component and its closely tied pieces, such as the version picker, will be touched by several slices. Declare them as shared ground in the plan rather than leaving them outside every territory. (F1, F2)

## Timeline

- Feature PR [#386](https://github.com/vertuoza/vertuo-omni-loop/pull/386): opened `2026-09-28T09:16:14Z`, ready `2026-09-28T10:15:39Z`, merged `2026-09-28T10:40:30Z`, 84 minutes in all.
- 5 slices; waves: 4 planned, 4 as merged; median slice: 11 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#388](https://github.com/vertuoza/vertuo-omni-loop/pull/388) | `2026-09-28T09:21:09Z` | `2026-09-28T09:32:01Z` | 11 | 1 | 1 |
| s5 | [#389](https://github.com/vertuoza/vertuo-omni-loop/pull/389) | `2026-09-28T09:21:18Z` | `2026-09-28T09:32:23Z` | 11 | 1 | 1 |
| s2 | [#390](https://github.com/vertuoza/vertuo-omni-loop/pull/390) | `2026-09-28T09:35:01Z` | `2026-09-28T09:42:30Z` | 7 | 2 | 2 |
| s3 | [#391](https://github.com/vertuoza/vertuo-omni-loop/pull/391) | `2026-09-28T09:44:28Z` | `2026-09-28T09:54:43Z` | 10 | 3 | 3 |
| s4 | [#393](https://github.com/vertuoza/vertuo-omni-loop/pull/393) | `2026-09-28T09:56:56Z` | `2026-09-28T10:10:35Z` | 14 | 4 | 4 |

## Decisions

- Decisions: 8 raised and settled — 8 adopted, 0 agreed, 0 drifted; by rank: 8 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 5 merged sub-PRs graded against the plan — 2 paths outside a slice’s territory, 1 more on shared ground.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 6 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F1 · A slice edited the version picker outside its territory · [#404](https://github.com/vertuoza/vertuo-omni-loop/issues/404); F2 · A slice edited the main dossier page outside its territory · [#405](https://github.com/vertuoza/vertuo-omni-loop/issues/405)

## Churn

- 19 commits read across 5 merged pull requests: 1288 lines added, 1264 in the final diff, 24 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0384-prd-page-usability/s1-01-version-picker-keeps-every-tab.md`, `.omni-loop/delivery/outbox/0384-prd-page-usability/s2-01-answered-question-drops-repeat-lines.md`, `.omni-loop/delivery/outbox/0384-prd-page-usability/s3-01-no-anchor-on-the-list-yet.md`, `.omni-loop/delivery/outbox/0384-prd-page-usability/s3-02-render-test-follows-the-new-link.md`, `.omni-loop/delivery/outbox/0384-prd-page-usability/s4-01-page-frame-hands-the-database-to-the-list.md`, `.omni-loop/delivery/outbox/0384-prd-page-usability/s4-02-buttons-off-without-script.md`, `.omni-loop/delivery/outbox/0384-prd-page-usability/s4-03-list-ignores-ask-mode-switched-off.md`, `.omni-loop/delivery/outbox/0384-prd-page-usability/s5-01-moved-round-refresh.md`.

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
