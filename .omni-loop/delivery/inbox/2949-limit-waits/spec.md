---
prd: 2949
title: A mission waits out a provider limit instead of failing
blocked-by: none
spec: file
phase0: server
---

## Problem

A runner job that runs out of every provider account fails. When every account of the runner is out,
or the job has changed account three times, `kit/lib/runner/job.ts` ends it `failed` with
`no tokens left: …`, and the server resumes nothing for that reason: PRD 2809's resume fires only for
a lost runner. A mission reads any `failed` job as the end of that PRD: it stops it, saying
`its job failed: no tokens left: …`, and never sends it again until a person takes it to ready by
hand (BR-PRODUCT-139).

So a mission left to run at night drops PRDs because a subscription ran out at 02:00, the work the
job did before the limit is thrown away, and nobody is told why until morning. Since PRD 2896 a
fleet at `alone` runs committee, Reviewer and PM jobs on the same budget, which makes it likelier.

Three more gaps sit beside it:

- `runner_claim()` counts only a runner's busy slots. It never reads the accounts the runner reports
  in its health, so a job can be handed to a machine that cannot run it, and only that machine's own
  pause stops it.
- A resume (a recovery of a lost job) is a new row ordered by its own `queued_at`: it waits behind
  every fresh job queued before it.
- While its job is queued, a mission reads `running`, and the room says `building PRD n`: nothing
  says the job waits for a runner or for a reset.

This is area `fleet-capacity` of concept #2800, cut to its wedge: a limit never fails a job or stops
a PRD, recovery comes first, and waiting is said. Job weights and counting one provider account
across runners are left to a later PRD (**Scope**).

## Solution

### 1. A limit ends a job as a wait

When a run reaches its usage limit and no account is left to take it over (every account out, or
`MAX_ACCOUNT_CHANGES` reached), the runner no longer reports a plain failure:

- It saves the job's work exactly as PRD 2809 saves it before any cleanup (a pushed checkpoint, or a
  local save its runner keeps).
- It reports the job `failed` with the same `no tokens left: …` reason as today, plus
  `limit: { resetsAt, guessed }`: the earliest reset among its accounts, `guessed` when the provider
  gave none (the runner's guess, one hour, as today).
- A job no account can take because of its skill (`no account can take this job: …`) is not a
  limit: it fails as today.

The server records the reset on the job as `limited_until`. A runner that sends no `limit` (a kit
older than this PRD) is read from its reason: `no tokens left: every account is out until <ISO>`
gives `limited_until` that time; a `no tokens left` reason with no time stays a plain failure.

### 2. The wait queues a resume that spends no try

The resume trigger of PRD 2809 also fires on a limited job: a job that ends `failed` with
`limited_until` set queues one resume in the same transaction.

- Its `resume_after` is `limited_until`. It is the same line, repository, sender and target, and it
  `resumes` the limited job, as a lost job's resume does.
- **It spends no try.** `attempt` stays the limited job's; a new `waits` counter, 0 for every job
  sent, is one more than the limited job's. A lost runner still spends a try as before.
- **A wait is bounded.** A limited job whose `waits` is already 6 queues nothing: it stays `failed`,
  and its reason becomes `waited 6 times for a provider limit (last until <HH:MM> UTC)`.
- Every skill waits. A resumable skill (`RESUMABLE_SKILLS`) resumes from its save, as PRD 2809's
  resume does; any other skill runs its line again after the reset, since it keeps no save.
- A cancel asked on the limited job, or on its queued resume, cancels the resume: it is never
  claimed (BR-PRODUCT-134 holds).

### 3. The claim: recovery first, never to a machine that cannot run it

`runner_claim()` keeps every rule it has, and:

- **Recovery comes first.** A resume, of a lost runner or of a limit, is claimed before any fresh
  job, ordered by when the first job of its chain was queued, still within the runner's `slots`.
- **No job goes to a runner with every account out.** A runner whose last health is less than
  two minutes old and reports every account `out` with a `resetsAt` still to come is handed no job.
  A runner with no fresh health is judged by its own pause, as today.

### 4. A mission reads waiting, never failed

`apps/omni-app/src/missions/supervisor.ts` reads a run's attempts chain as it does for a lost
runner:

- A job that ended on a limit and has a resume queued or running reads **waiting**, with its
  `limited_until`. The PRD stays in the mission, its run counter does not move (`LAST_RUN` counts
  held and stopped runs only), and it keeps its `mandate.parallel` place: sending another PRD would
  meet the same limit.
- A job still queued that no runner of its target can take now (every one busy, paused, or with
  every account out) reads **waiting for room**.
- The 6th wait's failure reads as any failure: it stops that PRD, saying its reason.
- The mission's `waitingOn` says it: `waiting for a provider limit until 09:00 UTC (guessed)` or
  `waiting for room on the fleet's runners`.

### 5. The room says it

The hero's now-line in the Operation room and its row on the mission page read
`Provider limit reached until 09:00 · waiting until 09:00` (with `(guessed)` when it is), or
`All runners are busy · waiting for room`, then `tokens spent waiting 0 · next try 09:00`. The line
names the account that ran out and links its runner job, as the Runners page names them, so a
person can check it there. No alert is sent: waiting resolves itself.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuoza/vertuo-omni-loop | database column | `runner_jobs.limited_until` | no written convention: follows `supabase/migrations/20270121100000_runner_resume.sql` (`resume_after`, a timestamptz named for what it holds back) |
| vertuoza/vertuo-omni-loop | database column | `runner_jobs.waits` | no written convention: follows `supabase/migrations/20270121100000_runner_resume.sql` (`attempt`, a small counter with a check) |
| vertuoza/vertuo-omni-loop | migration | `20270125090000_runner_limit_waits.sql` | conventions › A new migration takes the next free version (after `20270124150000_mission_pm.sql`) |
| vertuoza/vertuo-omni-loop | runner report | `limit: { resetsAt, guessed }` | no written convention: follows `kit/lib/runner/agents/agent.ts:29` (`resetsAt`, an ISO time) and `apps/galaxy/src/runners/page/parts.ts:42` (`guessed`) |
| vertuoza/vertuo-omni-loop | mission state | `waiting`, `waiting for room` | no written convention: follows `apps/omni-app/src/missions/supervisor.ts:79` (`JobEnd`, lowercase words) |

## Decisions

- **Scope: the wedge and recovery** (asked). A limit becomes a wait, recovery is claimed first, the
  claim skips a runner with every account out, and the mission and room say it. Job weights, one
  provider account counted across runners and a fleet-wide capacity number are left out.
- **Save and resume** (asked), over parking the job on its runner (it holds a slot for hours and
  dies with a restart) and over starting it again (it throws away the tokens already spent).
- **Recovery first in line, within slots** (asked), over one extra slot above `slots`: no machine is
  pushed past what its owner set.
- **No alert** (asked): the concept's "Tell me when it moves" is left out; the room and the mission
  page say it.
- **The voice's objection, accepted.** persona:B-E DEv: "A job that sits waiting for hours looks
  like a hang to me: I want the waiting line to name the job and the account that ran out." The
  line links its runner job and names the account (**Solution** 5).
- **Waits are counted apart from tries.** A try is spent by a loss; a wait by a limit, capped at 6,
  so a mission can never wait forever and a limit never uses up the three tries a loss needs.
- **A waiting PRD keeps its parallel place.** Sending another PRD while a limit holds would meet the
  same limit.
- **An older runner is read from its reason**, so the fleet gets the wait without upgrading every
  box first.
- **The fleet routing quirk is left as it is.** A job sent with no target goes only to runners with
  no fleet (`20270121110000_runner_claim_resume.sql`); fixing it changes who may take a job, which
  is its own decision (**Risks**).

## User stories

- As a person who started a mission before going to sleep, I find in the morning that a PRD whose
  job hit the provider limit at 02:00 resumed at the reset and reached ready, with nothing lost.
- As a person reading the Operation room while it waits, I see `Provider limit reached until 09:00
  · waiting until 09:00`, which account ran out and a link to the job, not `building PRD 12`.
- As a workspace owner, I see a lost job's recovery start before the fresh jobs queued after it.
- As a person whose limit never comes back, I see the PRD stop after six waits, with the reason,
  rather than wait forever.

## Scope

In:

- The runner's limit ending and its report (`kit/lib/runner/`).
- One migration: `runner_jobs.limited_until`, `runner_jobs.waits`, the resume trigger and the
  claim; its check in `supabase/checks/runner_resume.sql`.
- The server reading the report and an older runner's reason (`apps/galaxy/src/runners/`).
- The mission's reading of a waiting job and its `waitingOn` (`apps/omni-app/src/missions/`).
- The room's and the mission page's waiting line (`apps/galaxy/src/missions/`).
- The guide's Runners and Missions pages say a limit waits.

Out:

- Job weights (a build weighing more than a review).
- One provider account counted across every runner that uses it; a fleet-wide capacity number.
- The "Tell me when it moves" alert.
- The routing of a job sent with no target.
- Parking a job on its runner.

## Test seams

Following the testing form: the narrowest test that proves the risk, beside the code, on fake
runners, never a real provider.

- `kit/lib/runner/job.test.ts`, `turnover.test.ts`: a run ending on the limit with no account left
  saves its work and reports `limit` with the earliest reset, `guessed` when none was given; the
  account cap reports a limit; `no account can take this job` reports none.
- `supabase/checks/runner_resume.sql`: a limited job queues one resume after `limited_until`,
  `attempt` unchanged and `waits` one more; the 7th limit queues nothing and its reason says so; a
  cancel cancels the resume; the claim hands a resume out before a fresh job queued earlier, and
  hands nothing to a runner whose fresh health reports every account out, but does to one whose
  health is stale.
- `apps/galaxy/src/runners/runners.service.test.ts`: the report's `limit` is stored; an older
  runner's `no tokens left: every account is out until <ISO>` gives `limited_until`, and one with no
  time gives none.
- `apps/omni-app/src/missions/supervisor.test.ts`: a limited job with a resume reads waiting, keeps
  its parallel place and leaves the run counter; a queued job no runner can take reads waiting for
  room; the 6th wait's failure stops the PRD with its reason.
- `apps/omni-app/src/missions/mission.e2e.test.ts`: on fake runners, a limit at 02:00, the resume
  at the reset, the PRD at ready, zero jobs lost.
- `apps/galaxy/src/missions/room/room.test.ts`: the two waiting lines, `(guessed)`, the account and
  the job link.

## Risks

Merging publishes one migration (two columns, the resume trigger and the claim), a runner report the
server reads, and a mission reading. It is inert until a job meets a limit. Roll back with a
follow-up migration restoring `runner_claim()` and the trigger as `20270121110000` and `20270121100000`
leave them and dropping the two columns; a kit that sends `limit` to a server that ignores it fails
the job as today.

- **The routing quirk stays.** A mission job sent with no target is still claimable only by runners
  with no fleet; a mission whose fleet's runners do not hold the repository may wait for room on a
  runner that never comes.
- **A runner's health is two minutes old at worst.** A runner whose account came back in the last
  two minutes may be skipped once; its next health report lets it claim again.
- **A wrong guess costs a wait.** A job that wakes at a guessed reset before the limit is over meets
  it again and spends one of its 6 waits.

The Legal entries: none touched. The change reads and writes no personal data beyond the job rows a
runner already reports.

The locked laws the touched files carry (none changes):

- BR-PRODUCT-28: a stranger could tie themselves to a team and see what that team sees. Changing it
  needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-63: an agent could read another team's private work. Changing it needs @pierrederval
  or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-64: a person who left the team could still read its work through an agent. Changing
  it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-12: the terminal could act on words the person no longer stands behind. Changing it
  needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-29: a stranger could read a team's questions and answers. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-39: a question could leak to the wrong people, or its owner could lose it. Changing it
  needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-16: scores and history could change after the fact. Changing it needs @pierrederval or
  @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-59: a member could copy the paid key and run up the workspace's bill. Changing it
  needs @pierrederval or @dervalp to approve the pull request on GitHub.

Rules read beside them, all kept: BR-PRODUCT-139 (a mission never sends a failed PRD again: a limit
is no longer a failure, and the 6th wait's failure still stops it), BR-PRODUCT-133 and
BR-PRODUCT-135 (a save and the runner that holds it), BR-PRODUCT-134 (a cancelled job is never
resumed) and N-PRODUCT-20 (a save's commit never carries a person's name).

The business laws, both kept:

- BL-APPROVALS-1 (an approval covers exactly the files the approver read; a later change voids it):
  kept. A resumed job builds on the same approved files, and a mission's approval is read as before.
- BL-ASK-1 (a person's answer is never changed or reworded afterwards): kept. A wait writes only the
  job's own rows and the mission's own line, never a person's words.

## Acceptance criteria

1. A run that reaches its usage limit with no account left saves its work and ends with
   `limited_until` set to the earliest reset, marked guessed when the provider gave none.
2. A limited job queues one resume after `limited_until`, with `attempt` unchanged and `waits` one
   more; a lost runner still spends a try.
3. A job limited for the 7th time queues nothing and fails with
   `waited 6 times for a provider limit (last until <HH:MM> UTC)`.
4. A job that no account can take because of its skill fails as today, with no wait.
5. A runner older than this PRD whose reason reads `no tokens left: every account is out until <ISO>`
   gets the same wait; one whose reason carries no time fails as today.
6. A cancel asked on a limited job or its resume leaves the resume unclaimed.
7. The claim hands out a resume before a fresh job queued earlier than the resume, within the
   runner's slots.
8. The claim hands no job to a runner whose health, less than two minutes old, reports every account
   out with a reset still to come; it hands one to a runner whose health is older.
9. A mission whose job ended on a limit with a resume pending reads waiting: the PRD stays, its run
   counter does not move, and it keeps its parallel place.
10. A mission whose job is queued and that no runner of its target can take reads waiting for room.
11. The room and the mission page read `Provider limit reached until 09:00 · waiting until 09:00`
    (with `(guessed)` when it is) or `All runners are busy · waiting for room`, name the account
    that ran out and link the runner job.
12. On fake runners, a mission whose job meets a limit at 02:00 resumes at the reset and reaches
    ready with no job lost.
