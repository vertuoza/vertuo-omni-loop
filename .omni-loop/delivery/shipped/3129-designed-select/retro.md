---
prd: 3129
feature-pr: 3131
merge-sha: d84e72f
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 3129, One designed Select for every dropdown

The delivery replaced the native dropdown with one designed Select and moved the app's raw dropdowns onto it, across five slices. The visual check stayed red on every commit of every slice: the new Select no longer matched its stored screenshots, two new size variants had no stored screenshot at all, and the filter bar that holds a Select drifted with it. None of the slices refreshed those screenshots, so the same red was carried from the first slice to the last. Three slices also touched a few files outside their declared territory, mostly test files and, in one case, the package manifest with its lockfile.

## Findings

### F1 · Visual check stayed red through every slice after the Select redesign — `repeated-red:visual` · [#3140](https://github.com/vertuoza/vertuo-omni-loop/issues/3140)

- **What happened:** The check `visual` was red on 5 commits in 5 slices (s1, s2, s3, s4, s5): 6 of its 6 runs were red. The rules flag a check red on 2 or more commits, or in 2 or more slices.
- **Why it matters:** Redesigning a shared component changes its look on purpose, so its stored screenshots and those of every component that embeds it go stale. Here the stored images for `design/Select/invalid-true-omni.png` and its siblings differed widely, the new size variants such as `design/Select/size-md-omni.png` had no stored image, and the filter bar drifted too. Because no slice refreshed them, the check was red on every run, and any real visual regression in later slices was hidden under the expected one.
- **Proposed lesson:** When a slice deliberately changes a shared component's look or adds a variant, it regenerates the visual baselines for that component and for every component that embeds it in the same slice, so the visual check is green again before the next slice builds on it.
- **Kept:** Neither the knowledge nor earlier lessons cover refreshing visual baselines after an intended redesign; it is about delivery behaviour, not the look itself.
- **Evidence:** [visual on 539fa14 in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/44886870244/job/136793948836), [visual on 6599966 in s2](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/44892397149/job/136810848655), [visual on 75b4a24 in s3](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/44897348282/job/136825742899), [visual on 991dcc0 in s4](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/44900869300/job/136836292319), [visual on 4fc07c6 in s5](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/44903975514/job/136845545673), [visual on 4fc07c6 in s5](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/44904640547/job/136847490194)
- **Became:** `playbook/ci#gating`

### F2 · First slice edited a field test outside its territory — `territory:s1`

- **What happened:** Slice s1 changed 1 path outside its territory and off the plan’s shared ground: `packages/ui/src/Field.dom.test.ts`.
- **Why it matters:** The slice changed `packages/ui/src/Field.dom.test.ts`, a test of a neighbouring component, without the plan listing it, so the plan's table did not show every file the slice would touch.
- **Evidence:** [#3133](https://github.com/vertuoza/vertuo-omni-loop/pull/3133/files)

### F3 · Second slice changed the app manifest, lockfile and a render test — `territory:s2`

- **What happened:** Slice s2 changed 3 paths outside its territory and off the plan’s shared ground: `apps/galaxy/package.json`, `apps/galaxy/src/business/render.test.ts`, `pnpm-lock.yaml`.
- **Why it matters:** _Dropped: it holds a word the rules refuse._
- **Evidence:** [#3135](https://github.com/vertuoza/vertuo-omni-loop/pull/3135/files)

### F4 · Fourth slice edited a board test outside its territory — `territory:s4`

- **What happened:** Slice s4 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/src/ideas/Board.test.ts`.
- **Why it matters:** _Dropped: it holds a word the rules refuse._
- **Evidence:** [#3137](https://github.com/vertuoza/vertuo-omni-loop/pull/3137/files)

## Proposed lessons

- When a slice deliberately changes a shared component's look or adds a variant, it regenerates the visual baselines for that component and for every component that embeds it in the same slice, so the visual check is green again before the next slice builds on it. (F1)

## Timeline

- Feature PR [#3131](https://github.com/vertuoza/vertuo-omni-loop/pull/3131): opened `2026-11-21T07:39:11Z`, ready `2026-11-21T16:31:49Z`, merged `2026-11-21T16:40:36Z`, 541 minutes in all.
- 5 slices; waves: 5 planned, 5 as merged; median slice: 23 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#3133](https://github.com/vertuoza/vertuo-omni-loop/pull/3133) | `2026-11-21T08:30:35Z` | `2026-11-21T08:52:56Z` | 22 | 1 | 1 |
| s2 | [#3135](https://github.com/vertuoza/vertuo-omni-loop/pull/3135) | `2026-11-21T09:31:00Z` | `2026-11-21T10:03:12Z` | 32 | 2 | 2 |
| s3 | [#3136](https://github.com/vertuoza/vertuo-omni-loop/pull/3136) | `2026-11-21T10:26:12Z` | `2026-11-21T11:05:12Z` | 39 | 3 | 3 |
| s4 | [#3137](https://github.com/vertuoza/vertuo-omni-loop/pull/3137) | `2026-11-21T11:26:38Z` | `2026-11-21T11:49:27Z` | 23 | 4 | 4 |
| s5 | [#3138](https://github.com/vertuoza/vertuo-omni-loop/pull/3138) | `2026-11-21T12:12:51Z` | `2026-11-21T12:35:33Z` | 23 | 5 | 5 |

## Decisions

- Decisions: 4 raised and settled — 4 adopted, 0 agreed, 0 drifted; by rank: 4 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 5 merged sub-PRs graded against the plan — 5 paths outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 6 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F2 · First slice edited a field test outside its territory; F3 · Second slice changed the app manifest, lockfile and a render test; F4 · Fourth slice edited a board test outside its territory

## Checks

- 62 runs of 6 checks on 10 commits in 5 slices, read from GitHub Actions: 7 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| check | 4 | 0 | 0 | — | 0 |
| gitleaks | 15 | 0 | 0 | — | 0 |
| open-source | 15 | 0 | 0 | — | 0 |
| quick | 11 | 1 | 1 | s1 | 0 |
| settle | 11 | 0 | 0 | — | 0 |
| visual | 6 | 6 | 5 | s1, s2, s3, s4, s5 | 0 |

Failing tests, as the red runs’ logs name them:

| test | red runs | checks | slices |
| --- | --- | --- | --- |
| `packages/ui/build/manifest.test.ts > the design manifest > AC-1: is what the committed design-system.json holds` | 1 | quick | s1 |

Red runs:

| red run | slice | commit | from its log |
| --- | --- | --- | --- |
| [visual](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/44886870244/job/136793948836) | s1 | `539fa14` | no test named: its last lines are kept as an excerpt |
| [quick](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/44886870228/job/136794139734) | s1 | `539fa14` | Vitest: 1 failed, 5149 passed, 5150 total |
| [visual](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/44892397149/job/136810848655) | s2 | `6599966` | no test named: its last lines are kept as an excerpt |
| [visual](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/44897348282/job/136825742899) | s3 | `75b4a24` | no test named: its last lines are kept as an excerpt |
| [visual](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/44900869300/job/136836292319) | s4 | `991dcc0` | no test named: its last lines are kept as an excerpt |
| [visual](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/44903975514/job/136845545673) | s5 | `4fc07c6` | no test named: its last lines are kept as an excerpt |
| [visual](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/44904640547/job/136847490194) | s5 | `4fc07c6` | no test named: its last lines are kept as an excerpt |

Findings: F1 · Visual check stayed red through every slice after the Select redesign · [#3140](https://github.com/vertuoza/vertuo-omni-loop/issues/3140)

## Churn

- 15 commits read across 5 merged pull requests: 1164 lines added, 1156 in the final diff, 8 lines of churn.
- Left out as lockfiles: `pnpm-lock.yaml`.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/3129-designed-select/s1-01-field-test-follows-the-select.md`, `.omni-loop/delivery/outbox/3129-designed-select/s2-01-s2-dom-test-dev-dependencies.md`, `.omni-loop/delivery/outbox/3129-designed-select/s4-01-board-test-reads-the-select.md`, `.omni-loop/delivery/outbox/3129-designed-select/s4-02-jev-mode-list-hides-locked-modes.md`.

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
