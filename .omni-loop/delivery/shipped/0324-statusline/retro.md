---
prd: 324
feature-pr: 326
merge-sha: 5e5654e
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 324, A status line in Claude Code, the model, the context and the PRD you work on

_Dropped: it holds a word the rules refuse._

## Findings

### F1 · A slice edited a plan test outside its territory — `territory:s5` · [#374](https://github.com/vertuoza/vertuo-omni-loop/issues/374)

- **What happened:** Slice s5 changed 1 path outside its territory and off the plan’s shared ground: `kit/bin/plan.test.mjs`.
- **Why it matters:** The slice changed `kit/bin/plan.test.mjs`, which was neither in its territory nor on the plan's shared ground. Edits like this can collide with other slices, and they hide a real dependency that the plan never stated.
- **Proposed lesson:** When a slice needs to touch a file it does not own, add that file to the shared ground in the plan or move the change into the slice that owns it.
- **Evidence:** [#356](https://github.com/vertuoza/vertuo-omni-loop/pull/356/files)

### F2 · The head of the facts module was rewritten in most slices — `churn:kit/lib/statusline/facts.mjs:2-7` · [#375](https://github.com/vertuoza/vertuo-omni-loop/issues/375)

- **What happened:** Lines 2-7 of `kit/lib/statusline/facts.mjs`, as merged, were written and rewritten in 5 commits, in s1, s4, s5 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The opening lines of `kit/lib/statusline/facts.mjs` changed in the first slice and again in three later ones, including twice within a single slice. That suggests the imports and the shape of the facts module were never settled, so each new fact reopened them.
- **Proposed lesson:** Fix the module's imports and exported shape in the first slice, so later slices only add to it.
- **Evidence:** [639197b (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/639197b45b40a5f750311b7a728e726b12b8f111), [9450c24 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/9450c2451d9e5785d1999c4c5f40f131120b5447), [2275f97 (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/2275f974993b1d73551609de4c895614f8ff2efc), [58fb635 (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/58fb635f317ad183b14838baeddfe3fbbaf4654e), [34ea346 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/34ea34672bbf6125c5081cbdeeb472a1a5e54e91), [`kit/lib/statusline/facts.mjs` lines 2-7, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/87aa891f229908a99ebd4c9b0e4a6f881ad6067a/kit/lib/statusline/facts.mjs#L2-L7)

### F3 · The command's import lines kept changing across slices — `churn:kit/bin/commands/statusline.mjs:3-6` · [#376](https://github.com/vertuoza/vertuo-omni-loop/issues/376)

- **What happened:** Lines 3-6 of `kit/bin/commands/statusline.mjs`, as merged, were written and rewritten in 4 commits, in s1, s4, s5 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The top of `kit/bin/commands/statusline.mjs` was rewritten in four slices. Each new piece of the status line changed what the command pulled in, so the command's wiring shifted every time.
- **Proposed lesson:** Have the command depend on one stable entry point of the statusline library instead of importing each piece directly.
- **Evidence:** [639197b (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/639197b45b40a5f750311b7a728e726b12b8f111), [9450c24 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/9450c2451d9e5785d1999c4c5f40f131120b5447), [4d409a3 (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/4d409a33e90a561695b99b27b5e2a30247e47b6c), [34ea346 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/34ea34672bbf6125c5081cbdeeb472a1a5e54e91), [`kit/bin/commands/statusline.mjs` lines 3-6, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/87aa891f229908a99ebd4c9b0e4a6f881ad6067a/kit/bin/commands/statusline.mjs#L3-L6)

### F4 · The command's main body was reworked in several slices — `churn:kit/bin/commands/statusline.mjs:10-28` · [#377](https://github.com/vertuoza/vertuo-omni-loop/issues/377)

- **What happened:** Lines 10-28 of `kit/bin/commands/statusline.mjs`, as merged, were written and rewritten in 4 commits, in s1, s4 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The body of `kit/bin/commands/statusline.mjs` was rewritten four times, twice within one slice. The core of the command, reading stdin and handing off to facts and render, never settled, and later slices had to rework earlier ones.
- **Proposed lesson:** Settle the command's flow early and keep it thin, so later slices change the library rather than the command.
- **Evidence:** [639197b (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/639197b45b40a5f750311b7a728e726b12b8f111), [9450c24 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/9450c2451d9e5785d1999c4c5f40f131120b5447), [c55e9d0 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/c55e9d0d350de39e5dc15f620031e173d908067e), [34ea346 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/34ea34672bbf6125c5081cbdeeb472a1a5e54e91), [`kit/bin/commands/statusline.mjs` lines 10-28, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/87aa891f229908a99ebd4c9b0e4a6f881ad6067a/kit/bin/commands/statusline.mjs#L10-L28)

### F5 · The command test setup was rewritten in most slices — `churn:kit/bin/statusline.test.mjs:1-6` · [#378](https://github.com/vertuoza/vertuo-omni-loop/issues/378)

- **What happened:** Lines 1-6 of `kit/bin/statusline.test.mjs`, as merged, were written and rewritten in 4 commits, in s1, s4, s5 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The setup at the top of `kit/bin/statusline.test.mjs` changed alongside every reshaping of the command. Test setup that follows each internal change adds rework and makes each slice's diff noisier.
- **Proposed lesson:** Test the command through its stdin and stdout contract, so its setup does not track internal imports.
- **Evidence:** [639197b (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/639197b45b40a5f750311b7a728e726b12b8f111), [9450c24 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/9450c2451d9e5785d1999c4c5f40f131120b5447), [4d409a3 (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/4d409a33e90a561695b99b27b5e2a30247e47b6c), [34ea346 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/34ea34672bbf6125c5081cbdeeb472a1a5e54e91), [`kit/bin/statusline.test.mjs` lines 1-6, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/87aa891f229908a99ebd4c9b0e4a6f881ad6067a/kit/bin/statusline.test.mjs#L1-L6)

### F6 · One line near the end of the facts module kept changing — `churn:kit/lib/statusline/facts.mjs:180-180`

- **What happened:** Lines 180-180 of `kit/lib/statusline/facts.mjs`, as merged, were written and rewritten in 4 commits, in s1, s4, s5 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** A single line late in `kit/lib/statusline/facts.mjs`, probably part of what the module exposes, was rewritten in four slices. Each slice adjusting it means they all depended on the same exported surface.
- **Proposed lesson:** Agree on what the facts module exports before splitting the work into slices.
- **Evidence:** [639197b (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/639197b45b40a5f750311b7a728e726b12b8f111), [9450c24 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/9450c2451d9e5785d1999c4c5f40f131120b5447), [2275f97 (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/2275f974993b1d73551609de4c895614f8ff2efc), [34ea346 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/34ea34672bbf6125c5081cbdeeb472a1a5e54e91), [`kit/lib/statusline/facts.mjs` lines 180-180, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/87aa891f229908a99ebd4c9b0e4a6f881ad6067a/kit/lib/statusline/facts.mjs#L180-L180)

### F7 · The facts test header was rewritten in most slices — `churn:kit/lib/statusline/facts.test.mjs:1-5`

- **What happened:** Lines 1-5 of `kit/lib/statusline/facts.test.mjs`, as merged, were written and rewritten in 4 commits, in s1, s4, s5 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The opening lines of `kit/lib/statusline/facts.test.mjs` changed in four slices, following the churn in the module itself.
- **Proposed lesson:** Once the module surface is stable, test imports should stop moving too; keep the header as settled as the module.
- **Evidence:** [639197b (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/639197b45b40a5f750311b7a728e726b12b8f111), [9450c24 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/9450c2451d9e5785d1999c4c5f40f131120b5447), [2275f97 (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/2275f974993b1d73551609de4c895614f8ff2efc), [34ea346 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/34ea34672bbf6125c5081cbdeeb472a1a5e54e91), [`kit/lib/statusline/facts.test.mjs` lines 1-5, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/87aa891f229908a99ebd4c9b0e4a6f881ad6067a/kit/lib/statusline/facts.test.mjs#L1-L5)

### F8 · Another command test line changed in several slices — `churn:kit/bin/statusline.test.mjs:8-8`

- **What happened:** Lines 8-8 of `kit/bin/statusline.test.mjs`, as merged, were written and rewritten in 3 commits, in s1, s4 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** A single line in `kit/bin/statusline.test.mjs` was rewritten across three slices. It adds to the churn around the command's contract.
- **Evidence:** [639197b (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/639197b45b40a5f750311b7a728e726b12b8f111), [9450c24 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/9450c2451d9e5785d1999c4c5f40f131120b5447), [34ea346 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/34ea34672bbf6125c5081cbdeeb472a1a5e54e91), [`kit/bin/statusline.test.mjs` lines 8-8, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/87aa891f229908a99ebd4c9b0e4a6f881ad6067a/kit/bin/statusline.test.mjs#L8-L8)

### F9 · A facts line was rewritten in three later slices — `churn:kit/lib/statusline/facts.mjs:142-142`

- **What happened:** Lines 142-142 of `kit/lib/statusline/facts.mjs`, as merged, were written and rewritten in 3 commits, in s4, s5 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** A single line of `kit/lib/statusline/facts.mjs` was changed by three of the later slices in turn. Those slices overlapped on one piece of logic instead of owning separate pieces.
- **Evidence:** [9450c24 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/9450c2451d9e5785d1999c4c5f40f131120b5447), [2275f97 (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/2275f974993b1d73551609de4c895614f8ff2efc), [34ea346 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/34ea34672bbf6125c5081cbdeeb472a1a5e54e91), [`kit/lib/statusline/facts.mjs` lines 142-142, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/87aa891f229908a99ebd4c9b0e4a6f881ad6067a/kit/lib/statusline/facts.mjs#L142-L142)

### F10 · A facts line changed in the first slice and two later ones — `churn:kit/lib/statusline/facts.mjs:172-172`

- **What happened:** Lines 172-172 of `kit/lib/statusline/facts.mjs`, as merged, were written and rewritten in 3 commits, in s1, s4 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** Another single line of `kit/lib/statusline/facts.mjs` was rewritten across three slices, one more sign that the facts module worked as a shared hotspot.
- **Evidence:** [639197b (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/639197b45b40a5f750311b7a728e726b12b8f111), [9450c24 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/9450c2451d9e5785d1999c4c5f40f131120b5447), [34ea346 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/34ea34672bbf6125c5081cbdeeb472a1a5e54e91), [`kit/lib/statusline/facts.mjs` lines 172-172, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/87aa891f229908a99ebd4c9b0e4a6f881ad6067a/kit/lib/statusline/facts.mjs#L172-L172)

### F11 · A facts test line was rewritten across three slices — `churn:kit/lib/statusline/facts.test.mjs:7-7`

- **What happened:** Lines 7-7 of `kit/lib/statusline/facts.test.mjs`, as merged, were written and rewritten in 3 commits, in s1, s4 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** A line of `kit/lib/statusline/facts.test.mjs` changed in three slices, following the churn in the module it tests.
- **Evidence:** [639197b (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/639197b45b40a5f750311b7a728e726b12b8f111), [9450c24 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/9450c2451d9e5785d1999c4c5f40f131120b5447), [34ea346 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/34ea34672bbf6125c5081cbdeeb472a1a5e54e91), [`kit/lib/statusline/facts.test.mjs` lines 7-7, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/87aa891f229908a99ebd4c9b0e4a6f881ad6067a/kit/lib/statusline/facts.test.mjs#L7-L7)

### F12 · The head of the render module was reshaped in three slices — `churn:kit/lib/statusline/render.mjs:9-15`

- **What happened:** Lines 9-15 of `kit/lib/statusline/render.mjs`, as merged, were written and rewritten in 3 commits, in s1, s4 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** Early lines of `kit/lib/statusline/render.mjs` were rewritten in three slices. The renderer's setup shifted each time a new element of the status line arrived.
- **Proposed lesson:** Give the renderer a stable way to take new segments, so adding one does not rewrite its setup.
- **Evidence:** [639197b (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/639197b45b40a5f750311b7a728e726b12b8f111), [041e7fe (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/041e7feecbc7610e4eb731ae6c50d1e7b3eb9946), [8d5cf30 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/8d5cf30825d18e04212c503f2060f19eba5bf43e), [`kit/lib/statusline/render.mjs` lines 9-15, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/87aa891f229908a99ebd4c9b0e4a6f881ad6067a/kit/lib/statusline/render.mjs#L9-L15)

### F13 · More render setup lines changed in three slices — `churn:kit/lib/statusline/render.mjs:19-21`

- **What happened:** Lines 19-21 of `kit/lib/statusline/render.mjs`, as merged, were written and rewritten in 3 commits, in s1, s4 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** A short range near the top of `kit/lib/statusline/render.mjs` was rewritten three times, in the same commits as the neighbouring churn.
- **Evidence:** [639197b (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/639197b45b40a5f750311b7a728e726b12b8f111), [041e7fe (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/041e7feecbc7610e4eb731ae6c50d1e7b3eb9946), [8d5cf30 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/8d5cf30825d18e04212c503f2060f19eba5bf43e), [`kit/lib/statusline/render.mjs` lines 19-21, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/87aa891f229908a99ebd4c9b0e4a6f881ad6067a/kit/lib/statusline/render.mjs#L19-L21)

### F14 · The end of the render module changed in three slices — `churn:kit/lib/statusline/render.mjs:186-188`

- **What happened:** Lines 186-188 of `kit/lib/statusline/render.mjs`, as merged, were written and rewritten in 3 commits, in s1, s4 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The closing lines of `kit/lib/statusline/render.mjs`, probably its exports or its final assembly, were rewritten three times. Each slice touched how the status line gets put together.
- **Evidence:** [639197b (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/639197b45b40a5f750311b7a728e726b12b8f111), [041e7fe (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/041e7feecbc7610e4eb731ae6c50d1e7b3eb9946), [8d5cf30 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/8d5cf30825d18e04212c503f2060f19eba5bf43e), [`kit/lib/statusline/render.mjs` lines 186-188, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/87aa891f229908a99ebd4c9b0e4a6f881ad6067a/kit/lib/statusline/render.mjs#L186-L188)

### F15 · The render test header was rewritten in three slices — `churn:kit/lib/statusline/render.test.mjs:1-3`

- **What happened:** Lines 1-3 of `kit/lib/statusline/render.test.mjs`, as merged, were written and rewritten in 3 commits, in s1, s4 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The imports of `kit/lib/statusline/render.test.mjs` followed every change to the render module's surface.
- **Evidence:** [639197b (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/639197b45b40a5f750311b7a728e726b12b8f111), [041e7fe (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/041e7feecbc7610e4eb731ae6c50d1e7b3eb9946), [8d5cf30 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/8d5cf30825d18e04212c503f2060f19eba5bf43e), [`kit/lib/statusline/render.test.mjs` lines 1-3, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/87aa891f229908a99ebd4c9b0e4a6f881ad6067a/kit/lib/statusline/render.test.mjs#L1-L3)

## Proposed lessons

- Settle the shape of the shared statusline modules (imports, exports, how facts and segments are added) in the first slice, so later slices extend them instead of rewriting their heads and tails. (F2, F6, F12, F13, F14, F9, F10)
- Keep the command thin and test it through its stdin and stdout contract, so neither the command nor its tests move each time the library grows. (F3, F4, F5, F8)
- Test headers churn when module surfaces churn; stabilising the module is the fix, not the tests. (F7, F11, F15)
- List every file a slice must touch, tests of other commands included, in its territory or on the shared ground before the build begins. (F1)

## Timeline

- Feature PR [#326](https://github.com/vertuoza/vertuo-omni-loop/pull/326): opened `2026-09-28T06:44:25Z`, ready `2026-09-28T08:51:24Z`, merged `2026-09-28T08:52:42Z`, 128 minutes in all.
- 6 slices; waves: 5 planned, 5 as merged; median slice: 17 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#329](https://github.com/vertuoza/vertuo-omni-loop/pull/329) | `2026-09-28T06:49:54Z` | `2026-09-28T07:02:36Z` | 13 | 1 | 1 |
| s2 | [#334](https://github.com/vertuoza/vertuo-omni-loop/pull/334) | `2026-09-28T07:05:16Z` | `2026-09-28T07:19:55Z` | 15 | 2 | 2 |
| s3 | [#335](https://github.com/vertuoza/vertuo-omni-loop/pull/335) | `2026-09-28T07:05:19Z` | `2026-09-28T07:20:16Z` | 15 | 2 | 2 |
| s4 | [#342](https://github.com/vertuoza/vertuo-omni-loop/pull/342) | `2026-09-28T07:22:46Z` | `2026-09-28T07:41:55Z` | 19 | 3 | 3 |
| s5 | [#356](https://github.com/vertuoza/vertuo-omni-loop/pull/356) | `2026-09-28T07:43:56Z` | `2026-09-28T08:05:58Z` | 22 | 4 | 4 |
| s6 | [#364](https://github.com/vertuoza/vertuo-omni-loop/pull/364) | `2026-09-28T08:08:27Z` | `2026-09-28T08:29:26Z` | 21 | 5 | 5 |

## Decisions

- Decisions: 11 raised and settled — 11 adopted, 0 agreed, 0 drifted; by rank: 11 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 6 merged sub-PRs graded against the plan — 1 path outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 7 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F1 · A slice edited a plan test outside its territory · [#374](https://github.com/vertuoza/vertuo-omni-loop/issues/374)

## Churn

- 28 commits read across 6 merged pull requests: 3957 lines added, 3834 in the final diff, 123 lines of churn.
- Left out as generated, by `.gitattributes`: `kit/dist/omni.mjs`.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0324-statusline/s1-01-context-bar-cells-rounded-down.md`, `.omni-loop/delivery/outbox/0324-statusline/s1-02-five-hour-reset-time-read.md`, `.omni-loop/delivery/outbox/0324-statusline/s2-01-commit-line-names-settings.md`, `.omni-loop/delivery/outbox/0324-statusline/s2-02-settings-not-an-object-left-alone.md`, `.omni-loop/delivery/outbox/0324-statusline/s2-03-status-line-steps-only-when-on.md`, `.omni-loop/delivery/outbox/0324-statusline/s3-01-rest-of-home-still-says-one-folder.md`, `.omni-loop/delivery/outbox/0324-statusline/s4-01-topic-cut-just-enough.md`, `.omni-loop/delivery/outbox/0324-statusline/s4-02-shared-topic-highest-prd.md`, `.omni-loop/delivery/outbox/0324-statusline/s5-01-plan-test-runs-without-session.md`, `.omni-loop/delivery/outbox/0324-statusline/s6-01-board-refreshed-for-inbox-prds-only.md`, `.omni-loop/delivery/outbox/0324-statusline/s6-02-refresh-gives-up-after-a-minute.md`.

Findings: F2 · The head of the facts module was rewritten in most slices · [#375](https://github.com/vertuoza/vertuo-omni-loop/issues/375); F3 · The command's import lines kept changing across slices · [#376](https://github.com/vertuoza/vertuo-omni-loop/issues/376); F4 · The command's main body was reworked in several slices · [#377](https://github.com/vertuoza/vertuo-omni-loop/issues/377); F5 · The command test setup was rewritten in most slices · [#378](https://github.com/vertuoza/vertuo-omni-loop/issues/378); F6 · One line near the end of the facts module kept changing; F7 · The facts test header was rewritten in most slices; F8 · Another command test line changed in several slices; F9 · A facts line was rewritten in three later slices; F10 · A facts line changed in the first slice and two later ones; F11 · A facts test line was rewritten across three slices; F12 · The head of the render module was reshaped in three slices; F13 · More render setup lines changed in three slices; F14 · The end of the render module changed in three slices; F15 · The render test header was rewritten in three slices

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
