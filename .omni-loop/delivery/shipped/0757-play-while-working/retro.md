---
prd: 757
feature-pr: 760
merge-sha: 97d31fc
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 757, Play while Claude works

The delivery made Claude's working state reach the Omni page through a new record of working pings backed by a database migration. The second slice stumbled: the database check for working pings failed the same way on two separate commits. The `working_ping` function wrote a row for a PRD with no number, and the table's own `working_pings_work_shape` constraint refused it. The migration was then rewritten until none of its first version survived. Both slices also touched files outside their declared territory: help entries in one, the supabase workflow and its check file in the other.

## Findings

### F1 · The working pings database check failed the same way twice — `repeated-red:check` · [#778](https://github.com/vertuoza/vertuo-omni-loop/issues/778)

- **What happened:** The check `check` was red on 2 commits in 1 slice (s2): 2 of its 5 runs were red. The rules flag a check red on 2 or more commits, or in 2 or more slices.
- **Why it matters:** Both red runs stopped at the same line of `supabase/checks/working_pings.sql`. The `working_ping` function inserted a PRD ping with no number, and the table's `working_pings_work_shape` constraint rejected that row. The function and the constraint disagreed about which shapes of work are valid. The second push repeated the failure, so the first attempt at a fix never reached the real mismatch.
- **Proposed lesson:** When a database function writes into a table with a shape constraint, run the database checks locally against every kind of work the function accepts before pushing. A fix for a red check should not be pushed until the same check passes locally.
- **Kept:** Neither the knowledge nor any earlier lesson says to reconcile a writing function with its table constraint and verify locally before pushing a repeat fix.
- **Evidence:** [check on 2e33e19 in s2](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/36702382672/job/109844595239), [check on 55c655f in s2](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/36702857725/job/109846108056)

### F2 · Slice s1 changed files outside its territory — `territory:s1`

- **Title:** _Dropped: it holds a digit._
- **What happened:** Slice s1 changed 2 paths outside its territory and off the plan’s shared ground: `kit/lib/help/entries.mjs`, `kit/lib/help/entries.test.mjs`.
- **Why it matters:** `kit/lib/help/entries.mjs` and its test were changed by a slice that did not declare them. Undeclared shared files make parallel slices collide without warning.
- **Evidence:** [#762](https://github.com/vertuoza/vertuo-omni-loop/pull/762/files)

### F3 · Slice s2 changed files outside its territory — `territory:s2`

- **Title:** _Dropped: it holds a digit._
- **What happened:** Slice s2 changed 2 paths outside its territory and off the plan’s shared ground: `.github/workflows/supabase.yml`, `supabase/checks/working_pings.sql`.
- **Why it matters:** Adding the migration pulled in `.github/workflows/supabase.yml` and `supabase/checks/working_pings.sql`, neither of which the plan gave to the slice.
- **Evidence:** [#763](https://github.com/vertuoza/vertuo-omni-loop/pull/763/files)

### F4 · The working pings migration was written, then wholly rewritten — `churn:supabase/migrations/20261019090000_working_pings.sql`

- **What happened:** `supabase/migrations/20261019090000_working_pings.sql` had 147 lines added across 2 commits, none of them in the final diff: 147 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** None of the migration's first version survived into the final diff. The rewrite followed the constraint failure, so the table's shape was settled only after the check went red.
- **Evidence:** [3dbb2be (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/3dbb2be4adf4a2dd080e3f90e3983a487e70ddd1), [6341697 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/63416977e57b0871afb66e01cee23c47d2b71b8b)

## Proposed lessons

- When a database function writes into a table with a shape constraint, check every kind of work the function accepts against that constraint, and run the database checks locally before pushing a fix. (F1, F4)

## Timeline

- Feature PR [#760](https://github.com/vertuoza/vertuo-omni-loop/pull/760): opened `2026-09-30T10:11:42Z`, ready `2026-09-30T11:07:38Z`, merged `2026-09-30T11:52:09Z`, 100 minutes in all.
- 6 slices; waves: 2 planned, 3 as merged; median slice: 16 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#762](https://github.com/vertuoza/vertuo-omni-loop/pull/762) | `2026-09-30T10:17:03Z` | `2026-09-30T10:36:57Z` | 20 | 1 | 1 |
| s2 | [#763](https://github.com/vertuoza/vertuo-omni-loop/pull/763) | `2026-09-30T10:17:12Z` | `2026-09-30T10:37:01Z` | 20 | 1 | 1 |
| s3 | [#764](https://github.com/vertuoza/vertuo-omni-loop/pull/764) | `2026-09-30T10:17:28Z` | `2026-09-30T10:37:06Z` | 20 | 1 | 1 |
| s4 | [#768](https://github.com/vertuoza/vertuo-omni-loop/pull/768) | `2026-09-30T10:42:25Z` | `2026-09-30T10:54:00Z` | 12 | 2 | 2 |
| s5 | [#769](https://github.com/vertuoza/vertuo-omni-loop/pull/769) | `2026-09-30T10:42:33Z` | `2026-09-30T10:54:05Z` | 12 | 2 | 2 |
| settle | [#770](https://github.com/vertuoza/vertuo-omni-loop/pull/770) | `2026-09-30T11:06:52Z` | `2026-09-30T11:07:02Z` | 0 | — | 3 |

## Decisions

- Decisions: 9 raised and settled — 8 adopted, 1 agreed, 0 drifted; by rank: 1 high, 8 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 5 merged sub-PRs graded against the plan — 4 paths outside a slice’s territory; 1 more sub-PR names a slice the plan does not hold.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 7 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F2 · Slice s1 changed files outside its territory; F3 · Slice s2 changed files outside its territory

## Checks

- 5 runs of 1 check on 5 commits in 1 slice, read from GitHub Actions: 2 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| check | 5 | 2 | 2 | s2 | 0 |

Red runs:

| red run | slice | commit | from its log |
| --- | --- | --- | --- |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/36702382672/job/109844595239) | s2 | `2e33e19` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/36702857725/job/109846108056) | s2 | `55c655f` | no test named: its last lines are kept as an excerpt |

Findings: F1 · The working pings database check failed the same way twice · [#778](https://github.com/vertuoza/vertuo-omni-loop/issues/778)

## Churn

- 25 commits read across 6 merged pull requests: 2923 lines added, 2862 in the final diff, 161 lines of churn.
- Left out as generated, by `.gitattributes`: `kit/dist/omni.mjs`.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0757-play-while-working/accounts/s1.md`, `.omni-loop/delivery/outbox/0757-play-while-working/s1-01-help-entry-outside-territory.md`, `.omni-loop/delivery/outbox/0757-play-while-working/s1-02-session-end-own-hook.md`, `.omni-loop/delivery/outbox/0757-play-while-working/s2-01-heartbeat-access-check-in-ci.md`, `.omni-loop/delivery/outbox/0757-play-while-working/s2-02-session-end-keeps-its-work.md`, `.omni-loop/delivery/outbox/0757-play-while-working/s3-01-dock-plays-silent.md`, `.omni-loop/delivery/outbox/0757-play-while-working/s3-02-fold-ends-the-game.md`, `.omni-loop/delivery/outbox/0757-play-while-working/s4-01-unread-questions-pause-the-game.md`, `.omni-loop/delivery/outbox/0757-play-while-working/s5-01-ask-dock-plays-in-arcade-workspace.md`, `.omni-loop/delivery/outbox/0757-play-while-working/s5-02-moved-question-pauses-the-dock.md`, `.omni-loop/delivery/outbox/0757-play-while-working/settled.md`.

Findings: F4 · The working pings migration was written, then wholly rewritten

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
