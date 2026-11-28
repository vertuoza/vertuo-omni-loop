---
prd: 2809
feature-pr: 2810
merge-sha: af6ad33
runs: [merge, day-14]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 2809, Runner jobs that never lose work

_Dropped: it holds a word the rules refuse._

## Findings

### F1 · Migration date collided with the default branch — `repeated-red:check`

- **What happened:** The check `check` was red on 3 commits in 1 slice (s1): 3 of its 15 runs were red. The rules flag a check red on 2 or more commits, or in 2 or more slices.
- **Why it matters:** The order guard refused a migration dated at or before the newest one on the default branch. After re-dating, the local database refused a second migration with the same version key. Each round cost a red run before the slice could move on.
- **Proposed lesson:** Before pushing, re-date a new migration after the newest one on the default branch, as the conventions already ask.
- **Evidence:** [check on 80a4422 in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/43445864632/job/131954991992), [check on 11410f2 in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/43452982186/job/131979744695), [check on 76d2f41 in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/43454428312/job/131984691142)

### F2 · A slice's new migration fell outside its planned paths — `territory:s1` · [#2839](https://github.com/vertuoza/vertuo-omni-loop/issues/2839)

- **What happened:** Slice s1 changed 1 path outside its territory and off the plan’s shared ground: `supabase/migrations/20270120100000_runner_resume.sql`.
- **Why it matters:** The plan did not list the migrations folder for a slice that needed a migration. So the retro counts the change as a breach, and the plan's paths say less than the slices really touch.
- **Proposed lesson:** When a slice will add a database migration, the plan lists the migrations folder in that slice's own paths, or as ground shared by every slice that adds one, so a needed migration is never a breach.
- **Kept:** No knowledge entry or earlier lesson says that a plan must give the migrations folder to the slices that add migrations.
- **Became:** `playbook/conventions#naming`
- **Evidence:** [#2812](https://github.com/vertuoza/vertuo-omni-loop/pull/2812/files)

### F3 · Another slice's migration fell outside its planned paths — `territory:s4`

- **What happened:** Slice s4 changed 1 path outside its territory and off the plan’s shared ground: `supabase/migrations/20270120103000_runner_checkpoints.sql`.
- **Why it matters:** This is the same gap seen again in another slice: the plan did not give the migrations folder to a slice that added a migration.
- **Evidence:** [#2823](https://github.com/vertuoza/vertuo-omni-loop/pull/2823/files)

### F4 · A third slice's migration fell outside its planned paths — `territory:s5`

- **What happened:** Slice s5 changed 1 path outside its territory and off the plan’s shared ground: `supabase/migrations/20270120110000_runner_claim_resume.sql`.
- **Why it matters:** _Dropped: it holds a word the rules refuse._
- **Evidence:** [#2826](https://github.com/vertuoza/vertuo-omni-loop/pull/2826/files)

### F5 · A migration file was replaced after re-dating — `churn:supabase/migrations/20270120103000_runner_checkpoints.sql`

- **What happened:** `supabase/migrations/20270120103000_runner_checkpoints.sql` had 143 lines added across 1 commits, none of them in the final diff: 143 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** The churn mostly reflects a migration being moved to a new date rather than its content changing. It inflates the rewrite count without showing a design problem.
- **Evidence:** [637d957 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/637d957ec558f1cdbb152f19a7d2dc0cc08d4fe5)

### F6 · A migration was written twice before its final date — `churn:supabase/migrations/20270120100000_runner_resume.sql`

- **What happened:** `supabase/migrations/20270120100000_runner_resume.sql` had 123 lines added across 2 commits, none of them in the final diff: 123 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** The file was rewritten across commits while its date was fixed against the default branch, the same cause as the red `check` runs.
- **Evidence:** [2828b22 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/2828b221364ece7cdc5de67e1357887ab9b7ad6d), [76d2f41 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/76d2f41fad8728b77ad47e703bcdb96df1756b4b)

### F7 · A further migration file was written then replaced — `churn:supabase/migrations/20270120110000_runner_claim_resume.sql`

- **What happened:** `supabase/migrations/20270120110000_runner_claim_resume.sql` had 81 lines added across 1 commits, none of them in the final diff: 81 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** This is the same re-dating churn seen in the other migrations of this delivery.
- **Evidence:** [a36f7f8 (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/a36f7f81c327d269a84b1ba5f277264353362225)

### F8 · One service line was rewritten by three slices — `churn:apps/galaxy/src/runners/runners.service.ts:91-91`

- **What happened:** Lines 91-91 of `apps/galaxy/src/runners/runners.service.ts`, as merged, were written and rewritten in 3 commits, in s3, s4 and s5; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** Several slices each edited the same spot of the runners service in turn. That is the sign of a central place more than one slice must change.
- **Proposed lesson:** A spot several slices must each change is declared as shared ground or given to one slice that lands first.
- **Evidence:** [067eda1 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/067eda1140b7c47d73c10f12682a3e742304c8bd), [ae98ed0 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/ae98ed0c949dbc808c67caa8839e92b5fa1e98f4), [a36f7f8 (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/a36f7f81c327d269a84b1ba5f277264353362225), [`apps/galaxy/src/runners/runners.service.ts` lines 91-91, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/a5409ac769d0225e69c694583c2da10756f565e6/apps/galaxy/src/runners/runners.service.ts#L91-L91)

## Proposed lessons

- When a slice will add a database migration, the plan lists the migrations folder in that slice's own paths, or as ground shared by every slice that adds one, so a needed migration is never a breach. (F2, F3, F4)

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

- Decisions: 13 raised and settled — 10 adopted, 3 agreed, 0 drifted; by rank: 1 high, 10 medium, 2 human-action.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 8 merged sub-PRs graded against the plan — 3 paths outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 9 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F2 · A slice's new migration fell outside its planned paths · [#2839](https://github.com/vertuoza/vertuo-omni-loop/issues/2839); F3 · Another slice's migration fell outside its planned paths; F4 · A third slice's migration fell outside its planned paths

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

Findings: F1 · Migration date collided with the default branch

## Churn

- 37 commits read across 9 merged pull requests: 6121 lines added, 5739 in the final diff, 389 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/2809-unlosable-jobs/s1-01-resume-check-in-ci.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s1-02-cancel-asked-not-resumed.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s2-01-budget-drops-the-bundle.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s2-02-snapshot-author.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s2-03-failed-save-keeps-folder.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s4-01-checkpoints-check-in-ci.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s4-02-upload-link-two-hours.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s4-03-send-save-wired-by-s5.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s5-01-resume-note-in-the-prompt.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s5-02-chain-holds-claims-on-the-runner.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s5-03-keeper-runner-routing.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s5-04-checkpoint-rule-in-the-note.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/s7-01-lost-job-offers-no-button-while-resuming.md`, `.omni-loop/delivery/outbox/2809-unlosable-jobs/settled.md`.

Findings: F5 · A migration file was replaced after re-dating; F6 · A migration was written twice before its final date; F7 · A further migration file was written then replaced; F8 · One service line was rewritten by three slices

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.

## After merge

- No `bug` issue naming #2809 was opened within 14 days of the merge.
- 9 GitHub Actions jobs ran on the merge commit `af6ad33`: 7 green, 0 red, 2 neither.
