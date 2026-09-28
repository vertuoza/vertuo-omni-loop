---
prd: 261
feature-pr: 263
merge-sha: f4d43f1
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 261, HOME — the Omni Loop front door, a retro print ad

The delivery replaced the attract screen at the site root with a home page that pitches loop engineering first and leaves the fun for later. The findings point to how the work was divided rather than to broken checks. Three slices changed files outside their planned territory: a page test, the share component and its test, and the controls component. One short span of `Home.tsx` was rewritten by three separate slices before merge. Together these suggest the plan drew slice boundaries more narrowly than the work needed, especially around the shared home component.

## Findings

### F1 · First slice edited a page test outside its territory — `territory:s1` · [#278](https://github.com/vertuoza/vertuo-omni-loop/issues/278)

- **What happened:** Slice s1 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/src/arcade/page.test.ts`.
- **Why it matters:** The slice changed `page.test.ts`, a file the plan neither assigned to it nor listed as shared ground. Moving the root page away from the attract screen likely required updating that existing test, so the plan missed a dependency. Edits the plan does not expect can collide with other slices and make ownership harder to follow during review.
- **Proposed lesson:** When a slice changes what an existing route renders, list that route's existing tests in the slice's territory or in shared ground.
- **Evidence:** [#268](https://github.com/vertuoza/vertuo-omni-loop/pull/268/files)

### F2 · Share component and its test built outside the slice's territory — `territory:s6` · [#279](https://github.com/vertuoza/vertuo-omni-loop/issues/279)

- **What happened:** Slice s6 changed 2 paths outside its territory and off the plan’s shared ground: `apps/galaxy/src/home/share.test.ts`, `apps/galaxy/src/home/share.tsx`.
- **Why it matters:** The slice created or changed `share.tsx` and `share.test.ts`, and neither file was in its territory or in shared ground. A whole component falling outside the plan means the plan left out a piece of the page, so no slice clearly owned it.
- **Proposed lesson:** Name every new component file in the plan, so each piece of the page has a clear owner before building starts.
- **Evidence:** [#272](https://github.com/vertuoza/vertuo-omni-loop/pull/272/files)

### F3 · Controls component edited outside the slice's territory — `territory:s5` · [#280](https://github.com/vertuoza/vertuo-omni-loop/issues/280)

- **What happened:** Slice s5 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/src/home/Controls.tsx`.
- **Why it matters:** The slice changed `Controls.tsx`, which the plan did not give it or mark as shared. The same slice also rewrote part of `Home.tsx`, which suggests the home components were more tightly linked than the plan's boundaries assumed.
- **Proposed lesson:** Mark small components shared by several parts of the page as shared ground rather than leaving them unassigned.
- **Evidence:** [#276](https://github.com/vertuoza/vertuo-omni-loop/pull/276/files)

### F4 · A short span of `Home.tsx` rewritten across three slices — `churn:apps/galaxy/src/home/Home.tsx:12-14` · [#281](https://github.com/vertuoza/vertuo-omni-loop/issues/281)

- **What happened:** Lines 12-14 of `apps/galaxy/src/home/Home.tsx`, as merged, were written and rewritten in 3 commits, in s1, s4 and s5; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The same few lines of the home component were written in one slice and rewritten in two later ones. Repeated rewrites of one spot usually mean several slices depended on the same structure, such as imports or the page layout, without agreeing on it first. That costs rework and raises the risk of conflicting edits.
- **Proposed lesson:** Settle the skeleton of a shared component in the first slice, including its imports and layout, so later slices only add to it.
- **Evidence:** [6cc52d6 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/6cc52d6125d75b9ca8297519c1fe50143150f371), [9f626ed (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/9f626ed8a39a00ecf20f67d4c265091431d33d78), [c626844 (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/c626844003bb304794f273b5c61b1b5bca215eab), [`apps/galaxy/src/home/Home.tsx` lines 12-14, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/b83da1ad5a356c682154494a261141ef4b38a950/apps/galaxy/src/home/Home.tsx#L12-L14)

## Proposed lessons

- Plan territory from what each change actually touches: existing tests of a changed route, every new component file, and small shared components. (F1, F2, F3)
- When several slices build on one component, fix its structure early and treat it as shared ground, so later slices do not keep rewriting the same lines. (F4, F3)

## Timeline

- Feature PR [#263](https://github.com/vertuoza/vertuo-omni-loop/pull/263): opened `2026-09-27T15:24:45Z`, ready `2026-09-27T16:17:24Z`, merged `2026-09-27T17:48:08Z`, 143 minutes in all.
- 6 slices; waves: 3 planned, 3 as merged; median slice: 10 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#268](https://github.com/vertuoza/vertuo-omni-loop/pull/268) | `2026-09-27T15:42:57Z` | `2026-09-27T15:53:21Z` | 10 | 1 | 1 |
| s2 | [#269](https://github.com/vertuoza/vertuo-omni-loop/pull/269) | `2026-09-27T15:43:05Z` | `2026-09-27T15:53:32Z` | 10 | 1 | 1 |
| s3 | [#270](https://github.com/vertuoza/vertuo-omni-loop/pull/270) | `2026-09-27T15:43:12Z` | `2026-09-27T15:53:42Z` | 11 | 1 | 1 |
| s4 | [#271](https://github.com/vertuoza/vertuo-omni-loop/pull/271) | `2026-09-27T15:55:00Z` | `2026-09-27T16:05:02Z` | 10 | 2 | 2 |
| s6 | [#272](https://github.com/vertuoza/vertuo-omni-loop/pull/272) | `2026-09-27T15:55:08Z` | `2026-09-27T16:05:13Z` | 10 | 2 | 2 |
| s5 | [#276](https://github.com/vertuoza/vertuo-omni-loop/pull/276) | `2026-09-27T16:06:15Z` | `2026-09-27T16:15:47Z` | 10 | 3 | 3 |

## Decisions

- Decisions: 11 raised and settled — 11 adopted, 0 agreed, 0 drifted; by rank: 11 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 6 merged sub-PRs graded against the plan — 4 paths outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 7 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F1 · First slice edited a page test outside its territory · [#278](https://github.com/vertuoza/vertuo-omni-loop/issues/278); F2 · Share component and its test built outside the slice's territory · [#279](https://github.com/vertuoza/vertuo-omni-loop/issues/279); F3 · Controls component edited outside the slice's territory · [#280](https://github.com/vertuoza/vertuo-omni-loop/issues/280)

## Churn

- 20 commits read across 6 merged pull requests: 2005 lines added, 1986 in the final diff, 19 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0261-home/s1-01-forward-every-arcade-link.md`, `.omni-loop/delivery/outbox/0261-home/s1-02-arcade-page-test-follows-the-move.md`, `.omni-loop/delivery/outbox/0261-home/s1-03-session-refresh-still-runs-on-home.md`, `.omni-loop/delivery/outbox/0261-home/s3-01-start-pause-lengths.md`, `.omni-loop/delivery/outbox/0261-home/s3-02-enter-on-focused-controls.md`, `.omni-loop/delivery/outbox/0261-home/s4-01-planet-drawn-at-build.md`, `.omni-loop/delivery/outbox/0261-home/s4-02-phone-poster-order.md`, `.omni-loop/delivery/outbox/0261-home/s5-01-card-flip-in-the-controls.md`, `.omni-loop/delivery/outbox/0261-home/s6-01-share-words-beside-home.md`, `.omni-loop/delivery/outbox/0261-home/s6-02-share-card-headline-face.md`, `.omni-loop/delivery/outbox/0261-home/s6-03-share-card-for-every-page.md`.

Findings: F4 · A short span of `Home.tsx` rewritten across three slices · [#281](https://github.com/vertuoza/vertuo-omni-loop/issues/281)

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
