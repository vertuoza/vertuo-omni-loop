# Plan: A mission waits out a provider limit instead of failing

PRD #2949, its spec beside this plan (`spec.md`). The feature branch `feat/limit-waits` goes into
`main` through one feature PR ("Closes #2949"); each slice is a sub-PR from `feat/limit-waits--<slice>`
into the feature branch ("Part of #2949").

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A job that ends `failed` on a limit records `limited_until` (from the report's `limit`, or an older runner's `no tokens left: every account is out until <ISO>`) and queues one resume after it, `attempt` kept and `waits` one more; the 7th limit queues nothing and says why; a cancel cancels the resume | `supabase/migrations/` `supabase/checks/runner_resume.sql` `supabase/database.types.ts` `apps/galaxy/src/runners/runners.service` `apps/galaxy/src/runners/runners.contract` `apps/galaxy/src/runners/runners.repository` `apps/galaxy/src/runners/runners.resume.migration.test.ts` | — | 1 | deep |
| s2 | A run that reaches its limit with no account left saves its work and reports `failed` with `limit: { resetsAt, guessed }`; `no account can take this job` reports none | `kit/lib/runner/job` `kit/lib/runner/turnover` `kit/lib/runner/runner.ts` `kit/lib/runner/runner.test.ts` `kit/lib/runner/fixtures/` | s1 | 2 | build |
| s3 | The claim hands out a resume before any fresh job, by its chain's first queued time, within slots, and hands no job to a runner whose fresh health reports every account out | `supabase/migrations/` `supabase/checks/runner_resume.sql` `supabase/database.types.ts` `apps/galaxy/src/runners/runners.claim-resume.migration.test.ts` `apps/galaxy/src/runners/runners.resume-claim.test.ts` | s1 | 2 | deep |
| s4 | A mission reads a limited job with a resume as waiting (PRD kept, run counter unchanged, parallel place kept), a queued job no runner of its target can take as waiting for room, and the 6th wait's failure as a stop with its reason | `apps/omni-app/src/missions/` | s1 | 2 | build |
| s5 | The room and the mission page say `Provider limit reached until 09:00 · waiting until 09:00` (with `(guessed)`) or `All runners are busy · waiting for room`, name the account that ran out and link the runner job | `apps/galaxy/src/missions/` | s4 | 3 | build |
| s6 | The guide's Runners and Missions pages say a limit waits, how many times, and that recovery is taken first | `docs/guide/runners.md` `docs/guide/missions.md` | s2, s3, s5 | 4 | light |

Shared ground: `supabase/migrations/`, `supabase/checks/runner_resume.sql` and
`supabase/database.types.ts` are declared by s1 and s3: s1 adds the columns and the trigger in wave 1,
s3 rewrites `runner_claim()` in its own later migration in wave 2, so they never merge in one wave.
No other prefix is declared twice. The built files (`kit/dist/`, `apps/omni-app/api/`) are rebuilt by
each wave, never listed.

Law proofs: several tests these slices extend prove rules: `runner_resume.sql` and the resume and
claim migration tests (BR-PRODUCT-134, BR-PRODUCT-135; s1, s3), `runners.service.test.ts`
(BR-ACCESS-7; s1), `kit/lib/runner/job.test.ts` and `runner.test.ts` (N-PRODUCT-19 and the access
invariants; s2), `supervisor.test.ts` and `mission.e2e.test.ts` (BR-PRODUCT-139; s4). None is a
locked law, so no slice carries a law mark, but a slice that changes one of these files records a
high outbox item naming the rule it proves and writes its account, so the feature's coverage gate
finds every change accounted for.

## Per slice: done when

### s1 (deep: a migration, a trigger and a law path on job rows)

- `20270125090000_runner_limit_waits.sql` (dated after the newest on the branch and on `main`) adds
  `runner_jobs.limited_until` and `runner_jobs.waits` (0 to 6), lets a resume keep `attempt` when
  `waits` grew, and makes the resume trigger fire on a failed job with `limited_until`.
- `supabase/checks/runner_resume.sql` proves: a limited job queues one resume after `limited_until`,
  `attempt` unchanged, `waits` one more; the 7th queues nothing and its reason reads
  `waited 6 times for a provider limit (last until <HH:MM> UTC)`; a cancel leaves the resume unclaimed;
  a lost runner still spends a try. The check runs in CI's `supabase` workflow.
- The job report accepts an optional `limit: { resetsAt, guessed }` and stores `limited_until`; an
  older runner's `no tokens left: every account is out until <ISO>` gives the same; a reason with no
  time gives none (`runners.service.test.ts`).
- `supabase/database.types.ts` regenerated from a fresh database; every parse schema reading
  `runner_jobs` rows takes the two columns.

### s2

- A fake run ending on the limit with every account out saves the job's work as PRD 2809 does, then
  reports `failed` with `limit.resetsAt` the earliest reset, `guessed: true` when no time was given.
- The account cap (`MAX_ACCOUNT_CHANGES`) reports a limit too; `no account can take this job: …`
  reports none.

### s3 (deep: the claim's order and skip are a concurrency path)

- A new migration, dated after s1's, rewrites `runner_claim()` keeping every rule it has, plus:
  resumes first, ordered by the first queued time of their chain; no job to a runner whose health
  is under two minutes old and reports every account `out` with a `resetsAt` to come.
- `runner_resume.sql` proves the order (a resume queued after a fresh job is claimed first), the
  slots still bound it, a fresh all-out runner gets nothing, and a stale one still gets a job.

### s4 (`ui: yes`)

- `supervisor.test.ts`: a limited job with a resume queued reads waiting with its `limited_until`;
  the PRD stays, `LAST_RUN` is not reached by waits, and it keeps its `mandate.parallel` place; a
  queued job whose target's runners are all busy, paused or out reads waiting for room; the 6th wait's
  failure stops the PRD with its reason.
- The mission's `waitingOn` reads `waiting for a provider limit until 09:00 UTC (guessed)` or
  `waiting for room on the fleet's runners`.
- `mission.e2e.test.ts`: on fake runners, a limit at 02:00, the resume at the reset, the PRD at
  ready, no job lost.

### s5 (`ui: yes`)

- `room.test.ts`: the hero's now-line reads `Provider limit reached until 09:00 · waiting until 09:00`
  with `(guessed)` when it is, or `All runners are busy · waiting for room`, then
  `tokens spent waiting 0 · next try 09:00`; it names the account that ran out and links the runner
  job.
- The mission page's row reads the same line.
- The design review (`/omni:pixel-perfect review`) is run on the room, and the `fleet-room` library
  screen's two waiting states match what is built.

### s6 (light: wording only)

- `docs/guide/runners.md` says a limit with no account left waits for the reset, at most six times,
  without spending a try, and that recovery is claimed first.
- `docs/guide/missions.md` says a mission waits and never stops a PRD for a limit, and what the room
  shows meanwhile.
- The guide's tests stay green.
