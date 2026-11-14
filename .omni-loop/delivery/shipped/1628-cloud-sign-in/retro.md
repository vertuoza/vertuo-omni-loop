---
prd: 1628
feature-pr: 1629
merge-sha: f92f7bf
runs: [merge, day-14]
model: anthropic/claude-opus-5.5
rules: 1
judge: 1
---

# Retro — PRD 1628, Sign in from a cloud session

The sign-in work for cloud sessions was delivered across several slices, and most of the friction sat in one place. The `check` job went red on three commits of the first slice. Every time, the committed `supabase/database.types.ts` had drifted from what the migrations generate: first a missing column, then the same one-character spacing difference twice in a row. Two slices also changed files outside their declared territory: a README in one, and the docs guide with its tests in another. None of these blocked delivery. The repeated red does show that a generated file was edited by hand instead of regenerated.

## Findings

### F1 · Generated database types drifted from the migrations on three commits — `repeated-red:check` · [#1649](https://github.com/vertuoza/vertuo-omni-loop/issues/1649)

- **What happened:** The check `check` was red on 3 commits in 1 slice (s1): 3 of its 8 runs were red. The rules flag a check red on 2 or more commits, or in 2 or more slices.
- **Why it matters:** _Dropped: it holds a word the rules refuse._
- **Proposed lesson:** After adding or changing a migration, regenerate `supabase/database.types.ts` by running `node scripts/supabase-types.ts` against a fresh database, and commit its output unchanged. Never patch the generated file by hand, since its exact formatting is checked.
- **Kept:** Neither the knowledge nor earlier lessons say generated database types must be regenerated rather than hand-edited, and the same drift repeated across three commits.
- **Evidence:** [check on 8623746 in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/38167508628/job/114553025212), [check on 68f989c in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/38168504188/job/114555963538), [check on d124a7a in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/38171469301/job/114564789378)
- **Stays here:** playbook/conventions#naming already states it: "The database types are generated, never written" — regenerated with node scripts/supabase-types.ts from a fresh local database, checked by the pre-push hook and the supabase workflow; the rule already cites #1649.

### F2 · A README edit landed outside the slice's territory — `territory:s1`

- **What happened:** Slice s1 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/README.md`.
- **Why it matters:** The slice touched a README that its plan row did not declare. Small documentation edits like this can collide with other slices and make the plan's territory table less trustworthy.
- **Evidence:** [#1631](https://github.com/vertuoza/vertuo-omni-loop/pull/1631/files)

### F3 · Docs guide and its tests changed outside the slice's territory — `territory:s5`

- **What happened:** Slice s5 changed 3 paths outside its territory and off the plan’s shared ground: `apps/galaxy/src/docs/docs.test.ts`, `apps/galaxy/src/docs/guide.test.ts`, `apps/galaxy/src/docs/guide.ts`.
- **Why it matters:** The slice edited the shared docs guide and two docs tests that its plan row did not list. A central file several features register into is a likely collision point between slices.
- **Evidence:** [#1641](https://github.com/vertuoza/vertuo-omni-loop/pull/1641/files)

## Proposed lessons

- Regenerate the database types file with `node scripts/supabase-types.ts` after any migration change and commit the output as is; a hand-patched generated file keeps the check red. (F1)

## Timeline

- Feature PR [#1629](https://github.com/vertuoza/vertuo-omni-loop/pull/1629): opened `2026-10-11T19:03:50Z`, ready `2026-10-12T05:48:48Z`, merged `2026-10-12T05:59:11Z`, 655 minutes in all.
- 5 slices; waves: 3 planned, 3 as merged; median slice: 60 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#1631](https://github.com/vertuoza/vertuo-omni-loop/pull/1631) | `2026-10-11T19:08:20Z` | `2026-10-11T20:22:01Z` | 74 | 1 | 1 |
| s2 | [#1632](https://github.com/vertuoza/vertuo-omni-loop/pull/1632) | `2026-10-11T19:08:24Z` | `2026-10-11T20:22:25Z` | 74 | 1 | 1 |
| s3 | [#1634](https://github.com/vertuoza/vertuo-omni-loop/pull/1634) | `2026-10-11T20:41:03Z` | `2026-10-11T21:07:38Z` | 27 | 2 | 2 |
| s4 | [#1635](https://github.com/vertuoza/vertuo-omni-loop/pull/1635) | `2026-10-11T20:41:06Z` | `2026-10-11T21:41:17Z` | 60 | 2 | 2 |
| s5 | [#1641](https://github.com/vertuoza/vertuo-omni-loop/pull/1641) | `2026-10-11T21:58:38Z` | `2026-10-11T22:14:52Z` | 16 | 3 | 3 |

## Decisions

- Decisions: 13 raised and settled — 12 adopted, 1 agreed, 0 drifted; by rank: 1 high, 12 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 5 merged sub-PRs graded against the plan — 4 paths outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 6 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F2 · A README edit landed outside the slice's territory; F3 · Docs guide and its tests changed outside the slice's territory

## Checks

- 8 runs of 1 check on 8 commits in 3 slices, read from GitHub Actions: 3 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| check | 8 | 3 | 3 | s1 | 0 |

Red runs:

| red run | slice | commit | from its log |
| --- | --- | --- | --- |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/38167508628/job/114553025212) | s1 | `8623746` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/38168504188/job/114555963538) | s1 | `68f989c` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/38171469301/job/114564789378) | s1 | `d124a7a` | no test named: its last lines are kept as an excerpt |

Findings: F1 · Generated database types drifted from the migrations on three commits · [#1649](https://github.com/vertuoza/vertuo-omni-loop/issues/1649)

## Churn

- 26 commits read across 6 merged pull requests: 4370 lines added, 4332 in the final diff, 38 lines of churn.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/1628-cloud-sign-in/s1-01-exchange-lease.md`, `.omni-loop/delivery/outbox/1628-cloud-sign-in/s1-02-token-workspace.md`, `.omni-loop/delivery/outbox/1628-cloud-sign-in/s1-03-who-sees-tokens.md`, `.omni-loop/delivery/outbox/1628-cloud-sign-in/s1-04-revoke-signout.md`, `.omni-loop/delivery/outbox/1628-cloud-sign-in/s1-05-token-key-variable.md`, `.omni-loop/delivery/outbox/1628-cloud-sign-in/s1-06-token-hand-back.md`, `.omni-loop/delivery/outbox/1628-cloud-sign-in/s2-01-refusal-details.md`, `.omni-loop/delivery/outbox/1628-cloud-sign-in/s2-02-token-from-environment.md`, `.omni-loop/delivery/outbox/1628-cloud-sign-in/s2-03-status-line-token.md`, `.omni-loop/delivery/outbox/1628-cloud-sign-in/s3-01-token-printed-lines.md`, `.omni-loop/delivery/outbox/1628-cloud-sign-in/s4-01-made-token-asked-on-open.md`, `.omni-loop/delivery/outbox/1628-cloud-sign-in/s4-02-limit-words.md`, `.omni-loop/delivery/outbox/1628-cloud-sign-in/s5-01-guide-tests-and-guard.md`, `.omni-loop/delivery/outbox/1628-cloud-sign-in/settled.md`.

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.

## After merge

- No `bug` issue naming #1628 was opened within 14 days of the merge.
- 4 GitHub Actions jobs ran on the merge commit `f92f7bf`: 3 green, 0 red, 1 neither.
