---
prd: 2175
title: Runner jobs recover from a dead job's claims and never wait on a question
blocked-by: none
spec: file
phase0: server
---

# Runner jobs recover from a dead job's claims and never wait on a question

**Date:** 2026-10-19 · **PRD:** #2175 · **After:** PRD 1830 (runners), PRD 1904 (live job logs), PRD
2102 (runner health), issue #2164 (closed: the job's pull request link was right, this was the
cause) · **Touches:** `kit/lib/runner/` (`runner.ts`, `api.ts`, a new `release.ts`),
`kit/lib/board.ts`, `kit/bin/commands/board.ts`, a new `omni claim check` (`kit/lib/claim/`,
`kit/bin/commands/claim.ts`), `kit/lib/config.ts`, `kit/lib/env/read.ts`, `kit/lib/ask/`, the
skills `pr`, `wave`, `do-work` and `yolo`, the briefing's kit default, `apps/galaxy/src/runners/`,
`apps/galaxy/src/engineering/tally.ts`, one migration, and the `runners` draft screen.
**Out of scope:** a watcher on laptops (`omni watch`), alarms by phone or email or on the Loop page,
the Claude plan's usage limits, and retrying a job the runner saw die.

## Problem

A runner job builds a PRD with `/omni:yolo`. Each slice is claimed with a draft sub-PR that carries
`omni:in-progress`. Sometimes the job dies mid-wave, and on vertuo-agents that has happened in four
ways:
- Claude stops after about ten minutes (#1914);
- the weekly usage limit;
- the monthly spend limit;
- a crash.

Nothing then touches the sub-PRs the job held. They keep `omni:in-progress` and their commits. The
board counts a claim as stale only when its branch carries nothing beyond the claim commit, so these
read `in-flight` forever.

Every later `/omni:yolo` run of that PRD leaves another job's in-flight slice alone, as the kit says,
and ends **held**, pointing at a slice sub-PR. Job a8a6bf82 (`/omni:yolo 1904`) ended this way on
#1908 and #1909: both held about 450 lines of work, and the job that wrote them was gone. A person
has to find out, then mark each sub-PR ready or close it, by hand.

A runner job is also unattended: `claude -p`, with nobody to answer. Yet `/omni:yolo` step 6 asks a
question on a red gate when `answers.enabled` is on, and no skill knows it runs unattended.

## Solution

### 1. A claim carries its job

`omni runner` starts each job with three more variables, read through `kit/lib/env/read.ts`, as
every variable is (ADR-0057):

| variable | value |
|---|---|
| `OMNI_JOB` | the job's id |
| `OMNI_RUNNER` | the runner's name (today it is set only when the job has a sender; it is now always set) |
| `OMNI_UNATTENDED` | `1` |

`/omni:pr`'s Claim mode, when `OMNI_JOB` is set, writes one more line in the sub-PR's status
comment, `- job: <id> · runner <name>`. A claim made outside a runner has no such line.

### 2. The watcher releases a dead job's claims

When a job ends, the runner releases every claim the job still holds. This applies to every way a
job can end: done, failed, timed out, cancelled, or marked lost by the server (found by the hourly
sweep). `release(job, repo, reason)` in a new `kit/lib/runner/release.ts`:

1. **Finds the job's claims** with `gh`, which the box is signed in to for its jobs: the
   repository's open draft pull requests that carry `labels.inProgress` and whose status comment
   (the `<markers.prefix>-status` marker) has the line `job: <this id>`.
2. **Swaps the label** on each: removes `labels.inProgress`, adds `labels.released` (`omni:released`
   by default).
3. **Raises the alarm on the sub-PR** with one comment:
   *Released: runner job `<id>` on `<runner>` ended (`<reason>`) while it held this claim. The next
   run reuses it if the plan and its territory still match, or closes it and rebuilds the slice.*
4. **Reports** the numbers it released in the job's final report: `JobUpdate` gains
   `released: number[]`, stored in `runner_jobs.released`.

A claim whose status comment names another job, or no job, is never touched. A job that ends done
and holds nothing releases nothing, and posts nothing.

### 3. The board reads a released or quiet claim as stale

`kit/lib/board.ts` adds two cases to `claimed-stale`, after `merged` and `stuck` as today:

| a draft sub-PR that… | reads |
|---|---|
| carries `labels.released` | `claimed-stale`, at once |
| carries `labels.inProgress`, with its last commit **and** its last update both older than `limits.claimDeadMinutes` (default 240) | `claimed-stale` |
| has no commit beyond its claim commit, a claim older than `limits.claimStaleMinutes` (today's rule, unchanged) | `claimed-stale` |

- **The unknown-date rule holds.** A head commit date that cannot be read still never makes a claim
  stale (BR-PRODUCT-2).
- **The second row is the fallback** for a claim no watcher saw die: a laptop session, or a runner
  whose release failed.
- **What reads it:**
  - `kit/bin/commands/board.ts` `couldBeStale` also picks the released and the quiet drafts, and
    reads their last commit as it does today.
  - `apps/galaxy/src/engineering/tally.ts` counts with the same function.

### 4. The takeover reuses the same work, or rebuilds

`/omni:wave` step 2, taking over a `claimed-stale` slice, first runs a new command:

```bash
node .omni-loop/bin/omni.mjs claim check <prd> <slice>
```

**What it checks.** It finds the claim commit (`chore(<slice>): claim`) on the slice branch,
`<remote>/<slice branch>`, then:

1. it compares the slice's row of the PRD's `plan.md` at that commit with the row on the feature
   branch now, on its title and its territory;
2. it checks every file the branch changed since the claim against the territory, as
   `/omni:wave` step 4 reads it: the outbox dir and a generated path are never outside.

**What it prints:**

| outcome | line | exit |
|---|---|---|
| same work | `reuse` | 0 |
| the row's territory changed | `rebuild: plan row changed: territory` | 1 |
| the row's title changed | `rebuild: plan row changed: title` | 1 |
| a changed file outside the territory | `rebuild: outside territory: <path>` | 1 |
| no claim commit found | `rebuild: no claim commit` | 1 |
| the row is gone | `rebuild: slice not in the plan` | 1 |

It reads git through an injected port, so it is a pure function in its tests.

**On `reuse`:**
- the slice gets `labels.inProgress` back, and `labels.released` comes off;
- the status comment says `claimed`, *taken over from job `<id>`* (or *from a quiet claim* when no
  job line);
- the subagent is told the branch is a reused one.

**On `rebuild`:**
- the sub-PR is closed unmerged, with the reason as its comment
  (*Closed to rebuild: `<the rebuild line>`*);
- its remote branch is deleted;
- the slice is claimed afresh in the same wave, through `/omni:pr`'s Claim mode.

The board already reads a closed sub-PR as never claimed.

**A reused branch is re-verified before anything is built on it.** `/omni:do-work --in-wave`, told
its branch is reused, first merges the feature branch into it, then runs the preflight and reviews the branch's diff
against the slice's done-when. Each finding is fixed within `limits.attempts` or
recorded as an outbox item, before the slice's own work goes on.

### 5. An unattended run never asks

Under `OMNI_UNATTENDED`:

- **`/omni:yolo` step 6** (*Answer here, when the gate ends red*) is skipped. The run ends red as it
  does with `answers.enabled` off: the outbox posted on the feature PR, the feature PR in draft.
- **The briefing's kit default, Any agent › Asking,** gains one line: under `OMNI_UNATTENDED`, ask
  nothing; a decision becomes an outbox item ranked high, and the run carries on or ends.
- **`omni ask question`** exits 3 with the line `unattended`, and never opens a round or waits.
  **`omni ask wait`** does the same.

### 6. The Runners page shows the alarm

A job whose report carried released claims shows, under its status, in `--ask-red`:
*Released #1908, #1909*, each number linking its sub-PR.

A release that failed shows *Could not release this job's claims: `<why>`*. The job's report
carries the reason as `releaseError` (at most 200 characters), stored in
`runner_jobs.release_error`.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | config | `labels.released` (`omni:released`) | `labels.inProgress` ← kit/lib/config.ts:324 |
| vertuo-omni-loop | config | `limits.claimDeadMinutes` (240) | `limits.claimStaleMinutes` ← kit/lib/config.ts:440 |
| vertuo-omni-loop | env | `OMNI_JOB`, `OMNI_UNATTENDED` | `OMNI_SENT_BY`, `OMNI_RUNNER` ← kit/lib/env/read.ts:143 |
| vertuo-omni-loop | CLI | `omni claim check <prd> <slice>` | no written convention: follows `omni plan check <prd>` (kit/bin/commands/plan.ts) |
| vertuo-omni-loop | db | `runner_jobs.released int[]`, `runner_jobs.release_error text` | no written convention: follows `runner_jobs.tokens` ← supabase/migrations/20261212090000_runner_tokens.sql:5 |
| vertuo-omni-loop | contract | `JobUpdate.released`, `JobUpdate.releaseError` | `JobUpdate.tokens` ← apps/galaxy/src/runners/runners.contract.ts |

## Decisions

- **A watcher in `omni runner`, releasing and alarming.** The person chose this. The watcher sees a
  job die at once, which no rule read from GitHub can. It releases the job's claims and raises the
  alarm on the Runners page and on each sub-PR. Other channels and laptops are out of scope, by the
  person's choice.
- **Same work means the plan and the territory still match.** The person chose this rule: the
  slice's plan row is unchanged since the claim, and the branch stays inside the territory. It is
  checked mechanically by `omni claim check`, so two runs reach the same answer.
- **Not the same work: close it and rebuild.** The person chose this. The dead sub-PR is closed with
  its reason, and the slice is rebuilt from a fresh claim in the same run, so nothing waits on a
  person.
- **The voice's objection, accepted.** The F-E Developer (persona:F-E Developer) would not trust a
  dead agent's half-finished commits. So a reused branch is re-verified, by the preflight and a
  review of its diff, before anything is built on it.
- **A quiet-time fallback of 240 minutes,** for claims no watcher saw die. Long enough that an agent
  thinking without pushing is not taken over: the longest slice job on vertuo-agents ran 1 h 21 min.
  This is the most reversible choice, taken without asking: one config value.
- **A label for "released",** rather than a state only the status comment holds. The board reads
  labels and never comments, so the label is what it can see.
- **The runner releases with `gh`,** the client the box already signs in for its jobs, rather than
  through the Omni app. The board's server stays independent of the runners module.
- **Unattended runs skip yolo's end question.** `OMNI_UNATTENDED` is set only by the runner, so a
  person's terminal is unchanged.
- **Issue #2164 closed.** The job's pull request link was right. This PRD is what ends a run on a
  slice sub-PR.

## User stories

- As the person who sent `/omni:yolo 1904` to a runner, when the job dies on its weekly limit, I see
  *Released #1908, #1909* on its row. Sending the line again finishes the PRD from those branches,
  with no clean-up by hand.
- As a reviewer, I read on a sub-PR that a dead job released it, and later that a run took it over
  or closed it to rebuild, and why.
- As a front-end developer, I know a reused branch was re-checked before more code went on top.
- As the person who sends jobs, I never find a runner job waiting on a question nobody can see.

## Scope

**In:**
- **The runner:** the job's variables, the watcher's release and its report.
- **The board:** the two new stale cases, the `couldBeStale` read, and the engineering tally.
- **The takeover:** `omni claim check`, and the takeover's reuse-or-rebuild in `/omni:wave`.
- **Re-verification** in `/omni:do-work`.
- **Unattended runs:** the `job:` line in `/omni:pr`'s Claim mode, the unattended skip in
  `/omni:yolo`, the briefing's Asking line, and `omni ask`'s refusal.
- **Config:** `labels.released` and `limits.claimDeadMinutes`.
- **The app:** the migration, the contract, and the Runners page's alarm.
- **Docs:** the `runners` draft screen, and the runner section of the kit README.

**Out:** what the header lists.

## Test seams

Tests sit beside the code (`omni kb show testing`). None calls GitHub or Supabase: `gh`, git and the
clock are injected.

- **`kit/lib/runner/release.test.ts`:**
  - only open drafts that carry `inProgress` and name this job are released;
  - another job's claim and a claim with no job line are left alone;
  - the label is swapped and the comment is posted;
  - a missing `released` label still removes `inProgress`, and is reported;
  - a `gh` failure gives `released: []` and a `releaseError`;
  - each ending calls it: done, failed, timeout, cancelled, lost.
- **`kit/lib/board.test.ts`:**
  - a released draft is `claimed-stale`;
  - a quiet `inProgress` draft is `claimed-stale` past 240 min and `in-flight` at 239;
  - an unknown date is never stale;
  - `merged` and `stuck` still win;
  - today's rule is unchanged.
- **`kit/lib/claim/check.test.ts`:** each of the six lines of §4, on fixture git reads.
- **`kit/bin/commands/claim.test.ts`:** the command, through `main()` on a fixture repository.
- **`kit/lib/runner/runner.test.ts`:** the three variables in the job's session, and the end path
  calling `release` and reporting it.
- **`kit/lib/ask/`:** `omni ask question` and `omni ask wait` under `OMNI_UNATTENDED` exit 3 with
  `unattended`.
- **The kit's skill-text tests:**
  - Claim mode's `job:` line;
  - the wave takeover's reuse and rebuild;
  - do-work's re-verification;
  - yolo's unattended skip;
  - the briefing's line.
- **The app:**
  - contract tests for `released` and `releaseError`;
  - controller and service tests that store them;
  - the migration test;
  - page model and render tests of both alarm lines.
- **Mutation:** `kit/lib/board.ts` is delivery core. `pnpm mutation:changed` runs on it, and its
  floor in `mutation/floor.json` never goes down.

## Risks

**What a merge publishes:**
- **The migration:** two nullable columns on `runner_jobs`.
- **The kit:** the board's states, the watcher, `omni claim check`, `omni ask`'s refusal, and the
  four skills.
- **The arcade:** the Runners page's alarm.

**The label:** `labels.autoCreate` is false here, so a person creates `omni:released` in each
repository a runner works in. Until it exists, a released claim falls back to the 240-minute rule.

**A wrong takeover:** a live laptop agent quiet for over 240 minutes can be taken over. The takeover
comment names the earlier claim, and `limits.claimDeadMinutes` is raised in one line.

**Load:** one `gh` search per ended job.

**Rollback:** revert the merge. The columns stay, unused. `omni:released` labels left on sub-PRs read
as `in-flight` again under the old board.

**The locked laws.** `omni kb laws` printed the 20 below for the files this design changes. The
design keeps each one as it stands:
- no agent merges or applies the override label;
- the rule that an unreadable head commit date is never stale (BR-PRODUCT-2) holds.

- BR-PRODUCT-3: an agent could wave its own work through the gate with no person answering the open questions. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-5: a person could merge work whose open decisions nobody answered. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-6: a risky change nobody explained reaches the main branch, and the reviewer is never told. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-12: the terminal acts on words the person no longer stands behind, and nobody can tell what was decided. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-28: a stranger could tie themselves to a team and see what that team sees. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-29: a stranger could read a team's questions and answers. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-39: a question could leak to the wrong people, or its owner could lose it. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-59: a member could copy the paid key and run up the workspace's bill. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent could read another team's private work. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent. Changing it needs @pierrederval to approve the pull request on GitHub.
- BR-PRODUCT-94: an agent could answer a question in a person's name. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-3: a badly ranked question slips past, and the person who answers decides without the facts they need. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-4: any change could switch its own gate off, and every reviewer would trust a green check that means nothing. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-7: a person is locked out of their own terminal by a tool meant to help them. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-8: a person's questions and answers could be sent to a server they never chose. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-13: it could overwrite a person's own settings without them knowing. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-14: a rule quietly loses its test, and the team only learns it when the server refuses the pull request. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-15: unreviewed work reaches every user, and nobody chose to ship it. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-16: scores and history could change after the fact, and players could no longer trust what they earned. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-17: anyone opening the arcade could read a key that controls the database or a paid service. Changing it needs @pierrederval to approve the pull request on GitHub.

## Acceptance criteria

Acceptance scenarios are off in this repository, so each criterion becomes ordinary tests.

1. **The job line.** A runner job's claim has `job: <id> · runner <name>` in its sub-PR's status
   comment.
2. **The watcher releases.** When a runner job ends while it holds claims, each held sub-PR loses
   `omni:in-progress`, gains `omni:released` and a comment naming the job and its reason. The job's
   row on the Runners page reads *Released #<n>, …*.
3. **Only its own.** A sub-PR claimed by another job, or by no job, is never released.
4. **Takeable at once.** A draft sub-PR labelled `omni:released` reads `claimed-stale` on the board.
5. **The quiet fallback.** A draft still on `omni:in-progress` whose last commit and last update are
   older than 240 minutes reads `claimed-stale`. At 239 minutes it reads `in-flight`.
6. **The check.** `omni claim check <prd> <slice>` prints `reuse` when the plan row and the
   territory still match, and `rebuild: <reason>` otherwise.
7. **Reuse.** On `reuse`, the next wave continues on the same sub-PR, says *taken over from job
   <id>*, and re-verifies the branch (preflight and diff review) before building on it.
8. **Rebuild.** On `rebuild`, the next wave closes the sub-PR with the reason, deletes its branch,
   and rebuilds the slice from a fresh claim in the same run.
9. **No question.** Under `OMNI_UNATTENDED`, `/omni:yolo` asks no question on a red gate, and
   `omni ask question` exits 3 with `unattended`.
10. **A failed release.** A release that fails shows *Could not release this job's claims: <why>*
    on the job's row, and the claims become takeable after 240 minutes.
