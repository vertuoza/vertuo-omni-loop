---
prd: 438
feature-pr: 440
merge-sha: 78d05ff
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 438, App sidebar navigation

The sidebar work shipped in three slices, and the new navigation bar took shape through repeated rewrites rather than a settled design. The same few lines of `AppBar.tsx`, `app-bar.css`, `AppBar.test.ts` and `headers.test.ts` were changed in each slice. The markup, styling and expected headers were still moving while later slices built on them. The first slice also edited a test file outside its planned territory. The result merged, but the churn suggests the bar's structure and its test expectations should have been fixed earlier.

## Findings

### F1 · First slice edited a test outside its territory — `territory:s1` · [#462](https://github.com/vertuoza/vertuo-omni-loop/issues/462)

- **What happened:** Slice s1 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/src/fleets/render.test.ts`.
- **Why it matters:** The first slice changed `render.test.ts`, a file that was neither in its territory nor in the plan's shared ground. Unplanned edits like this can collide with work in other slices. They also hide a dependency the plan did not account for, likely a rendering test that asserted on the old top bar.
- **Proposed lesson:** When a navigation change is expected to break tests elsewhere, list those test files in the plan's shared ground up front.
- **Evidence:** [#449](https://github.com/vertuoza/vertuo-omni-loop/pull/449/files)

### F2 · Core lines of `AppBar.tsx` rewritten in every slice — `churn:apps/galaxy/src/nav/AppBar.tsx:43-50` · [#463](https://github.com/vertuoza/vertuo-omni-loop/issues/463)

- **What happened:** Lines 43-50 of `apps/galaxy/src/nav/AppBar.tsx`, as merged, were written and rewritten in 4 commits, in s1, s2 and s3; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** This block of the new bar was rewritten across four commits in all three slices. Each slice reshaped the same markup instead of adding to a stable base. The bar's structure, likely the grouping of app sections, help pages and the account menu, was not settled when the first slice landed.
- **Proposed lesson:** Settle the bar's structure, which groups exist and in what order, in the first slice, so later slices only add entries.
- **Evidence:** [fa50528 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/fa50528a016b7045e15a6d2d29d6ac30c4a37429), [fcb837c (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/fcb837cbcd60c1feefec1ab0c9f6676f2e5d7b72), [2fd2498 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/2fd2498dedccdf0a99670711cc3bd42a9bb4a436), [9cdf987 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/9cdf987e78e8526d0bc6a107f476249c803f913d), [`apps/galaxy/src/nav/AppBar.tsx` lines 43-50, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/36bad05d4e24c35bcd1c8e0e921c275cca96a6d5/apps/galaxy/src/nav/AppBar.tsx#L43-L50)

### F3 · A single style rule in `app-bar.css` kept changing — `churn:apps/galaxy/src/nav/app-bar.css:23-23` · [#464](https://github.com/vertuoza/vertuo-omni-loop/issues/464)

- **What happened:** Lines 23-23 of `apps/galaxy/src/nav/app-bar.css`, as merged, were written and rewritten in 3 commits, in s1 and s3; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** One line of the bar's stylesheet was rewritten in the first and third slices, three times in all. Repeated tweaks to one rule suggest the layout was being adjusted by trial rather than against a clear visual target.
- **Proposed lesson:** Agree on the bar's layout constraints before styling, so a single rule is not tuned over and over.
- **Evidence:** [fa50528 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/fa50528a016b7045e15a6d2d29d6ac30c4a37429), [2fd2498 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/2fd2498dedccdf0a99670711cc3bd42a9bb4a436), [9cdf987 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/9cdf987e78e8526d0bc6a107f476249c803f913d), [`apps/galaxy/src/nav/app-bar.css` lines 23-23, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/36bad05d4e24c35bcd1c8e0e921c275cca96a6d5/apps/galaxy/src/nav/app-bar.css#L23-L23)

### F4 · Main assertions in `AppBar.test.ts` rewritten each slice — `churn:apps/galaxy/src/nav/AppBar.test.ts:38-58` · [#465](https://github.com/vertuoza/vertuo-omni-loop/issues/465)

- **What happened:** Lines 38-58 of `apps/galaxy/src/nav/AppBar.test.ts`, as merged, were written and rewritten in 3 commits, in s1, s2 and s3; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** This block of test expectations changed in all three slices. The tests followed the component's shifting shape instead of pinning an agreed behaviour. That makes them weak as a guard and costly to keep.
- **Proposed lesson:** Write the bar's tests against the intended grouping and entries, not against the current markup, so they survive later slices.
- **Evidence:** [fa50528 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/fa50528a016b7045e15a6d2d29d6ac30c4a37429), [fcb837c (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/fcb837cbcd60c1feefec1ab0c9f6676f2e5d7b72), [2fd2498 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/2fd2498dedccdf0a99670711cc3bd42a9bb4a436), [`apps/galaxy/src/nav/AppBar.test.ts` lines 38-58, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/36bad05d4e24c35bcd1c8e0e921c275cca96a6d5/apps/galaxy/src/nav/AppBar.test.ts#L38-L58)

### F5 · One line of `AppBar.test.ts` changed in every slice — `churn:apps/galaxy/src/nav/AppBar.test.ts:71-71` · [#466](https://github.com/vertuoza/vertuo-omni-loop/issues/466)

- **What happened:** Lines 71-71 of `apps/galaxy/src/nav/AppBar.test.ts`, as merged, were written and rewritten in 3 commits, in s1, s2 and s3; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** A single assertion line was rewritten in each of the three slices. It is another sign that the expected contents of the bar were redefined as the work went on.
- **Evidence:** [fa50528 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/fa50528a016b7045e15a6d2d29d6ac30c4a37429), [fcb837c (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/fcb837cbcd60c1feefec1ab0c9f6676f2e5d7b72), [2fd2498 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/2fd2498dedccdf0a99670711cc3bd42a9bb4a436), [`apps/galaxy/src/nav/AppBar.test.ts` lines 71-71, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/36bad05d4e24c35bcd1c8e0e921c275cca96a6d5/apps/galaxy/src/nav/AppBar.test.ts#L71-L71)

### F6 · Header expectations in `headers.test.ts` kept moving — `churn:apps/galaxy/src/switch/headers.test.ts:91-93`

- **What happened:** Lines 91-93 of `apps/galaxy/src/switch/headers.test.ts`, as merged, were written and rewritten in 3 commits, in s1, s2 and s3; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** These lines were rewritten in all three slices. The per-page header behaviour, which the PRD set out to unify, was renegotiated repeatedly, and each slice had to update the shared expectation.
- **Proposed lesson:** Decide the unified header contract once, early, and treat later changes to it as a deliberate plan update.
- **Evidence:** [fa50528 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/fa50528a016b7045e15a6d2d29d6ac30c4a37429), [6749589 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/67495894717fec820ba6a0abf96c7cf59095d07c), [9cdf987 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/9cdf987e78e8526d0bc6a107f476249c803f913d), [`apps/galaxy/src/switch/headers.test.ts` lines 91-93, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/36bad05d4e24c35bcd1c8e0e921c275cca96a6d5/apps/galaxy/src/switch/headers.test.ts#L91-L93)

## Proposed lessons

- Fix the navigation bar's structure and header contract in the first slice so later slices extend it rather than rewrite it. (F2, F3, F6)
- Test the intended behaviour of the bar, its groups and entries, rather than its current markup, so tests stay stable across slices. (F4, F5)
- Anticipate which existing tests a shared navigation change will break and put them in the plan's shared ground. (F1)

## Timeline

- Feature PR [#440](https://github.com/vertuoza/vertuo-omni-loop/pull/440): opened `2026-09-28T12:10:10Z`, ready `2026-09-28T13:39:28Z`, merged `2026-09-28T13:41:52Z`, 92 minutes in all.
- 4 slices; waves: 3 planned, 3 as merged; median slice: 12 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#449](https://github.com/vertuoza/vertuo-omni-loop/pull/449) | `2026-09-28T12:38:25Z` | `2026-09-28T13:02:02Z` | 24 | 1 | 1 |
| s2 | [#456](https://github.com/vertuoza/vertuo-omni-loop/pull/456) | `2026-09-28T13:09:11Z` | `2026-09-28T13:20:45Z` | 12 | 2 | 2 |
| s4 | [#457](https://github.com/vertuoza/vertuo-omni-loop/pull/457) | `2026-09-28T13:09:20Z` | `2026-09-28T13:21:28Z` | 12 | 2 | 2 |
| s3 | [#458](https://github.com/vertuoza/vertuo-omni-loop/pull/458) | `2026-09-28T13:24:49Z` | `2026-09-28T13:35:35Z` | 11 | 3 | 3 |

## Decisions

- Decisions: 6 raised and settled — 6 adopted, 0 agreed, 0 drifted; by rank: 6 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 4 merged sub-PRs graded against the plan — 1 path outside a slice’s territory, 2 more on shared ground.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 5 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F1 · First slice edited a test outside its territory · [#462](https://github.com/vertuoza/vertuo-omni-loop/issues/462)

## Churn

- 14 commits read across 4 merged pull requests: 1954 lines added, 1890 in the final diff, 64 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0438-app-sidebar/s1-01-fleets-card-test-moved-to-sidebar.md`, `.omni-loop/delivery/outbox/0438-app-sidebar/s1-02-knowledge-repo-chip-above-the-map.md`, `.omni-loop/delivery/outbox/0438-app-sidebar/s1-03-demo-viewer-is-signed-in.md`, `.omni-loop/delivery/outbox/0438-app-sidebar/s2-01-headers-test-top-bar-end.md`, `.omni-loop/delivery/outbox/0438-app-sidebar/s3-01-headers-test-phone-controls.md`, `.omni-loop/delivery/outbox/0438-app-sidebar/s4-01-open-the-app-placement.md`.

Findings: F2 · Core lines of `AppBar.tsx` rewritten in every slice · [#463](https://github.com/vertuoza/vertuo-omni-loop/issues/463); F3 · A single style rule in `app-bar.css` kept changing · [#464](https://github.com/vertuoza/vertuo-omni-loop/issues/464); F4 · Main assertions in `AppBar.test.ts` rewritten each slice · [#465](https://github.com/vertuoza/vertuo-omni-loop/issues/465); F5 · One line of `AppBar.test.ts` changed in every slice · [#466](https://github.com/vertuoza/vertuo-omni-loop/issues/466); F6 · Header expectations in `headers.test.ts` kept moving

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
