---
prd: 2174
feature-pr: 2176
merge-sha: 7b7461e
runs: [merge, day-14]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 2174, The Constellation at real scale

The delivery taught the database to keep the repositories each PRD's plan targets, so the Constellation tab can draw real links. The `check` job went red on two separate slices for two different reasons. First, the committed types file still named `prd_topics` where the migrations generate `prd_targets`. Later, the new migration carried a date older than a migration that had since landed on main, and the order guard asked for it to be re-dated. The first version of the migration file was then rewritten, and none of its lines survive in the final diff.

## Findings

### F1 · The same check went red twice, for drifted types and then a stale migration date — `repeated-red:check` · [#2207](https://github.com/vertuoza/vertuo-omni-loop/issues/2207)

- **What happened:** The check `check` was red on 2 commits in 2 slices (s1, s5): 2 of its 6 runs were red. The rules flag a check red on 2 or more commits, or in 2 or more slices.
- **Why it matters:** Each red stopped a slice until a fix was pushed. The first cause, a generated types file left behind its migration, is already a known pattern. The second is different: the migration's date was valid when written, but `20261214090000_runner_released.sql` merged to main first, and the guard refuses any new migration dated at or before the newest one there.
- **Proposed lesson:** A slice that adds a migration checks its date against the newest migration on the default branch right before it lands, not only when it is written. If another migration has merged since, it re-dates the file, then regenerates the types from the re-dated migration.
- **Kept:** Re-dating a migration that was overtaken on main is a delivery behaviour that neither the knowledge nor the earlier lessons describe; the types drift part is already known.
- **Evidence:** [check on 386b06a in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39228562079/job/117980723476), [check on fec7a7f in s5](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39245378435/job/118035911074)
- **Stays here:** playbook/conventions#naming already says it: "A migration stays the newest until it merges" re-dates an overtaken migration after main's newest, and "The database types are generated, never written" regenerates the types with each re-date (cites #2207); the briefing Never rules repeat it

### F2 · The new migration was written once and then rewritten in full — `churn:supabase/migrations/20261213100000_prd_targets.sql`

- **What happened:** `supabase/migrations/20261213100000_prd_targets.sql` had 165 lines added across 1 commits, none of them in the final diff: 165 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** All of the first version of `supabase/migrations/20261213100000_prd_targets.sql` was replaced. This follows from the migration having to change after its first writing, so the churn repeats the cost already shown by the red check rather than pointing to a separate problem.
- **Evidence:** [386b06a (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/386b06a659d584cfb6a3b4ef76ff8e5be3204ace)

## Proposed lessons

- Before a slice with a new migration lands, compare its date with the newest migration on the default branch. If one has merged since, re-date the file and regenerate the types from it, so the order guard does not turn the check red. (F1)

## Timeline

- Feature PR [#2176](https://github.com/vertuoza/vertuo-omni-loop/pull/2176): opened `2026-10-19T08:42:26Z`, ready `2026-10-19T11:47:51Z`, merged `2026-10-19T12:06:12Z`, 204 minutes in all.
- 5 slices; waves: 4 planned, 4 as merged; median slice: 26 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#2182](https://github.com/vertuoza/vertuo-omni-loop/pull/2182) | `2026-10-19T09:05:08Z` | `2026-10-19T09:41:24Z` | 36 | 1 | 1 |
| s2 | [#2183](https://github.com/vertuoza/vertuo-omni-loop/pull/2183) | `2026-10-19T09:05:26Z` | `2026-10-19T09:41:32Z` | 36 | 1 | 1 |
| s3 | [#2191](https://github.com/vertuoza/vertuo-omni-loop/pull/2191) | `2026-10-19T09:55:23Z` | `2026-10-19T10:16:27Z` | 21 | 2 | 2 |
| s4 | [#2197](https://github.com/vertuoza/vertuo-omni-loop/pull/2197) | `2026-10-19T10:31:05Z` | `2026-10-19T10:57:27Z` | 26 | 3 | 3 |
| s5 | [#2205](https://github.com/vertuoza/vertuo-omni-loop/pull/2205) | `2026-10-19T11:13:45Z` | `2026-10-19T11:33:20Z` | 20 | 4 | 4 |

## Decisions

- Decisions: 3 raised and settled — 3 adopted, 0 agreed, 0 drifted; by rank: 3 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 5 merged sub-PRs graded against the plan — no path outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 6 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

## Checks

- 32 runs of 3 checks on 11 commits in 5 slices, read from GitHub Actions: 2 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| check | 6 | 2 | 2 | s1, s5 | 0 |
| quick | 13 | 0 | 0 | — | 0 |
| settle | 13 | 0 | 0 | — | 0 |

Red runs:

| red run | slice | commit | from its log |
| --- | --- | --- | --- |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39228562079/job/117980723476) | s1 | `386b06a` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39245378435/job/118035911074) | s5 | `fec7a7f` | no test named: its last lines are kept as an excerpt |

Findings: F1 · The same check went red twice, for drifted types and then a stale migration date · [#2207](https://github.com/vertuoza/vertuo-omni-loop/issues/2207)

## Churn

- 14 commits read across 5 merged pull requests: 1744 lines added, 1556 in the final diff, 188 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/2174-constellation-real-scale/s1-01-backfill-kept-as-a-function.md`, `.omni-loop/delivery/outbox/2174-constellation-real-scale/s2-01-label-box-measures-the-role.md`, `.omni-loop/delivery/outbox/2174-constellation-real-scale/s3-01-product-prds-no-plan-lines.md`.

Findings: F2 · The new migration was written once and then rewritten in full

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.

## After merge

- No `bug` issue naming #2174 was opened within 14 days of the merge.
- 5 GitHub Actions jobs ran on the merge commit `7b7461e`: 4 green, 0 red, 1 neither.
