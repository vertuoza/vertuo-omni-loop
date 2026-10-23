---
prd: 2482
title: A queued job no runner can take reads Cannot run
blocked-by: none
spec: file
phase0: server
---

## Problem

A job waits in the queue until a runner takes it, and a runner takes only a job it can run: one sent to
it, to its fleet, or to any runner when it has no fleet; for a repository it holds; and, for a job that
must run as an API key's GitHub App, only when it registered that it can (`runner_claim()`,
`supabase/migrations/20261228090000_api_key_github_apps.sql`). When no runner of the workspace meets
those rules, the job is never taken, and the Runners page still reads **Queued** beside it, forever.

On 2026-10-23 the Omni app had queued `/omni:retro-apply` jobs for four repositories that the
workspace's only runner did not hold. Every row read Queued · Any runner; the person read it as
"retro-apply is not working at all", and finding the cause took a production query.

## Solution

On the Runners page, a queued job that no runner of the workspace can take reads **Cannot run**, in the
red of a failed job, in place of Queued, with the reason on the line under it. Nothing is stored and
nothing is offered: the job stays `queued` in the database, keeps its Cancel, and the page decides
again on every read (every 5 s). The moment a runner that can take it registers, the row reads Queued
again and the runner takes it as today.

A runner **can take** a queued job when all of these hold, the same rules as `runner_claim()`:

1. **Its target:** the job went to this runner; or to this runner's fleet; or to any runner, and this
   runner has no fleet.
2. **Its repository:** the runner holds the job's repository.
3. **Its App:** the job does not need a GitHub App, or the runner registered that it can run one.

Whether the runner is online, offline, busy or paused does not count: such a runner takes the job once
it is back, free or unpaused, so that job is not Cannot run. A paused one keeps its own line,
`Waiting: <runner> paused (<reason>)` (PRD 2102), which a Cannot run job never shows.

The reason sits in the line under the status that the page already uses for `Waiting: … paused`
(`runners-why`). The first two rules are one function the page shares with that Waiting line, so both
pick the runners that could take a job the same way. Today the Waiting line counts every runner for a
job sent to any runner; it then counts only runners with no fleet, as the claim does.

The reason under **Cannot run** is the first that applies, in this order:

| the job | the reason |
|---|---|
| sent to a runner the workspace no longer lists | `The runner it was sent to is gone` |
| sent to a fleet the workspace no longer lists | `Fleet <fleet> is gone` |
| sent to a runner that does not hold its repository | `<runner> does not hold <owner/name>` |
| sent to a fleet none of whose runners holds its repository | `No runner of <fleet> holds <owner/name>` |
| sent to any runner, and no runner without a fleet holds its repository | `No runner holds <owner/name>` |
| a runner of its target holds the repository, but none can run a GitHub App, and the job needs one | `No runner can run it as <key>'s GitHub App` |

`<runner>` is the runner's name, `<fleet>` the fleet's label (its key when the workspace no longer
lists it), `<owner/name>` the job's repository, `<key>` the name of the API key that sent it.

To know the third rule, the page's read gains two facts it does not carry today, both already in the
database: a runner's `githubApp` (`runners.github_app`) and a job's `needsApp` (the key that sent it
holds an App, or `runner_job_needs_app` marks the job), read by the service as the service role. Both
are optional on the contract, so a page or a reader that does not know them reads a job as needing no
App and a runner as running none, which never shows Cannot run for that reason.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| omni-loop | ui | `Cannot run` (status words) | no written convention: follows `statusWords` ← `apps/galaxy/src/runners/page/model.ts:87` |
| omni-loop | ui | `cannotRunReason` (page model function) | no written convention: follows `whereWords` / `retroLineOf` ← `apps/galaxy/src/runners/page/model.ts:147` |
| omni-loop | api | `Runner.githubApp`, `Job.needsApp` | `githubApp` ← `apps/galaxy/src/runners/runners.contract.ts:157`; `needsApp` follows `needs_app` ← `apps/galaxy/src/runners/runners.repository.ts:219` |

## Decisions

- **Where it shows** (asked): the job's status on its row reads **Cannot run** in red, the reason under
  it, over a line in the job's Terminal or a new status in the database.
- **Which reasons** (asked): no runner of the job's target holds its repository; the runner or fleet it
  was sent to is gone; no runner of its target can run it as its key's GitHub App. Offline and busy
  runners are **not** reasons: those jobs run once a runner is back or free.
- **Reason only** (asked): the line says what is wrong and offers no fix.
- **The voice's objection** (B-E DEv, `persona:B-E DEv`): "'No runner holds nimbus/nimbus-work'
  tells me what's wrong, but I still have to dig up how to give a runner a repository. A warning I
  can't act on is the fluff I expected." Settled **just-this-run**: the person kept reason only.
- **Taken without asking, the most reversible option:** the page decides from its own read, and stores
  nothing; the database's status stays `queued`, so the claim, Cancel, the terminal's reads and the API
  are unchanged. Removing the two optional fields and the function reverts it.
- **Taken without asking:** the Waiting line of PRD 2102 picks its runners with the same shared rule,
  so for a job sent to any runner it counts only runners with no fleet, as `runner_claim()` does; today
  it counts every runner, and could say a job waits on a paused runner that can never take it.
- **Taken without asking:** the two new fields are optional on the contract (absent reads as false), so
  an older reader of the board keeps working.

## User stories

- As a member who sent a job, when no runner can ever take it, I see **Cannot run** and why, instead of
  waiting on Queued.
- As a workspace owner, when the Omni app queues a job for a repository no runner holds, I see which
  repository to give a runner.
- As an API key's maker, when my key's job needs its GitHub App and no runner can run one, I see it on
  the row.
- As a member, when a runner that can take it comes online, the row reads Queued again by itself and
  the job runs.

## Scope

In: the Runners page's Jobs rows (status words, tone, the reason line), the page model's function, the
Waiting line's choice of runners (PRD 2102), the `runners` library screen's draft, the
two optional fields on the board read and the service that fills them.

Out: the claim itself (`runner_claim()` is unchanged), the terminal's `omni runner jobs` reads, a
notification or an e-mail about a job that cannot run, refusing to queue such a job, the Omni app's
retro queue, and any hint of how to fix it.

## Test seams

- **The page model** (`apps/galaxy/src/runners/page/model.ts`): one pure function over a job, the
  board's runners and the workspace's fleets, returning the reason or null; unit-tested for each row of
  the reasons table, for each way a runner can take a job (to it, to its fleet, to any runner; offline;
  busy; with an App), and for a job that is not queued (never Cannot run).
- **The Waiting line** (`health.test.ts`): a job sent to any runner ignores a paused runner that has a
  fleet, and a Cannot run job shows no Waiting line.
- **The status words and tone:** `Cannot run` with the `fail` tone for a queued job with a reason;
  `Queued` and `queue` otherwise.
- **The row** (`render.test.ts`): a queued job no runner holds renders `Cannot run` and its reason, and
  keeps its Cancel.
- **The service** (`runners.service.test.ts`): the board carries `githubApp` per runner and `needsApp`
  per job, from the store's in-memory fakes; no test calls GitHub or a real database.
- **The contract** (`runners.contract.test.ts`): a board without the two fields still parses.

## Risks

- **What merging publishes:** the arcade (`apps/galaxy`) deploys to Vercel production on merge; the
  Runners page shows Cannot run at once. Rollback: revert the feature PR; nothing is stored, so nothing
  needs cleaning.
- **A wrong Cannot run** would hide a job that is about to run: the rules mirror `runner_claim()`, and
  the tests hold each one; a job read wrongly still runs, since the claim does not read the page.
- **The needs-App read:** `runner_job_needs_app` and `api_key_github_apps` are readable by the service
  role only; the board's read must use it, as the claim's own reads do.
- **The Legal entries:** L-GDPR-1 (only members read a workspace's personal data): the reason names a
  runner, a fleet, a repository and an API key's name, all already on the member-only board, and the
  board's read stays member-only. L-GDPR-2 (credentials never in clear): only whether a key holds an App
  is read, never the App's key. No other entry touched.
- **The locked laws:** none touched.

## Acceptance criteria

- A queued job sent to any runner, for a repository no runner without a fleet holds, reads `Cannot run`
  in red with `No runner holds <owner/name>` under it.
- A queued job sent to a runner that does not hold its repository reads `Cannot run` with
  `<runner> does not hold <owner/name>`.
- A queued job sent to a fleet none of whose runners holds its repository reads `Cannot run` with
  `No runner of <fleet> holds <owner/name>`.
- A queued job sent to a runner or a fleet the workspace no longer lists reads `Cannot run` with
  `The runner it was sent to is gone` or `Fleet <fleet> is gone`.
- A queued job that needs its key's GitHub App, where runners of its target hold the repository but none
  can run an App, reads `Cannot run` with `No runner can run it as <key>'s GitHub App`.
- A queued job that a runner can take reads `Queued`, whether that runner is online, offline or busy.
- A job that is not queued never reads `Cannot run`.
- A queued job sent to any runner never reads `Waiting: … paused` because a runner in a fleet is
  paused: only runners without a fleet count for it.
- A Cannot run job keeps its Cancel, and its database status stays `queued`.
- Once a runner that can take it registers, the next read shows the job `Queued`.
