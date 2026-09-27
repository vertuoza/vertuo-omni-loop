---
prd: 284
feature-pr: 286
merge-sha: d01632c
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 284, Omni theme — the homepage's palette on the app, beside Light and Dark

_Dropped: it holds a word the rules refuse._

## Findings

### F1 · A slice edited a test file outside its planned ground — `territory:s2` · [#297](https://github.com/vertuoza/vertuo-omni-loop/issues/297)

- **What happened:** Slice s2 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/src/ask/theme-color.test.ts`.
- **Why it matters:** The plan split the work so that each slice owned its own files and shared ground was named up front. This slice reached into the colour test for the ask pages, which the plan had not given it and had not listed as shared. When a slice edits a file it does not own, parallel slices can collide on that file, and the plan stops being a reliable map of who touched what. That change was probably needed, since a new theme will affect colour tests, but the plan did not foresee it.
- **Proposed lesson:** When a change adds or alters a theme, list the colour and theme tests of every affected page as shared ground in the plan, or give them to one slice by name.
- **Evidence:** [#291](https://github.com/vertuoza/vertuo-omni-loop/pull/291/files)

## Proposed lessons

- A new theme touches colour tests across pages. Plan those tests as shared ground or give them to a named slice, so no slice has to step outside its files to keep them passing. (F1)

## Timeline

- Feature PR [#286](https://github.com/vertuoza/vertuo-omni-loop/pull/286): opened `2026-09-27T18:15:58Z`, ready `2026-09-27T18:55:47Z`, merged `2026-09-27T19:10:46Z`, 55 minutes in all.
- 2 slices; waves: 2 planned, 2 as merged; median slice: 12 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#290](https://github.com/vertuoza/vertuo-omni-loop/pull/290) | `2026-09-27T18:23:44Z` | `2026-09-27T18:32:45Z` | 9 | 1 | 1 |
| s2 | [#291](https://github.com/vertuoza/vertuo-omni-loop/pull/291) | `2026-09-27T18:35:57Z` | `2026-09-27T18:50:22Z` | 14 | 2 | 2 |

## Decisions

- Decisions: 1 raised and settled — 1 adopted, 0 agreed, 0 drifted; by rank: 1 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 2 merged sub-PRs graded against the plan — 1 path outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 3 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F1 · A slice edited a test file outside its planned ground · [#297](https://github.com/vertuoza/vertuo-omni-loop/issues/297)

## Churn

- 9 commits read across 2 merged pull requests: 235 lines added, 235 in the final diff, 0 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0284-omni-theme/s2-01-theme-colour-test-beside-the-theme.md`.

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
