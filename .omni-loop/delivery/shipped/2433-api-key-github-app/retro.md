---
prd: 2433
feature-pr: 2434
merge-sha: dd149cc
runs: [merge, day-14]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 2433, An API key's job runs on GitHub as the calling app's own GitHub App, never as a person

The delivery moved every job sent with an API key onto the calling app's own GitHub App, so that no person is named on the work. Most slices landed cleanly. One decision about how far the job's token reaches drifted from what was built, and a later rework brought the build back in line. The leak scan `gitleaks` stayed red on several pushes of one slice, with the same set of leaks found each time even as new commits were added. Three slices also touched files outside their declared territory: tests, a migration, generated database types and a database check.

## Findings

### F1 · Token reach drifted from its settled decision, then reworked — `drift:s7-01-token-covers-the-jobs-own-repository-only`

- **What happened:** The answer to decision `s7-01-token-covers-the-jobs-own-repository-only` (rank high, slice s7) disagreed with what was built; rework #2456 brought the build back in line.
- **Why it matters:** The settled answer limits a key job's token to the repositories the key and the App installation both hold. A build that reached further would grant access beyond what the key allows. The rework closed the gap before the feature shipped.
- **Evidence:** [settled.md](https://github.com/vertuoza/vertuo-omni-loop/blob/dd149cc07ea3fd09f37a5faf498e6227cd0d4b89/.omni-loop/delivery/shipped/2433-api-key-github-app/outbox/settled.md), [#2456](https://github.com/vertuoza/vertuo-omni-loop/pull/2456)

### F2 · Leak scan stayed red across pushes with the same leaks found — `repeated-red:gitleaks` · [#2469](https://github.com/vertuoza/vertuo-omni-loop/issues/2469)

- **What happened:** The check `gitleaks` was red on 3 commits in 1 slice (s2): 4 of its 35 runs were red. The rules flag a check red on 2 or more commits, or in 2 or more slices.
- **Why it matters:** The scan reads every commit between the base and the head. It found the same leaks on each run while the number of scanned commits grew. Later commits therefore did not clear what earlier commits had added. A feature about GitHub App credentials naturally produces credential-shaped test values, and those trip the scan.
- **Proposed lesson:** The leak scan reads every commit since the base, so a credential-shaped value removed in a later commit stays red. A slice whose tests need fake keys or tokens builds them so the scan does not match, or runs the scan locally before the first push. If one slips through, it rewrites the slice's commits instead of adding a fix on top.
- **Kept:** Neither the knowledge nor the earlier lessons say that the leak scan reads the whole commit range, or that fixing a leak forward leaves the check red.
- **Became:** `playbook/testing#never`
- **Evidence:** [gitleaks on 12fb34c in s2](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39822198961/job/119976085280), [gitleaks on c027fd0 in s2](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39823933564/job/119982097274), [gitleaks on fadec56 in s2](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39826216013/job/119990070469), [gitleaks on fadec56 in s2](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39826293330/job/119990341725)

### F3 · A slice edited a migration test outside its territory — `territory:s1`

- **What happened:** Slice s1 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/src/runners/runners.migration.test.ts`.
- **Why it matters:** A test file outside the declared territory can collide with another slice working on the same file.
- **Evidence:** [#2435](https://github.com/vertuoza/vertuo-omni-loop/pull/2435/files)

### F4 · A slice edited a call-sites test outside its territory — `territory:s4`

- **What happened:** Slice s4 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/src/github-call-sites.test.ts`.
- **Why it matters:** A guard test that every GitHub call site must satisfy is edited by any slice that adds a call site, so it is likely to collide.
- **Evidence:** [#2445](https://github.com/vertuoza/vertuo-omni-loop/pull/2445/files)

### F5 · A slice added a migration, types and a check outside its territory — `territory:s6`

- **What happened:** Slice s6 changed 3 paths outside its territory and off the plan’s shared ground: `supabase/checks/api_key_github_apps.sql`, `supabase/database.types.ts`, `supabase/migrations/20261228090000_api_key_github_apps.sql`.
- **Why it matters:** The plan did not give this slice the database files its own new table required. The slice therefore changed paths the plan never assigned to it.
- **Evidence:** [#2451](https://github.com/vertuoza/vertuo-omni-loop/pull/2451/files)

## Proposed lessons

- The leak scan reads every commit since the base, so a credential-shaped value removed in a later commit stays red. A slice whose tests need fake keys or tokens builds them so the scan does not match, or runs the scan locally before the first push. If one slips through, it rewrites the slice's commits instead of adding a fix on top. (F2)

## Timeline

- Feature PR [#2434](https://github.com/vertuoza/vertuo-omni-loop/pull/2434): opened `2026-10-22T16:30:35Z`, ready `2026-10-22T22:32:47Z`, merged `2026-10-23T07:01:02Z`, 870 minutes in all.
- 9 slices; waves: 4 planned, 4 as merged; median slice: 61 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#2435](https://github.com/vertuoza/vertuo-omni-loop/pull/2435) | `2026-10-22T16:38:11Z` | `2026-10-22T17:53:15Z` | 75 | 1 | 1 |
| s2 | [#2436](https://github.com/vertuoza/vertuo-omni-loop/pull/2436) | `2026-10-22T16:38:48Z` | `2026-10-22T17:54:20Z` | 76 | 1 | 1 |
| s8 | [#2437](https://github.com/vertuoza/vertuo-omni-loop/pull/2437) | `2026-10-22T16:39:25Z` | `2026-10-22T17:54:53Z` | 75 | 1 | 1 |
| s3 | [#2444](https://github.com/vertuoza/vertuo-omni-loop/pull/2444) | `2026-10-22T18:07:22Z` | `2026-10-22T19:08:06Z` | 61 | 2 | 2 |
| s4 | [#2445](https://github.com/vertuoza/vertuo-omni-loop/pull/2445) | `2026-10-22T18:07:39Z` | `2026-10-22T19:08:44Z` | 61 | 2 | 2 |
| s5 | [#2450](https://github.com/vertuoza/vertuo-omni-loop/pull/2450) | `2026-10-22T19:58:23Z` | `2026-10-22T20:59:27Z` | 61 | 3 | 3 |
| s6 | [#2451](https://github.com/vertuoza/vertuo-omni-loop/pull/2451) | `2026-10-22T19:58:40Z` | `2026-10-22T21:35:45Z` | 97 | 3 | 3 |
| s7 | [#2452](https://github.com/vertuoza/vertuo-omni-loop/pull/2452) | `2026-10-22T19:59:12Z` | `2026-10-22T21:00:02Z` | 61 | 3 | 3 |
| s9 | [#2455](https://github.com/vertuoza/vertuo-omni-loop/pull/2455) | `2026-10-22T21:43:34Z` | `2026-10-22T22:17:02Z` | 33 | 4 | 4 |

## Decisions

- Decisions: 19 raised and settled — 17 adopted, 1 agreed, 1 drifted, 1 of them reworked; by rank: 1 high, 1 human-action, 17 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 9 merged sub-PRs graded against the plan — 5 paths outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 10 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F1 · Token reach drifted from its settled decision, then reworked; F3 · A slice edited a migration test outside its territory; F4 · A slice edited a call-sites test outside its territory; F5 · A slice added a migration, types and a check outside its territory

## Checks

- 141 runs of 5 checks on 26 commits in 9 slices, read from GitHub Actions: 4 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| check | 11 | 0 | 0 | — | 0 |
| gitleaks | 35 | 4 | 3 | s2 | 0 |
| open-source | 35 | 0 | 0 | — | 0 |
| quick | 27 | 0 | 0 | — | 0 |
| settle | 33 | 0 | 0 | — | 0 |

Red runs:

| red run | slice | commit | from its log |
| --- | --- | --- | --- |
| [gitleaks](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39822198961/job/119976085280) | s2 | `12fb34c` | no test named: its last lines are kept as an excerpt |
| [gitleaks](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39823933564/job/119982097274) | s2 | `c027fd0` | no test named: its last lines are kept as an excerpt |
| [gitleaks](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39826216013/job/119990070469) | s2 | `fadec56` | no test named: its last lines are kept as an excerpt |
| [gitleaks](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/39826293330/job/119990341725) | s2 | `fadec56` | no test named: its last lines are kept as an excerpt |

Findings: F2 · Leak scan stayed red across pushes with the same leaks found · [#2469](https://github.com/vertuoza/vertuo-omni-loop/issues/2469)

## Churn

- 42 commits read across 11 merged pull requests: 7671 lines added, 7544 in the final diff, 127 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/2433-api-key-github-app/s1-01-queued-jobs-stay-app-jobs.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s1-02-revoke-erases-the-sealed-key-by-trigger.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s1-03-runners-table-test-allows-the-new-column.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s2-01-app-token-in-a-file.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s2-02-app-identity-github-only.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s2-03-gh-shim-shared.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s2-04-key-sender-own-variable.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s2-05-register-app-only-when-able.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s3-01-the-session-finds-the-page-in-the-token-file.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s3-02-an-app-job-with-no-token-left-is-released-as-nothing.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s3-03-release-asks-a-fresh-token-when-it-is-late.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s3-04-stranded-app-jobs-are-recognized-before-the-cleanup.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s4-01-pair-checked-before-owner.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s4-02-token-needs-named-repositories.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s4-03-list-new-github-caller.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s6-01-send-check-needs-key-keyed-app-read.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s7-01-token-covers-the-jobs-own-repository-only.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s7-02-refresh-refusals-say-stop-or-try-again.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/s9-01-guide-never-says-private-key.md`, `.omni-loop/delivery/outbox/2433-api-key-github-app/settled.md`.

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.

## After merge

- No `bug` issue naming #2433 was opened within 14 days of the merge.
- 6 GitHub Actions jobs ran on the merge commit `dd149cc`: 5 green, 0 red, 1 neither.
