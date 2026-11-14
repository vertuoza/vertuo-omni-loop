---
prd: 2809
feature-pr: 2810
merge-sha: af6ad33
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 2809, Runner jobs that never lose work

The delivery of runner jobs that keep their work went through several slices, and most of the friction came from database migrations. The `check` job of the first slice went red again and again, first because its new migration was dated at or before the newest one on the default branch, then because two migrations shared one version. Three slices each added a migration that the plan had not placed in their territory, and those migration files were written and then rewritten, mostly as re-dating. One line of the runners service was rewritten by three slices in turn, a sign that the file was edited by many slices without the plan saying so.

## Findings

### F1 · Migration order kept the check red — `repeated-red:check`

- **What happened:** The check `check` was red on 3 commits in 1 slice (s1): 3 of its 15 runs were red. The rules flag a check red on 2 or more commits, or in 2 or more slices.
- **Why it matters:** The check failed repeatedly on the same cause: the new migration was dated at or before the newest migration on the default branch. A later attempt then collided on a version already taken. Each red run cost a push and a wait for the same known problem.
- **Proposed lesson:** Before pushing a slice with a new migration, compare its version with the newest one on the default branch and re-date it after that one, never onto the same version.
- **Evidence:** [check on 80a4422 in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/43445864632/job/131954991992), [check on 11410f2 in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/43452982186/job/131979744695), [check on 76d2f41 in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/43454428312/job/131984691142)

### F2 · A slice added a migration outside its territory — `territory:s1` · [#2839](https://github.com/vertuoza/vertuo-omni-loop/issues/2839)

- **What happened:** Slice s1 changed 1 path outside its territory and off the plan’s shared ground: `supabase/migrations/20270120100000_runner_resume.sql`.
- **Why it matters:** The slice's new migration file sat outside the paths the plan gave it. The retro therefore read it as a breach, and nothing in the plan warned the other slices that this slice would touch the migrations folder.
- **Proposed lesson:** When a slice will add a migration, the plan lists the migrations folder in that slice's territory, so the file is expected and every slice adding one is visible from the plan's table.
- **Kept:** No knowledge entry or earlier lesson asks the plan to put the migrations folder in the territory of each slice that adds a migration, and three slices hit this gap.
- **Evidence:** [#2812](https://github.com/vertuoza/vertuo-omni-loop/pull/2812/files)

### F3 · A second slice added a migration outside its territory — `territory:s4`

- **What happened:** Slice s4 changed 1 path outside its territory and off the plan’s shared ground: `supabase/migrations/20270120103000_runner_checkpoints.sql`.
- **Why it matters:** This is the same gap as in the first slice: a new migration under a folder the plan never assigned to it.
- **Proposed lesson:** When a slice will add a migration, the plan lists the migrations folder in that slice's territory.
- **Evidence:** [#2823](https://github.com/vertuoza/vertuo-omni-loop/pull/2823/files)

### F4 · A third slice added a migration outside its territory — `territory:s5`

- **What happened:** Slice s5 changed 1 path outside its territory and off the plan’s shared ground: `supabase/migrations/20270120110000_runner_claim_resume.sql`.
- **Why it matters:** This is the same gap once more: the plan's table did not show that this slice would write to the migrations folder.
- **Proposed lesson:** When a slice will add a migration, the plan lists the migrations folder in that slice's territory.
- **Evidence:** [#2826](https://github.com/vertuoza/vertuo-omni-loop/pull/2826/files)

### F5 · A checkpoints migration was written, then replaced — `churn:supabase/migrations/20270120103000_runner_checkpoints.sql`

- **What happened:** `supabase/migrations/20270120103000_runner_checkpoints.sql` had 143 lines added across 1 commits, none of them in the final diff: 143 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** None of the lines first written for this migration survived to the merge. The work was rewritten under a new name or version, most likely through re-dating.
- **Proposed lesson:** Pick the migration version from the newest on the default branch when the file is first written, so it does not have to be moved later.
- **Evidence:** [637d957 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/637d957ec558f1cdbb152f19a7d2dc0cc08d4fe5)

### F6 · The resume migration was written twice before it settled — `churn:supabase/migrations/20270120100000_runner_resume.sql`

- **What happened:** `supabase/migrations/20270120100000_runner_resume.sql` had 123 lines added across 2 commits, none of them in the final diff: 123 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** The resume migration's first lines all disappeared from the final diff across two commits. This matches the order guard and version collision that kept the check red.
- **Proposed lesson:** Choose a migration version after the newest one on the default branch from the start.
- **Evidence:** [2828b22 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/2828b221364ece7cdc5de67e1357887ab9b7ad6d), [76d2f41 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/76d2f41fad8728b77ad47e703bcdb96df1756b4b)

### F7 · The claim resume migration was written, then replaced — `churn:supabase/migrations/20270120110000_runner_claim_resume.sql`

- **What happened:** `supabase/migrations/20270120110000_runner_claim_resume.sql` had 81 lines added across 1 commits, none of them in the final diff: 81 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** None of the first version of this migration reached the merge. It is the same churn from moving a migration to a fresh version.
- **Proposed lesson:** Date a new migration after the newest on the default branch when it is first created.
- **Evidence:** [a36f7f8 (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/a36f7f81c327d269a84b1ba5f277264353362225)

### F8 · One line of the runners service was rewritten by three slices — `churn:apps/galaxy/src/runners/runners.service.ts:91-91`

- **What happened:** Lines 91-91 of `apps/galaxy/src/runners/runners.service.ts`, as merged, were written and rewritten in 3 commits, in s3, s4 and s5; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** Three slices each rewrote the same line of the central runners service. Each one had to merge over the last, and none of them owned the line.
- **Proposed lesson:** When several slices must change one central file, the plan declares it shared ground or gives it to one slice that lands first.
- **Evidence:** [067eda1 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/067eda1140b7c47d73c10f12682a3e742304c8bd), [ae98ed0 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/ae98ed0c949dbc808c67caa8839e92b5fa1e98f4), [a36f7f8 (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/a36f7f81c327d269a84b1ba5f277264353362225), [`apps/galaxy/src/runners/runners.service.ts` lines 91-91, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/a5409ac769d0225e69c694583c2da10756f565e6/apps/galaxy/src/runners/runners.service.ts#L91-L91)

## Proposed lessons

- When a slice will add a migration, the plan lists the migrations folder in that slice's territory, so the new file is expected and every slice that adds one is visible from the plan's table. (F2, F3, F4)

## Timeline

- Feature PR [#2810](https://github.com/vertuoza/vertuo-omni-loop/pull/2810): opened `2026-11-13T13:57:50Z`, ready `2026-11-14T06:51:05Z`, merged `2026-11-14T09:12:38Z`, 1155 minutes in all.
- 8 slices; waves: 5 planned, 5 as merged; median slice: 49 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#2812](https://github.com/vertuoza/vertuo-omni-loop/pull/2812) | `2026-11-13T14:08:19Z` | `2026-11-13T16:12:08Z` | 124 | 1 | 1 |
| s2 | [#2813](https://github.com/vertuoza/vertuo-omni-loop/pull/2813) | `2026-11-13T14:08:23Z` | `2026-11-13T14:51:33Z` | 43 | 1 | 1 |
| s3 | [#2822](https://github.com/vertuoza/vertuo-omni-loop/pull/2822) | `2026-11-13T16:32:23Z` | `2026-11-13T17:00:27Z` | 28 | 2 | 2 |
| s4 | [#2823](https://github.com/vertuoza/vertuo-omni-loop/pull/2823) | `2026-11-13T17:02:29Z` | `2026-11-13T18:06:46Z` | 64 | 3 | 3 |
| s5 | [#2826](https://github.com/vertuoza/vertuo-omni-loop/pull/2826) | `2026-11-13T18:26:29Z` | `2026-11-13T19:20:44Z` | 54 | 4 | 4 |
| s6 | [#2827](https://github.com/vertuoza/vertuo-omni-loop/pull/2827) | `2026-11-13T18:26:54Z` | `2026-11-13T19:21:49Z` | 55 | 4 | 4 |
| s7 | [#2832](https://github.com/vertuoza/vertuo-omni-loop/pull/2832) | `2026-11-13T19:42:57Z` | `2026-11-13T20:14:07Z` | 31 | 5 | 5 |
| s8 | [#2833](https://github.com/vertuoza/vertuo-omni-loop/pull/2833) | `2026-11-13T19:43:23Z` | `2026-11-13T20:14:31Z` | 31 | 5 | 5 |

## Decisions

- Decisions: 13 raised and settled — 10 adopted, 3 agreed, 0 drifted; by rank: 2 human-action, 1 high, 10 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 8 merged sub-PRs graded against the plan — 3 paths outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 9 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F2 · A slice added a migration outside its territory · [#2839](https://github.com/vertuoza/vertuo-omni-loop/issues/2839); F3 · A second slice added a migration outside its territory; F4 · A third slice added a migration outside its territory

## Checks

- 140 runs of 5 checks on 26 commits in 8 slices, read from GitHub Actions: 3 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| check | 15 | 3 | 3 | s1 | 0 |
| gitleaks | 34 | 0 | 0 | — | 0 |
| open-source | 34 | 0 | 0 | — | 0 |
| quick | 28 | 0 | 0 | — | 0 |
| settle | 29 | 0 | 0 | — | 0 |

Red runs:

| red run | slice | commit | from its log |
| --- | --- | --- | --- |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/43445864632/job/131954991992) | s1 | `80a4422` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/43452982186/job/131979744695) | s1 | `11410f2` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/43454428312/job/131984691142) | s1 | `76d2f41` | no test named: its last lines are kept as an excerpt |

Findings: F1 · Migration order kept the check red

## Churn

- 37 commits read across 9 merged pull requests: 6121 lines added, 5739 in the final diff, 389 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/2809-unlosable-jobs/s1-01-resume-check-in-ci.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s1-02-cancel-asked-not-resumed.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s2-01-budget-drops-the-bundle.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s2-02-snapshot-author.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s2-03-failed-save-keeps-folder.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s4-01-checkpoints-check-in-ci.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s4-02-upload-link-two-hours.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s4-03-send-save-wired-by-s5.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s5-01-resume-note-in-the-prompt.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s5-02-chain-holds-claims-on-the-runner.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s5-03-keeper-runner-routing.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s5-04-checkpoint-rule-in-the-note.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s7-01-lost-job-offers-no-button-while-resuming.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/settled.md`.

Findings: F5 · A checkpoints migration was written, then replaced; F6 · The resume migration was written twice before it settled; F7 · The claim resume migration was written, then replaced; F8 · One line of the runners service was rewritten by three slices

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
