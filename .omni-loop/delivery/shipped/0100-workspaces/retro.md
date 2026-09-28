---
prd: 100
feature-pr: 101
merge-sha: 5bc4c2a
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 100, Workspaces — Vertuoza becomes the first of many

The workspaces delivery moved the data model, access rules, scripts and look away from one hard-coded company, but the database side needed a second pass. The shared `check` job went red twice. The first time, the access checks expected a workspaces type that no migration had created yet. The second time, the new migration tried to drop the old email-check function while the newer ask-mode policies still depended on it. A follow-up slice moved the migration after ask mode, and the check passed again. Slice `s6` also edited schema files outside its territory, and two slices kept rewriting the same lines of the V mark module.

## Findings

### F1 · The database check failed twice, both times on migration order — `repeated-red:check` · [#178](https://github.com/vertuoza/vertuo-omni-loop/issues/178)

- **What happened:** The check `check` was red on 2 commits in 2 slices (s1, fix-s1-01-migration-after-ask-mode): 2 of its 11 runs were red. The rules flag a check red on 2 or more commits, or in 2 or more slices.
- **Why it matters:** The first red run stopped when `supabase/checks/access.sql` declared a variable of type `public.workspaces` before any migration had created it. The second run applied the workspaces migration after ask mode, but dropping the old email-check function failed because the ask session and round policies depended on it. The image rate-limit lines in the logs were noise that retries absorbed. The real cause both times was schema order.
- **Proposed lesson:** Before dropping or replacing a function, list what depends on it, including tables from work merged in the meantime. Then run the full migration chain and the access checks locally.
- **Evidence:** [check on d107a8c in s1](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/36190067365/job/108252789695), [check on 045fdbd in fix-s1-01-migration-after-ask-mode](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/36229136647/job/108368805417)

### F2 · Slice `s6` edited the access checks and workspaces migration outside its territory — `territory:s6` · [#179](https://github.com/vertuoza/vertuo-omni-loop/issues/179)

- **What happened:** Slice s6 changed 2 paths outside its territory and off the plan’s shared ground: `supabase/checks/access.sql`, `supabase/migrations/20260926120000_workspaces.sql`.
- **Why it matters:** Both files belong to another slice's database work. Rewriting them from a later slice risks collisions with fixes made there and blurs who owns the access rules. That matters more here because this migration had already needed a repair.
- **Proposed lesson:** When a slice needs a change in another slice's schema files, declare it as shared ground in the plan or hand it back to the owning slice.
- **Evidence:** [#143](https://github.com/vertuoza/vertuo-omni-loop/pull/143/files)

### F3 · Outbox note from the migration fix slice was dropped — `churn:.omni-loop/delivery/outbox/0100-workspaces/fix-s1-01-migration-after-ask-mode-01-ask-mode-crew-is-any-workspace.md` · [#180](https://github.com/vertuoza/vertuo-omni-loop/issues/180)

- **What happened:** `.omni-loop/delivery/outbox/0100-workspaces/fix-s1-01-migration-after-ask-mode-01-ask-mode-crew-is-any-workspace.md` had 52 lines added across 1 commits, none of them in the final diff: 52 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** The note was written in a single commit and then removed. That fits a handoff message that was read and used, not code that was redone.
- **Evidence:** [07cb2dd (fix-s1-01-migration-after-ask-mode)](https://github.com/vertuoza/vertuo-omni-loop/commit/07cb2dd513d55ae8b46bfc36a94d3674fc1317c1)

### F4 · Outbox note on handheld body colours becoming tokens was dropped — `churn:.omni-loop/delivery/outbox/0100-workspaces/s6-01-game-boy-body-colours-are-tokens.md` · [#181](https://github.com/vertuoza/vertuo-omni-loop/issues/181)

- **What happened:** `.omni-loop/delivery/outbox/0100-workspaces/s6-01-game-boy-body-colours-are-tokens.md` had 51 lines added across 1 commits, none of them in the final diff: 51 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** It was written once and is absent from the merged result. It reads as a consumed handoff note, not rework.
- **Evidence:** [5f20491 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/5f20491e60b7f1deeb6475559dd023a65ece83e8)

### F5 · Outbox note on letters taking five stripes was dropped — `churn:.omni-loop/delivery/outbox/0100-workspaces/s2-01-letters-take-five-stripes.md` · [#182](https://github.com/vertuoza/vertuo-omni-loop/issues/182)

- **What happened:** `.omni-loop/delivery/outbox/0100-workspaces/s2-01-letters-take-five-stripes.md` had 50 lines added across 1 commits, none of them in the final diff: 50 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** It was added in one commit and then removed. It counts as churn only because outbox files are included in the count.
- **Evidence:** [ee599f7 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/ee599f70d8db3484e464bc4fdafca378c92b7cbe)

### F6 · Outbox note on ask mode keeping its email check was dropped — `churn:.omni-loop/delivery/outbox/0100-workspaces/s5-01-ask-mode-keeps-its-email-check.md`

- **What happened:** `.omni-loop/delivery/outbox/0100-workspaces/s5-01-ask-mode-keeps-its-email-check.md` had 50 lines added across 1 commits, none of them in the final diff: 50 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** The note recorded a decision that the later migration repair revisited. It was written once and then removed, which is the normal path for a handoff message.
- **Evidence:** [f88e62c (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/f88e62c059907e6817dcad9ee3e19cce85b7428d)

### F7 · Outbox note on what follows a theme was dropped — `churn:.omni-loop/delivery/outbox/0100-workspaces/s6-02-what-follows-a-theme.md`

- **What happened:** `.omni-loop/delivery/outbox/0100-workspaces/s6-02-what-follows-a-theme.md` had 50 lines added across 1 commits, none of them in the final diff: 50 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** It was added and later removed, which marks it as a transient message, not repeated work.
- **Evidence:** [5f20491 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/5f20491e60b7f1deeb6475559dd023a65ece83e8)

### F8 · Outbox note asking the migration to follow ask mode was dropped — `churn:.omni-loop/delivery/outbox/0100-workspaces/s1-01-migration-after-ask-mode.md`

- **What happened:** `.omni-loop/delivery/outbox/0100-workspaces/s1-01-migration-after-ask-mode.md` had 49 lines added across 1 commits, none of them in the final diff: 49 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** This note flagged the exact ordering problem that later turned the check red. The follow-up slice acted on it before the note was removed.
- **Proposed lesson:** When an outbox note raises a schema ordering warning, act on it within the same slice rather than waiting for the check to fail.
- **Evidence:** [a5d6c13 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/a5d6c13e73cf7396e6afe8f4ca0cb7e09cbbbf1c)

### F9 · Outbox note on lowercase theme colours was dropped — `churn:.omni-loop/delivery/outbox/0100-workspaces/s1-02-theme-colours-lowercase.md`

- **What happened:** `.omni-loop/delivery/outbox/0100-workspaces/s1-02-theme-colours-lowercase.md` had 49 lines added across 1 commits, none of them in the final diff: 49 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** It was written once and is absent from the final diff, which fits a consumed handoff note.
- **Evidence:** [a5d6c13 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/a5d6c13e73cf7396e6afe8f4ca0cb7e09cbbbf1c)

### F10 · Outbox note on scripts refusing stray arguments was dropped — `churn:.omni-loop/delivery/outbox/0100-workspaces/s4-01-game-scripts-refuse-stray-arguments.md`

- **What happened:** `.omni-loop/delivery/outbox/0100-workspaces/s4-01-game-scripts-refuse-stray-arguments.md` had 49 lines added across 1 commits, none of them in the final diff: 49 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** It was added in one commit and removed later. It is flagged only because outbox files count as churn.
- **Evidence:** [7e7ab40 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/7e7ab408d3cf85d532ae317bb41530d572ac0c33)

### F11 · Outbox note separating out-of-reach from outsider was dropped — `churn:.omni-loop/delivery/outbox/0100-workspaces/s5-02-out-of-reach-is-not-outsider.md`

- **What happened:** `.omni-loop/delivery/outbox/0100-workspaces/s5-02-out-of-reach-is-not-outsider.md` had 49 lines added across 1 commits, none of them in the final diff: 49 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** The note on this access distinction was written once and gone by merge, the usual path for a handoff message.
- **Evidence:** [f88e62c (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/f88e62c059907e6817dcad9ee3e19cce85b7428d)

### F12 · Outbox note on GitHub linking needing a workspace was dropped — `churn:.omni-loop/delivery/outbox/0100-workspaces/s1-03-link-github-needs-a-workspace.md`

- **What happened:** `.omni-loop/delivery/outbox/0100-workspaces/s1-03-link-github-needs-a-workspace.md` had 48 lines added across 1 commits, none of them in the final diff: 48 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** It was added and then removed from the final diff. It is transient handoff material, not rework.
- **Evidence:** [a5d6c13 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/a5d6c13e73cf7396e6afe8f4ca0cb7e09cbbbf1c)

### F13 · Outbox note on best-effort joining at sign-in was dropped — `churn:.omni-loop/delivery/outbox/0100-workspaces/s5-03-joining-at-sign-in-is-best-effort.md`

- **What happened:** `.omni-loop/delivery/outbox/0100-workspaces/s5-03-joining-at-sign-in-is-best-effort.md` had 48 lines added across 1 commits, none of them in the final diff: 48 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** It was written in a single commit and later removed. It raises the churn count without signalling any redone code.
- **Evidence:** [f88e62c (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/f88e62c059907e6817dcad9ee3e19cce85b7428d)

### F14 · The same lines of the V mark module were rewritten across two slices — `churn:apps/galaxy/src/arcade/mark.ts:93-94`

- **What happened:** Lines 93-94 of `apps/galaxy/src/arcade/mark.ts`, as merged, were written and rewritten in 3 commits, in s2 and s6; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** Three commits touched these lines, first in `s2` and then twice in `s6`. This suggests the mark's themed shape was not settled when the first slice finished.
- **Proposed lesson:** Give the brand mark to a single slice, or settle its themed interface in the plan, so later slices do not reshape the same lines.
- **Evidence:** [0882516 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/0882516bb9b55e1fd4b29dbe26ac48929dada467), [e50a7b9 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/e50a7b96e6c483b8a2fbf6c6e01a27b159a55509), [4055b28 (s6)](https://github.com/vertuoza/vertuo-omni-loop/commit/4055b287ec6964835d9deb3799ac2f002b38debf), [`apps/galaxy/src/arcade/mark.ts` lines 93-94, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/bdcc9452b9691ee3bae624e64ab8d31d0fb2ca0d/apps/galaxy/src/arcade/mark.ts#L93-L94)

## Proposed lessons

- Before dropping or replacing a database function, list every policy that depends on it, including those from work merged in the meantime. Run the full migration chain with the access checks locally before pushing. (F1, F8)
- Keep schema and access-check files with the slice that owns them, and declare any cross-slice change as shared ground in the plan. (F2, F1)
- Settle the themed shape of shared UI pieces such as the brand mark in the plan, so successive slices do not rewrite the same lines. (F14)
- Outbox notes are transient handoff messages. Leaving them out of churn detection would keep the flags pointing at real rework. (F5, F6, F7, F9, F11, F12, F13, F10, F4, F3)

## Timeline

- Feature PR [#101](https://github.com/vertuoza/vertuo-omni-loop/pull/101): opened `2026-09-25T20:32:27Z`, ready `2026-09-26T09:25:18Z`, merged `2026-09-26T14:41:45Z`, 1089 minutes in all.
- 7 slices; waves: 3 planned, 5 as merged; median slice: 22 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#107](https://github.com/vertuoza/vertuo-omni-loop/pull/107) | `2026-09-25T20:59:29Z` | `2026-09-25T21:27:12Z` | 28 | 1 | 1 |
| s3 | [#108](https://github.com/vertuoza/vertuo-omni-loop/pull/108) | `2026-09-25T20:59:36Z` | `2026-09-25T21:27:48Z` | 28 | 1 | 1 |
| s4 | [#117](https://github.com/vertuoza/vertuo-omni-loop/pull/117) | `2026-09-25T21:29:25Z` | `2026-09-25T21:43:44Z` | 14 | 2 | 2 |
| s2 | [#137](https://github.com/vertuoza/vertuo-omni-loop/pull/137) | `2026-09-26T08:07:05Z` | `2026-09-26T08:29:15Z` | 22 | 1 | 3 |
| fix-s1-01-migration-after-ask-mode | [#138](https://github.com/vertuoza/vertuo-omni-loop/pull/138) | `2026-09-26T08:07:10Z` | `2026-09-26T08:22:04Z` | 15 | — | 3 |
| s5 | [#139](https://github.com/vertuoza/vertuo-omni-loop/pull/139) | `2026-09-26T08:30:37Z` | `2026-09-26T08:46:42Z` | 16 | 2 | 4 |
| s6 | [#143](https://github.com/vertuoza/vertuo-omni-loop/pull/143) | `2026-09-26T08:47:54Z` | `2026-09-26T09:20:46Z` | 33 | 3 | 5 |

## Decisions

- Decisions: 11 raised and settled — 11 adopted, 0 agreed, 0 drifted; by rank: 11 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 6 merged sub-PRs graded against the plan — 2 paths outside a slice’s territory; 1 more sub-PR names a slice the plan does not hold.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 8 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F2 · Slice `s6` edited the access checks and workspaces migration outside its territory · [#179](https://github.com/vertuoza/vertuo-omni-loop/issues/179)

## Checks

- 11 runs of 1 check on 11 commits in 3 slices, read from GitHub Actions: 2 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| check | 11 | 2 | 2 | s1, fix-s1-01-migration-after-ask-mode | 0 |

Red runs:

| red run | slice | commit | from its log |
| --- | --- | --- | --- |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/36190067365/job/108252789695) | s1 | `d107a8c` | no test named: its last lines are kept as an excerpt |
| [check](https://github.com/vertuoza/vertuo-omni-loop/actions/runs/36229136647/job/108368805417) | fix-s1-01-migration-after-ask-mode | `045fdbd` | no test named: its last lines are kept as an excerpt |

Findings: F1 · The database check failed twice, both times on migration order · [#178](https://github.com/vertuoza/vertuo-omni-loop/issues/178)

## Churn

- 36 commits read across 7 merged pull requests: 4439 lines added, 3850 in the final diff, 594 lines of churn.
- Left out as lockfiles: `pnpm-lock.yaml`.

Findings: F3 · Outbox note from the migration fix slice was dropped · [#180](https://github.com/vertuoza/vertuo-omni-loop/issues/180); F4 · Outbox note on handheld body colours becoming tokens was dropped · [#181](https://github.com/vertuoza/vertuo-omni-loop/issues/181); F5 · Outbox note on letters taking five stripes was dropped · [#182](https://github.com/vertuoza/vertuo-omni-loop/issues/182); F6 · Outbox note on ask mode keeping its email check was dropped; F7 · Outbox note on what follows a theme was dropped; F8 · Outbox note asking the migration to follow ask mode was dropped; F9 · Outbox note on lowercase theme colours was dropped; F10 · Outbox note on scripts refusing stray arguments was dropped; F11 · Outbox note separating out-of-reach from outsider was dropped; F12 · Outbox note on GitHub linking needing a workspace was dropped; F13 · Outbox note on best-effort joining at sign-in was dropped; F14 · The same lines of the V mark module were rewritten across two slices

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
