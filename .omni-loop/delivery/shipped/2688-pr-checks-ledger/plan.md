# Plan: the pull-request checks run on our own job ledger

PRD #2688, its spec beside this plan (`spec.md`). The feature branch `feat/pr-checks-ledger` merges into `main` through one
feature PR (`Closes #2688`); each slice is a sub-PR from `feat/pr-checks-ledger--<slice>` into the feature branch
(`Part of #2688`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A refresh gives the latest state per pull request and check: `background_job_refresh()`, the `again` column, and the worker's per-kind failure hook | `supabase/migrations/20270114090000_pr_check_jobs.sql` `supabase/checks/background_jobs.sql` `supabase/database.types.ts` `apps/omni-app/src/jobs/ledger` `apps/omni-app/src/jobs/worker` `apps/omni-app/src/health/health.test.ts` `apps/omni-app/src/knowledge-pack/knowledge-pack.test.ts` | — | 1 | deep |
| s2 | The `outbox` check runs as a `pr-outbox` job, with today's verdicts and failure handler | `apps/omni-app/src/outbox-check/` | s1 | 2 | build |
| s3 | The `inbox` check runs as a `pr-inbox` job, with today's verdicts and failure handler | `apps/omni-app/src/inbox-check/` | s1 | 2 | build |
| s4 | The `omni/approved` check runs as a `pr-approved` job, with today's verdicts and failure handler | `apps/omni-app/src/approved-check/` | s1 | 2 | build |
| s5 | The `budgets` check runs as a `pr-budgets` job, with today's verdicts and its `neutral` failure | `apps/omni-app/src/budgets-check/` | s1 | 2 | build |
| s6 | A stuck check shows as delayed on the pull request: the sweep posts a check due over 10 minutes as `queued` | `apps/omni-app/src/jobs/sweep` `apps/omni-app/src/jobs/delayed` | s1 | 2 | build |
| s7 | Pull-request events, the server-event recheck and the approval re-run refresh the four jobs and run them; the five Inngest functions and the shared event are gone | `apps/omni-app/src/webhook/` `apps/omni-app/src/server-event/` `apps/omni-app/src/functions` `apps/omni-app/src/inngest-client.ts` `apps/omni-app/src/jobs/pr-checks.ts` `apps/omni-app/src/outbox-check/` `apps/omni-app/src/inbox-check/` `apps/omni-app/src/approved-check/` `apps/omni-app/src/budgets-check/` `apps/omni-app/src/escalation/escalation.test.ts` `apps/omni-app/src/retro/retro.test.ts` `apps/omni-app/src/vercel-functions.test.ts` `apps/omni-app/README.md` | s2, s3, s4, s5, s6 | 3 | build |

**Shared ground.** `apps/omni-app/src/outbox-check/`, `inbox-check/`, `approved-check/` and `budgets-check/` are declared by
s2 to s5 (wave 2, one folder each) and by s7 (wave 3), which removes the Inngest functions those slices leave delegating to
their handlers; `outbox-check/inngest-route.test.ts` reads all four and is s2's in wave 2, s7's in wave 3. The ledger's fakes in
`health.test.ts` and `knowledge-pack.test.ts` gain the refresh in s1 only. The webhook's `github-route-jobs.test.ts` and
`server-event/recheck.test.ts` are s7's alone. `apps/omni-app/api/` is generated and listed nowhere.

## Per slice: done when

### s1 (deep: concurrency in the database) (`ui: yes`)
- `background_job_refresh(kind, key, subject, payload, delay_seconds)` does each row of the spec's refresh table, and only the
  service role may call it; `again` is a new column, `false` by default.
- A finish of a job holding `again` keeps its attempt line, then queues the job at once with `again` cleared; every other finish is
  unchanged.
- `supabase/checks/background_jobs.sql` proves each row of the table, a refresh never touching another kind's job of the same key,
  and the finish with `again`; it runs in CI as today.
- The worker takes an optional failure hook per kind, called once on the 5th throw only; a hook that throws is logged and the run
  goes on.
- The migration is the newest on `main` (`node scripts/migration-order.ts`), and `supabase/database.types.ts` is regenerated.

**s2** (`law: BR-PRODUCT-6 · owner @pierrederval`) (`law: N-PRODUCT-4 · owner @pierrederval`)

`outbox-check.test.ts` proves both laws: if they broke, a risky change nobody explained would reach `main` unseen, and a pull
request could switch its own gate off. The test keeps proving them against the handler; the feature PR waits for a CODEOWNER
(@pierrederval or @dervalp) to approve it on GitHub.

**s2, s3, s4, s5** (`ui: yes`)
- Each check's body runs as a handler of its kind (`pr-outbox`, `pr-inbox`, `pr-approved`, `pr-budgets`), its steps in order in
  one try, and its failure handler is the kind's failure hook: `failure` with the reason (`skipped` on a pull request that is not a
  loop PR, nothing without the loop's config); for `budgets`, `neutral` saying why.
- Today's tests of that check pass against the handler on the fake GitHub, with the same verdicts; a repository without the loop's
  config ends `skipped` and posts nothing; GitHub's budget low is `waiting`.
- The Inngest function stays registered and calls the same body, so nothing changes until s7.

**s6** (`ui: yes`)
- The sweep posts a check due but not started for over 10 minutes as `queued`, summary `Delayed: Omni is retrying this check`, on
  the job's head commit, under that kind's check name; one due less is left alone; it never posts on a job of another kind.

**s7** (`ui: yes`) (`law: BR-PRODUCT-6 · owner @pierrederval`) (`law: N-PRODUCT-4 · owner @pierrederval`)

s7 removes the Inngest function `outbox-check.test.ts` drove; the test must still prove both laws through the job, or a pull request
could reach `main` past a gate that reads neither its changed files nor its base branch's rules.
- A pull-request event into the default branch refreshes one job of each of the four kinds before anything else is called, then
  runs the jobs due in `waitUntil`; a re-run asked from GitHub refreshes only that check's job; a database failure does not fail the
  delivery.
- Three events within 5 seconds run each check once on the latest head commit; an event while a check runs runs it once more.
- The server-event recheck and the approval label on a PRD's issue refresh the jobs of the pull requests they reach.
- `outbox-check`, `inbox-check`, `approved-check`, `approved-rerun` and `budgets-check` are no longer registered on Inngest, and
  `omni-loop/outbox.check.requested` (with the inbox, approved and budgets re-run events) is no longer sent.
- The App's README says the four checks run on the job ledger.
