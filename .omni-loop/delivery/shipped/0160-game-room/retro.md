---
prd: 160
feature-pr: 161
merge-sha: 7c9f8ee
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 160, Game room — XP, levels and Entropy Invaders

The work was cut into slices that each owned a set of files, and it merged. Two things stand out. The first and fifth slices each changed files outside their assigned territory and off the plan's shared ground. More broadly, a small set of lines was written and then rewritten by several slices in turn, mostly the second, third, fifth and sixth. The rewrites cluster in the main cabinet component, the shared scene helpers, the scene tests, the onboarding copy, the grid and the screenshot script. The plan left these shared files without one clear owner, so later slices kept reshaping what earlier slices had just written.

## Findings

### F1 · First slice edited the data source and its test fake outside its territory — `territory:s1` · [#208](https://github.com/vertuoza/vertuo-omni-loop/issues/208)

- **What happened:** Slice s1 changed 3 paths outside its territory and off the plan’s shared ground: `game/sources/supabase.mjs`, `game/sources/supabase.test.mjs`, `game/test/fake-supabase.mjs`.
- **Why it matters:** The first slice changed the database source module, its test and the shared fake client used by other tests. None of these were in its territory or in the plan's shared ground. Unplanned edits to a data adapter and a test fake can quietly change how other slices read data and what their tests prove.
- **Proposed lesson:** When a slice needs a new read from the data source, the plan should name the adapter and its fake as shared ground, or give them to one slice.
- **Evidence:** [#186](https://github.com/vertuoza/vertuo-omni-loop/pull/186/files)

### F2 · Fifth slice edited a command-line test outside its territory — `territory:s5` · [#209](https://github.com/vertuoza/vertuo-omni-loop/issues/209)

- **What happened:** Slice s5 changed 1 path outside its territory and off the plan’s shared ground: `game/cli/scripts.test.mjs`.
- **Why it matters:** The fifth slice changed `scripts.test.mjs`, which was not in its territory or the shared ground. The change is small, but tests owned by another area can drift without the owning slice knowing.
- **Proposed lesson:** List test files that sit beside shared scripts in the plan, so a slice that touches them does so on purpose.
- **Evidence:** [#202](https://github.com/vertuoza/vertuo-omni-loop/pull/202/files)

### F3 · One line of the main cabinet component was rewritten by four slices — `churn:apps/galaxy/src/arcade/ArcadeApp.tsx:676-676` · [#210](https://github.com/vertuoza/vertuo-omni-loop/issues/210)

- **What happened:** Lines 676-676 of `apps/galaxy/src/arcade/ArcadeApp.tsx`, as merged, were written and rewritten in 4 commits, in s2, s3, s5 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** This single line was reworked in the second, third, fifth and sixth slices. That is the most churn of any spot in the delivery. It suggests the line is a central hook, such as scene wiring or input handling, that each new feature had to adjust.
- **Proposed lesson:** Give a central wiring line in the main component one owner, or settle its shape in the first slice that touches it.
- **Evidence:** [0be9d28 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/0be9d28733898f64daac5b27d8158e01c5af2807), [6c2e033 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/6c2e033cd6039f945bf91d524f12ab84a0b3defe), [a54347c (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/a54347c4e3b9432cb0e1f71ebbcb66302d5964ac), [8470039 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/8470039cffa4a33e53e3bd947722a198a82b4caa), [`apps/galaxy/src/arcade/ArcadeApp.tsx` lines 676-676, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/8361c20e71572b2bbaddafa618c076e763d50bd2/apps/galaxy/src/arcade/ArcadeApp.tsx#L676-L676)

### F4 · Screenshot script header was rewritten by three slices — `churn:apps/galaxy/scripts/shots.mjs:6-8` · [#211](https://github.com/vertuoza/vertuo-omni-loop/issues/211)

- **What happened:** Lines 6-8 of `apps/galaxy/scripts/shots.mjs`, as merged, were written and rewritten in 3 commits, in s2, s3 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The opening lines of `shots.mjs` changed in the second, third and sixth slices. Each slice appears to have added its own screens to the list, so the same lines kept being reshaped.
- **Proposed lesson:** Let the screenshot list grow by appending entries instead of rewriting shared lines, or have one slice own the script.
- **Evidence:** [0b7a1f5 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/0b7a1f500e2b134f208e2f595879a31e870ecf1e), [3daad4f (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/3daad4f7acbc228af91ae4c63e5b1eb923bddfd1), [8470039 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/8470039cffa4a33e53e3bd947722a198a82b4caa), [`apps/galaxy/scripts/shots.mjs` lines 6-8, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/8361c20e71572b2bbaddafa618c076e763d50bd2/apps/galaxy/scripts/shots.mjs#L6-L8)

### F5 · Another line of the screenshot script was reworked by three slices — `churn:apps/galaxy/scripts/shots.mjs:29-29` · [#212](https://github.com/vertuoza/vertuo-omni-loop/issues/212)

- **What happened:** Lines 29-29 of `apps/galaxy/scripts/shots.mjs`, as merged, were written and rewritten in 3 commits, in s2, s3 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** A second spot in `shots.mjs` saw the same rewriting in the second, third and sixth slices. This confirms the script was a shared hotspot with no clear owner.
- **Proposed lesson:** Treat the screenshot script as shared ground with an agreed extension pattern.
- **Evidence:** [0b7a1f5 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/0b7a1f500e2b134f208e2f595879a31e870ecf1e), [3daad4f (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/3daad4f7acbc228af91ae4c63e5b1eb923bddfd1), [8470039 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/8470039cffa4a33e53e3bd947722a198a82b4caa), [`apps/galaxy/scripts/shots.mjs` lines 29-29, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/8361c20e71572b2bbaddafa618c076e763d50bd2/apps/galaxy/scripts/shots.mjs#L29-L29)

### F6 · A line in the main cabinet component was rewritten three times — `churn:apps/galaxy/src/arcade/ArcadeApp.tsx:281-281`

- **What happened:** Lines 281-281 of `apps/galaxy/src/arcade/ArcadeApp.tsx`, as merged, were written and rewritten in 3 commits, in s3 and s5; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** This line was reworked in two commits of the third slice and again in the fifth. The design of this part of the component was still moving while features were being built on it.
- **Proposed lesson:** Settle the shape of shared component state before later slices build on it.
- **Evidence:** [6c2e033 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/6c2e033cd6039f945bf91d524f12ab84a0b3defe), [8758b64 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/8758b64911fe8e1a27bf6a5fb397d1b864d50f78), [a54347c (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/a54347c4e3b9432cb0e1f71ebbcb66302d5964ac), [`apps/galaxy/src/arcade/ArcadeApp.tsx` lines 281-281, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/8361c20e71572b2bbaddafa618c076e763d50bd2/apps/galaxy/src/arcade/ArcadeApp.tsx#L281-L281)

### F7 · Rendering line in the main component changed across three slices — `churn:apps/galaxy/src/arcade/ArcadeApp.tsx:845-845`

- **What happened:** Lines 845-845 of `apps/galaxy/src/arcade/ArcadeApp.tsx`, as merged, were written and rewritten in 3 commits, in s2, s3 and s5; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The second, third and fifth slices each rewrote this line. Every new screen or feature seems to have needed an edit at the same point in the main component.
- **Proposed lesson:** Route new screens through a registry so each slice adds an entry instead of editing the same line.
- **Evidence:** [0be9d28 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/0be9d28733898f64daac5b27d8158e01c5af2807), [6c2e033 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/6c2e033cd6039f945bf91d524f12ab84a0b3defe), [a54347c (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/a54347c4e3b9432cb0e1f71ebbcb66302d5964ac), [`apps/galaxy/src/arcade/ArcadeApp.tsx` lines 845-845, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/8361c20e71572b2bbaddafa618c076e763d50bd2/apps/galaxy/src/arcade/ArcadeApp.tsx#L845-L845)

### F8 · Neighbouring rendering line also churned across three slices — `churn:apps/galaxy/src/arcade/ArcadeApp.tsx:847-847`

- **What happened:** Lines 847-847 of `apps/galaxy/src/arcade/ArcadeApp.tsx`, as merged, were written and rewritten in 3 commits, in s2, s3 and s5; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** This line sits next to the previous hotspot and was rewritten by the same three slices. Together they mark a single dispatch point that absorbed every change.
- **Proposed lesson:** The same registry approach would remove this churn too.
- **Evidence:** [0be9d28 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/0be9d28733898f64daac5b27d8158e01c5af2807), [6c2e033 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/6c2e033cd6039f945bf91d524f12ab84a0b3defe), [a54347c (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/a54347c4e3b9432cb0e1f71ebbcb66302d5964ac), [`apps/galaxy/src/arcade/ArcadeApp.tsx` lines 847-847, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/8361c20e71572b2bbaddafa618c076e763d50bd2/apps/galaxy/src/arcade/ArcadeApp.tsx#L847-L847)

### F9 · A grid helper line was rewritten by three slices — `churn:apps/galaxy/src/arcade/grid.ts:25-25`

- **What happened:** Lines 25-25 of `apps/galaxy/src/arcade/grid.ts`, as merged, were written and rewritten in 3 commits, in s2, s3 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** A line in `grid.ts` changed in the second, third and sixth slices. Layout constants or helpers kept shifting as new screens arrived.
- **Proposed lesson:** Agree on shared layout values early, and have later slices extend them rather than rewrite them.
- **Evidence:** [0be9d28 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/0be9d28733898f64daac5b27d8158e01c5af2807), [070c3bb (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/070c3bb53845ef3fe2cae47bec53da2263d54435), [e3ecc34 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/e3ecc3418ff9aa850310cd3ed2153ecc13346352), [`apps/galaxy/src/arcade/grid.ts` lines 25-25, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/8361c20e71572b2bbaddafa618c076e763d50bd2/apps/galaxy/src/arcade/grid.ts#L25-L25)

### F10 · An onboarding line was rewritten by three slices — `churn:apps/galaxy/src/arcade/onboarding.ts:84-84`

- **What happened:** Lines 84-84 of `apps/galaxy/src/arcade/onboarding.ts`, as merged, were written and rewritten in 3 commits, in s2, s3 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** A line in `onboarding.ts` was reworked in the second, third and sixth slices. The onboarding text or flow kept being adjusted as each feature landed.
- **Proposed lesson:** Write onboarding content once the features it describes are stable, or give it to the final slice.
- **Evidence:** [0be9d28 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/0be9d28733898f64daac5b27d8158e01c5af2807), [6c2e033 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/6c2e033cd6039f945bf91d524f12ab84a0b3defe), [8470039 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/8470039cffa4a33e53e3bd947722a198a82b4caa), [`apps/galaxy/src/arcade/onboarding.ts` lines 84-84, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/8361c20e71572b2bbaddafa618c076e763d50bd2/apps/galaxy/src/arcade/onboarding.ts#L84-L84)

### F11 · A shared scene helper line was rewritten by three slices — `churn:apps/galaxy/src/arcade/scenes/common.ts:34-34`

- **What happened:** Lines 34-34 of `apps/galaxy/src/arcade/scenes/common.ts`, as merged, were written and rewritten in 3 commits, in s2, s3 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** A line in `common.ts` changed in the second, third and sixth slices. Shared scene helpers kept being reshaped by whichever slice needed them next.
- **Proposed lesson:** Define shared scene helpers in one slice, and have others consume them without altering them.
- **Evidence:** [0be9d28 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/0be9d28733898f64daac5b27d8158e01c5af2807), [070c3bb (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/070c3bb53845ef3fe2cae47bec53da2263d54435), [e3ecc34 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/e3ecc3418ff9aa850310cd3ed2153ecc13346352), [`apps/galaxy/src/arcade/scenes/common.ts` lines 34-34, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/8361c20e71572b2bbaddafa618c076e763d50bd2/apps/galaxy/src/arcade/scenes/common.ts#L34-L34)

### F12 · A scene index test line was rewritten by three slices — `churn:apps/galaxy/src/arcade/scenes/index.test.ts:14-14`

- **What happened:** Lines 14-14 of `apps/galaxy/src/arcade/scenes/index.test.ts`, as merged, were written and rewritten in 3 commits, in s2, s3 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** A line in `index.test.ts` was reworked in the second, third and sixth slices. It tracked the scene list, which kept changing.
- **Proposed lesson:** Make scene index tests derive from the registry, so adding a scene needs no edit to the same assertion.
- **Evidence:** [0be9d28 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/0be9d28733898f64daac5b27d8158e01c5af2807), [070c3bb (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/070c3bb53845ef3fe2cae47bec53da2263d54435), [e3ecc34 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/e3ecc3418ff9aa850310cd3ed2153ecc13346352), [`apps/galaxy/src/arcade/scenes/index.test.ts` lines 14-14, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/8361c20e71572b2bbaddafa618c076e763d50bd2/apps/galaxy/src/arcade/scenes/index.test.ts#L14-L14)

### F13 · A block of the new scene's stylesheet was restyled three times — `churn:apps/galaxy/src/arcade/scenes/invaders.css:46-50`

- **What happened:** Lines 46-50 of `apps/galaxy/src/arcade/scenes/invaders.css`, as merged, were written and rewritten in 3 commits, in s3 and s5; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** A block of styles was rewritten in two commits of the third slice and again in the fifth. The visual design of the new scene was still being settled after it first landed.
- **Proposed lesson:** Settle the visual layout of a new screen within the slice that introduces it.
- **Evidence:** [070c3bb (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/070c3bb53845ef3fe2cae47bec53da2263d54435), [3daad4f (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/3daad4f7acbc228af91ae4c63e5b1eb923bddfd1), [dabf350 (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/dabf350ee333b552e74fae75c7dbb0fb588d45d4), [`apps/galaxy/src/arcade/scenes/invaders.css` lines 46-50, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/8361c20e71572b2bbaddafa618c076e763d50bd2/apps/galaxy/src/arcade/scenes/invaders.css#L46-L50)

## Proposed lessons

- Name shared files in the plan and give each one a clear owner, or an agreed way to extend it. The main component, the scene helpers and the screenshot script were rewritten by several slices in turn. (F3, F7, F8, F11, F4, F5)
- Replace a central dispatch point with a registry, so each new screen adds an entry and its tests follow automatically, instead of every slice editing the same lines. (F7, F8, F12)
- Settle layout values, component state and a new screen's styles within the slice that introduces them, before later slices build on top. (F9, F6, F13, F10)
- Put data adapters, test fakes and neighbouring tests into the plan's shared ground when more than one slice is likely to touch them. (F1, F2)

## Timeline

- Feature PR [#161](https://github.com/vertuoza/vertuo-omni-loop/pull/161): opened `2026-09-26T11:13:06Z`, ready `2026-09-26T18:42:14Z`, merged `2026-09-27T05:41:40Z`, 1109 minutes in all.
- 7 slices; waves: 6 planned, 6 as merged; median slice: 29 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#186](https://github.com/vertuoza/vertuo-omni-loop/pull/186) | `2026-09-26T15:24:35Z` | `2026-09-26T15:45:29Z` | 21 | 1 | 1 |
| s2 | [#191](https://github.com/vertuoza/vertuo-omni-loop/pull/191) | `2026-09-26T15:47:41Z` | `2026-09-26T16:16:23Z` | 29 | 2 | 2 |
| s3 | [#200](https://github.com/vertuoza/vertuo-omni-loop/pull/200) | `2026-09-26T16:18:13Z` | `2026-09-26T16:52:40Z` | 34 | 3 | 3 |
| s4 | [#201](https://github.com/vertuoza/vertuo-omni-loop/pull/201) | `2026-09-26T16:18:17Z` | `2026-09-26T16:52:59Z` | 35 | 3 | 3 |
| s5 | [#202](https://github.com/vertuoza/vertuo-omni-loop/pull/202) | `2026-09-26T16:54:45Z` | `2026-09-26T17:57:51Z` | 63 | 4 | 4 |
| s6 | [#203](https://github.com/vertuoza/vertuo-omni-loop/pull/203) | `2026-09-26T17:59:37Z` | `2026-09-26T18:23:13Z` | 24 | 5 | 5 |
| s7 | [#204](https://github.com/vertuoza/vertuo-omni-loop/pull/204) | `2026-09-26T18:25:07Z` | `2026-09-26T18:38:48Z` | 14 | 6 | 6 |

## Decisions

- Decisions: 20 raised and settled — 20 adopted, 0 agreed, 0 drifted; by rank: 20 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 7 merged sub-PRs graded against the plan — 4 paths outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 8 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F1 · First slice edited the data source and its test fake outside its territory · [#208](https://github.com/vertuoza/vertuo-omni-loop/issues/208); F2 · Fifth slice edited a command-line test outside its territory · [#209](https://github.com/vertuoza/vertuo-omni-loop/issues/209)

## Checks

- 7 runs of 1 check on 7 commits in 2 slices, read from GitHub Actions: 0 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| check | 7 | 0 | 0 | — | 0 |

## Churn

- 40 commits read across 7 merged pull requests: 5545 lines added, 5458 in the final diff, 88 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0160-game-room/s1-01-xp-writer-upsert.md`, `.omni-loop/delivery/outbox/0160-game-room/s1-02-fake-postgrest-moved-by-workspaces.md`, `.omni-loop/delivery/outbox/0160-game-room/s1-03-no-level-stored-as-zero.md`, `.omni-loop/delivery/outbox/0160-game-room/s2-01-xp-read-in-the-workspace-played.md`, `.omni-loop/delivery/outbox/0160-game-room/s2-02-games-new-tag-until-the-room-is-seen.md`, `.omni-loop/delivery/outbox/0160-game-room/s2-03-game-room-needs-the-galaxy.md`, `.omni-loop/delivery/outbox/0160-game-room/s3-01-score-table-as-ready-screen.md`, `.omni-loop/delivery/outbox/0160-game-room/s3-02-game-feel-numbers.md`, `.omni-loop/delivery/outbox/0160-game-room/s3-03-a-game-keeps-its-field.md`, `.omni-loop/delivery/outbox/0160-game-room/s3-04-rows-follow-the-close-values.md`, `.omni-loop/delivery/outbox/0160-game-room/s4-01-levels-shows-the-first-five-levels.md`, `.omni-loop/delivery/outbox/0160-game-room/s5-01-scores-leave-with-the-player.md`, `.omni-loop/delivery/outbox/0160-game-room/s5-02-backup-test-outside-the-slice.md`, `.omni-loop/delivery/outbox/0160-game-room/s5-03-game-over-keys.md`, `.omni-loop/delivery/outbox/0160-game-room/s5-04-scores-read-on-their-own.md`, `.omni-loop/delivery/outbox/0160-game-room/s5-05-hi-without-a-name-upright.md`, `.omni-loop/delivery/outbox/0160-game-room/s6-01-level-memory-when-storage-refused.md`, `.omni-loop/delivery/outbox/0160-game-room/s6-02-levels-climbed-between-visits.md`, `.omni-loop/delivery/outbox/0160-game-room/s6-03-level-up-words-and-keys.md`, `.omni-loop/delivery/outbox/0160-game-room/s7-01-stale-docs-outside-the-slice.md`.

Findings: F3 · One line of the main cabinet component was rewritten by four slices · [#210](https://github.com/vertuoza/vertuo-omni-loop/issues/210); F4 · Screenshot script header was rewritten by three slices · [#211](https://github.com/vertuoza/vertuo-omni-loop/issues/211); F5 · Another line of the screenshot script was reworked by three slices · [#212](https://github.com/vertuoza/vertuo-omni-loop/issues/212); F6 · A line in the main cabinet component was rewritten three times; F7 · Rendering line in the main component changed across three slices; F8 · Neighbouring rendering line also churned across three slices; F9 · A grid helper line was rewritten by three slices; F10 · An onboarding line was rewritten by three slices; F11 · A shared scene helper line was rewritten by three slices; F12 · A scene index test line was rewritten by three slices; F13 · A block of the new scene's stylesheet was restyled three times

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
