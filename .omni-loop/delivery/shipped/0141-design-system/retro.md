---
prd: 141
feature-pr: 153
merge-sha: ae719f7
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 141, Omni Loop design system — one library for the logo, colours, fonts and sprites

Facts only: model reply invalid

## Findings

### F1 · Slice s3 changed files outside its territory — `territory:s3` · [#193](https://github.com/vertuoza/vertuo-omni-loop/issues/193)

- **What happened:** Slice s3 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/app/knowledge/layout.tsx`.
- **Evidence:** [#168](https://github.com/vertuoza/vertuo-omni-loop/pull/168/files)

### F2 · Much of `.omni-loop/delivery/outbox/0141-design-system/s3-03-type-scale-values.md` was written, then rewritten — `churn:.omni-loop/delivery/outbox/0141-design-system/s3-03-type-scale-values.md` · [#194](https://github.com/vertuoza/vertuo-omni-loop/issues/194)

- **What happened:** `.omni-loop/delivery/outbox/0141-design-system/s3-03-type-scale-values.md` had 50 lines added across 1 commits, none of them in the final diff: 50 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Evidence:** [68ac5c3 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/68ac5c30d3a86217497f52f90766bf75d20dc81b)

### F3 · Much of `.omni-loop/delivery/outbox/0141-design-system/s3-02-font-alphabets.md` was written, then rewritten — `churn:.omni-loop/delivery/outbox/0141-design-system/s3-02-font-alphabets.md` · [#195](https://github.com/vertuoza/vertuo-omni-loop/issues/195)

- **What happened:** `.omni-loop/delivery/outbox/0141-design-system/s3-02-font-alphabets.md` had 49 lines added across 1 commits, none of them in the final diff: 49 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Evidence:** [68ac5c3 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/68ac5c30d3a86217497f52f90766bf75d20dc81b)

### F4 · Much of `.omni-loop/delivery/outbox/0141-design-system/s4-01-pose-builds.md` was written, then rewritten — `churn:.omni-loop/delivery/outbox/0141-design-system/s4-01-pose-builds.md` · [#196](https://github.com/vertuoza/vertuo-omni-loop/issues/196)

- **What happened:** `.omni-loop/delivery/outbox/0141-design-system/s4-01-pose-builds.md` had 49 lines added across 1 commits, none of them in the final diff: 49 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Evidence:** [451afc7 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/451afc7d570f4c5a7a23d491829da42deb5339bb)

### F5 · Much of `.omni-loop/delivery/outbox/0141-design-system/s5-01-crest-final-pixels.md` was written, then rewritten — `churn:.omni-loop/delivery/outbox/0141-design-system/s5-01-crest-final-pixels.md` · [#197](https://github.com/vertuoza/vertuo-omni-loop/issues/197)

- **What happened:** `.omni-loop/delivery/outbox/0141-design-system/s5-01-crest-final-pixels.md` had 49 lines added across 1 commits, none of them in the final diff: 49 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Evidence:** [453657a (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/453657a9d8cfec9dac829694dbb9b9b51cc4f051)

### F6 · Much of `.omni-loop/delivery/outbox/0141-design-system/s5-02-boot-draws-the-o-title-draws-the-word.md` was written, then rewritten — `churn:.omni-loop/delivery/outbox/0141-design-system/s5-02-boot-draws-the-o-title-draws-the-word.md`

- **What happened:** `.omni-loop/delivery/outbox/0141-design-system/s5-02-boot-draws-the-o-title-draws-the-word.md` had 49 lines added across 1 commits, none of them in the final diff: 49 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Evidence:** [453657a (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/453657a9d8cfec9dac829694dbb9b9b51cc4f051)

### F7 · Much of `.omni-loop/delivery/outbox/0141-design-system/s5-03-house-letter-in-the-intro.md` was written, then rewritten — `churn:.omni-loop/delivery/outbox/0141-design-system/s5-03-house-letter-in-the-intro.md`

- **What happened:** `.omni-loop/delivery/outbox/0141-design-system/s5-03-house-letter-in-the-intro.md` had 49 lines added across 1 commits, none of them in the final diff: 49 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Evidence:** [453657a (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/453657a9d8cfec9dac829694dbb9b9b51cc4f051)

### F8 · Much of `.omni-loop/delivery/outbox/0141-design-system/s6-01-design-page-shows-the-built-in-fleets.md` was written, then rewritten — `churn:.omni-loop/delivery/outbox/0141-design-system/s6-01-design-page-shows-the-built-in-fleets.md`

- **What happened:** `.omni-loop/delivery/outbox/0141-design-system/s6-01-design-page-shows-the-built-in-fleets.md` had 49 lines added across 1 commits, none of them in the final diff: 49 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Evidence:** [2e89210 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/2e892102d5b6695d5f72847c9dde8d4944b0ff9c)

### F9 · Much of `.omni-loop/delivery/outbox/0141-design-system/s6-02-design-page-screenshots-described-not-attached.md` was written, then rewritten — `churn:.omni-loop/delivery/outbox/0141-design-system/s6-02-design-page-screenshots-described-not-attached.md`

- **What happened:** `.omni-loop/delivery/outbox/0141-design-system/s6-02-design-page-screenshots-described-not-attached.md` had 49 lines added across 1 commits, none of them in the final diff: 49 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Evidence:** [2e89210 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/2e892102d5b6695d5f72847c9dde8d4944b0ff9c)

### F10 · Much of `.omni-loop/delivery/outbox/0141-design-system/s7-01-logo-minimum-sizes-and-grounds.md` was written, then rewritten — `churn:.omni-loop/delivery/outbox/0141-design-system/s7-01-logo-minimum-sizes-and-grounds.md`

- **What happened:** `.omni-loop/delivery/outbox/0141-design-system/s7-01-logo-minimum-sizes-and-grounds.md` had 49 lines added across 1 commits, none of them in the final diff: 49 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Evidence:** [40d03a0 (s7)](https://github.com/vertuoza/vertuo-omni-loop/commit/40d03a091b0bd138672580a3f5dad3b7539748e2)

### F11 · Much of `.omni-loop/delivery/outbox/0141-design-system/s2-01-pixel-palette-stays-in-its-file.md` was written, then rewritten — `churn:.omni-loop/delivery/outbox/0141-design-system/s2-01-pixel-palette-stays-in-its-file.md`

- **What happened:** `.omni-loop/delivery/outbox/0141-design-system/s2-01-pixel-palette-stays-in-its-file.md` had 48 lines added across 1 commits, none of them in the final diff: 48 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Evidence:** [e96d6f5 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/e96d6f5686233300f0bd9ee192318a5cb3a57c80)

### F12 · Much of `.omni-loop/delivery/outbox/0141-design-system/s2-02-vertuoza-mark-colours-stay-in-the-game.md` was written, then rewritten — `churn:.omni-loop/delivery/outbox/0141-design-system/s2-02-vertuoza-mark-colours-stay-in-the-game.md`

- **What happened:** `.omni-loop/delivery/outbox/0141-design-system/s2-02-vertuoza-mark-colours-stay-in-the-game.md` had 48 lines added across 1 commits, none of them in the final diff: 48 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Evidence:** [e96d6f5 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/e96d6f5686233300f0bd9ee192318a5cb3a57c80)

### F13 · Much of `.omni-loop/delivery/outbox/0141-design-system/s2-03-ask-colours-stay-out-of-the-shared-stylesheet.md` was written, then rewritten — `churn:.omni-loop/delivery/outbox/0141-design-system/s2-03-ask-colours-stay-out-of-the-shared-stylesheet.md`

- **What happened:** `.omni-loop/delivery/outbox/0141-design-system/s2-03-ask-colours-stay-out-of-the-shared-stylesheet.md` had 48 lines added across 1 commits, none of them in the final diff: 48 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Evidence:** [e96d6f5 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/e96d6f5686233300f0bd9ee192318a5cb3a57c80)

### F14 · Much of `.omni-loop/delivery/outbox/0141-design-system/s3-01-knowledge-page-fonts.md` was written, then rewritten — `churn:.omni-loop/delivery/outbox/0141-design-system/s3-01-knowledge-page-fonts.md`

- **What happened:** `.omni-loop/delivery/outbox/0141-design-system/s3-01-knowledge-page-fonts.md` had 48 lines added across 1 commits, none of them in the final diff: 48 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Evidence:** [68ac5c3 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/68ac5c30d3a86217497f52f90766bf75d20dc81b)

### F15 · Much of `.omni-loop/delivery/outbox/0141-design-system/s5-04-boot-learns-the-crest-outside-its-ground.md` was written, then rewritten — `churn:.omni-loop/delivery/outbox/0141-design-system/s5-04-boot-learns-the-crest-outside-its-ground.md`

- **What happened:** `.omni-loop/delivery/outbox/0141-design-system/s5-04-boot-learns-the-crest-outside-its-ground.md` had 48 lines added across 1 commits, none of them in the final diff: 48 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Evidence:** [453657a (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/453657a9d8cfec9dac829694dbb9b9b51cc4f051)

### F16 · Lines 6-6 of `packages/design/package.json` were rewritten again and again — `churn:packages/design/package.json:6-6`

- **What happened:** Lines 6-6 of `packages/design/package.json`, as merged, were written and rewritten in 3 commits, in s1, s2 and s5; the rules flag a line range rewritten in 3 or more commits.
- **Evidence:** [9561fb1 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/9561fb13d8c6ad8aea50bb3a4c5eebe03a029c24), [afded66 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/afded6639eb03a546bcc143f9e9ebbaea7707427), [0166576 (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/0166576cf6fbf3620c70d27f0f81dd5668ffd304), [`packages/design/package.json` lines 6-6, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/92977b19758daedb8958433410ba59f0026642c3/packages/design/package.json#L6-L6)

### F17 · Lines 8-9 of `packages/design/package.json` were rewritten again and again — `churn:packages/design/package.json:8-9`

- **What happened:** Lines 8-9 of `packages/design/package.json`, as merged, were written and rewritten in 3 commits, in s1, s2 and s3; the rules flag a line range rewritten in 3 or more commits.
- **Evidence:** [9561fb1 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/9561fb13d8c6ad8aea50bb3a4c5eebe03a029c24), [afded66 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/afded6639eb03a546bcc143f9e9ebbaea7707427), [96840f2 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/96840f250c11d052928bdfef0255e6acf5667314), [`packages/design/package.json` lines 8-9, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/92977b19758daedb8958433410ba59f0026642c3/packages/design/package.json#L8-L9)

## Proposed lessons

None proposed: facts only.

## Timeline

- Feature PR [#153](https://github.com/vertuoza/vertuo-omni-loop/pull/153): opened `2026-09-26T10:05:43Z`, ready `2026-09-26T15:51:25Z`, merged `2026-09-26T15:56:02Z`, 350 minutes in all.
- 7 slices; waves: 5 planned, 5 as merged; median slice: 11 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#164](https://github.com/vertuoza/vertuo-omni-loop/pull/164) | `2026-09-26T14:46:02Z` | `2026-09-26T14:51:33Z` | 6 | 1 | 1 |
| s2 | [#165](https://github.com/vertuoza/vertuo-omni-loop/pull/165) | `2026-09-26T14:53:14Z` | `2026-09-26T15:05:56Z` | 13 | 2 | 2 |
| s4 | [#166](https://github.com/vertuoza/vertuo-omni-loop/pull/166) | `2026-09-26T14:53:22Z` | `2026-09-26T15:06:38Z` | 13 | 2 | 2 |
| s3 | [#168](https://github.com/vertuoza/vertuo-omni-loop/pull/168) | `2026-09-26T15:08:14Z` | `2026-09-26T15:18:13Z` | 10 | 3 | 3 |
| s5 | [#184](https://github.com/vertuoza/vertuo-omni-loop/pull/184) | `2026-09-26T15:19:19Z` | `2026-09-26T15:37:00Z` | 18 | 4 | 4 |
| s6 | [#189](https://github.com/vertuoza/vertuo-omni-loop/pull/189) | `2026-09-26T15:37:56Z` | `2026-09-26T15:48:29Z` | 11 | 5 | 5 |
| s7 | [#190](https://github.com/vertuoza/vertuo-omni-loop/pull/190) | `2026-09-26T15:38:04Z` | `2026-09-26T15:49:08Z` | 11 | 5 | 5 |

## Decisions

- Decisions: 14 raised and settled — 14 adopted, 0 agreed, 0 drifted; by rank: 14 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 7 merged sub-PRs graded against the plan — 1 path outside a slice’s territory, 2 more on shared ground.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 8 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F1 · Slice s3 changed files outside its territory · [#193](https://github.com/vertuoza/vertuo-omni-loop/issues/193)

## Churn

- 27 commits read across 7 merged pull requests: 4002 lines added, 3290 in the final diff, 718 lines of churn.
- Left out as lockfiles: `pnpm-lock.yaml`.

Findings: F2 · Much of `.omni-loop/delivery/outbox/0141-design-system/s3-03-type-scale-values.md` was written, then rewritten · [#194](https://github.com/vertuoza/vertuo-omni-loop/issues/194); F3 · Much of `.omni-loop/delivery/outbox/0141-design-system/s3-02-font-alphabets.md` was written, then rewritten · [#195](https://github.com/vertuoza/vertuo-omni-loop/issues/195); F4 · Much of `.omni-loop/delivery/outbox/0141-design-system/s4-01-pose-builds.md` was written, then rewritten · [#196](https://github.com/vertuoza/vertuo-omni-loop/issues/196); F5 · Much of `.omni-loop/delivery/outbox/0141-design-system/s5-01-crest-final-pixels.md` was written, then rewritten · [#197](https://github.com/vertuoza/vertuo-omni-loop/issues/197); F6 · Much of `.omni-loop/delivery/outbox/0141-design-system/s5-02-boot-draws-the-o-title-draws-the-word.md` was written, then rewritten; F7 · Much of `.omni-loop/delivery/outbox/0141-design-system/s5-03-house-letter-in-the-intro.md` was written, then rewritten; F8 · Much of `.omni-loop/delivery/outbox/0141-design-system/s6-01-design-page-shows-the-built-in-fleets.md` was written, then rewritten; F9 · Much of `.omni-loop/delivery/outbox/0141-design-system/s6-02-design-page-screenshots-described-not-attached.md` was written, then rewritten; F10 · Much of `.omni-loop/delivery/outbox/0141-design-system/s7-01-logo-minimum-sizes-and-grounds.md` was written, then rewritten; F11 · Much of `.omni-loop/delivery/outbox/0141-design-system/s2-01-pixel-palette-stays-in-its-file.md` was written, then rewritten; F12 · Much of `.omni-loop/delivery/outbox/0141-design-system/s2-02-vertuoza-mark-colours-stay-in-the-game.md` was written, then rewritten; F13 · Much of `.omni-loop/delivery/outbox/0141-design-system/s2-03-ask-colours-stay-out-of-the-shared-stylesheet.md` was written, then rewritten; F14 · Much of `.omni-loop/delivery/outbox/0141-design-system/s3-01-knowledge-page-fonts.md` was written, then rewritten; F15 · Much of `.omni-loop/delivery/outbox/0141-design-system/s5-04-boot-learns-the-crest-outside-its-ground.md` was written, then rewritten; F16 · Lines 6-6 of `packages/design/package.json` were rewritten again and again; F17 · Lines 8-9 of `packages/design/package.json` were rewritten again and again

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
