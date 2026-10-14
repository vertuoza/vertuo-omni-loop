# Plan: Runners show live job logs

PRD #1904. The spec is `spec.md` beside this plan. The feature branch `feat/runner-live-logs` goes
into `main` with `Closes #1904`; each slice is a sub-PR from `feat/runner-live-logs--<slice>` into
the feature branch, with `Part of #1904`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A runner job runs claude with stream-json and writes one readable line per step to its log and its tmux pane, and the raw stream to `job-<id>.jsonl` | `kit/lib/runner/steps` `kit/lib/runner/fixtures/` `kit/lib/runner/job.ts` `kit/lib/runner/job.test.ts` | — | 1 |
| s2 | The app stores a job's lines and serves them: `runner_job_lines` with its row-level security, trim and retention, `from` and `lines` in a runner's report, and `GET /api/runners/jobs/<id>/lines?after=<seq>` | `supabase/migrations/` `supabase/checks/runner_job_lines.sql` `supabase/database.types.ts` `apps/galaxy/src/runners/runners.*` `apps/galaxy/app/api/runners/jobs/` | — | 1 |
| s3 | The runner sends only the lines after its cursor in each report, in batches of at most 2,000 lines and 256 KB, resending after a failure and flushing in `finish()`; `omni help runner` says so | `kit/lib/runner/runner.ts` `kit/lib/runner/api.ts` `kit/lib/runner/log.` `kit/bin/commands/runner.` `kit/lib/help/entries.` | s2 | 2 |
| s4 | The Runners page has a Terminal button on each job and each runner, opening the read-only live panel with `?terminal=<job id>`, following, Jump to latest and every state of the spec | `apps/galaxy/src/runners/page/` `apps/galaxy/app/app/runners/` | s2 | 2 |

**Shared ground.** No prefix is declared by more than one slice. Some prefixes lie close together
without overlapping:

- `kit/lib/runner/`: s1 owns `steps*`, `fixtures/` and `job.ts`; s3 owns `runner.ts`, `api.ts` and
  `log.*`.
- `apps/galaxy/src/runners/`: s2 owns the area's `runners.*` files (contract, client, controller,
  service, repository and their tests), and s4 the `page/` folder.
- s4 reads the lines through `runners.client.ts`, which s2 writes. Its `blocked by` puts it in wave 2,
  after s2 merges.
- The new panel's tests live in `page/` (s4).
- No existing test reads files from two slices: `kit/bin/commands/runner.test.ts` drives the
  runner loop (s3), and the `apps/galaxy/src/runners/page/*.test.ts` files cover the page (s4).

`kit/dist/` and `apps/omni-app/api/` are generated: no slice commits them, and the wave rebuilds
them after merging.

One landing:
- The migration only adds a table, and `supabase` applies it on the merge, before the release
  commit deploys the arcade.
- A runner report that reaches the route before the table exists fails, and the runner resends the
  same lines on its next tick (s3).

## Per slice: done when

**s1**
- `kit/lib/runner/steps.ts` exports `stepLine(event)`. `kit/lib/runner/steps.test.ts` covers, over
  `kit/lib/runner/fixtures/stream.jsonl`:
  - every row of the spec's table in **Solution 1**, including the `hh:mm:ss ` prefix;
  - the 500-character cut;
  - a failed tool result with at most 20 indented lines of output;
  - a PR link named once;
  - the `Done: ok · <n> turns · $<cost> · <duration>` line followed by the result text;
  - an unknown event giving nothing;
  - a line that is not JSON passed through.
- `job.ts` spawns `claude --dangerously-skip-permissions -p --output-format stream-json --verbose`.
  - The readable lines go to `job-<id>.log` and the pane.
  - The raw stream goes to `job-<id>.jsonl`.
  - `pnpm install` output and stderr are written as they are.
  - `job.test.ts` proves it with a fake `claude` on the PATH.
- `lastPullRequest` still finds the PR in the readable log (an existing `log.test.ts` case keeps
  passing).

**s2** (`ui: yes`)
- One new migration, dated after the newest on `main`, adds `public.runner_job_lines`:
  - `job_id`, `workspace_id`, `seq`, `text`, `at`;
  - primary key `(job_id, seq)`, cascading with its job and its workspace;
  - `char_length(text) <= 600`;
  - members read under row-level security, and only the service role writes.
- `supabase/checks/runner_job_lines.sql` proves three things: a member reads their workspace's
  lines, a non-member reads none, and an authenticated user cannot insert.
- `JobUpdateSchema` accepts `from` and `lines` only together, at most 2,000 lines of at most 600
  characters each. `runners.contract.test.ts` proves the limits.
- The service and repository tests prove the storage rules:
  - an append sent twice stores each line once;
  - a job holds at most its last 20,000 lines;
  - when a job ends, the lines of ended jobs beyond the workspace's 50 most recent are deleted;
  - a report with only `logTail` updates `log_tail` and adds no line.
- `GET /api/runners/jobs/<id>/lines?after=<seq>` answers `status`, `lines` (at most 5,000, in
  order), `more`, `first` and `logTail` (only when the job holds no line). It answers 404 to a
  non-member and for an unknown job. `runners.controller.test.ts` proves each of these.
- `runners.client.ts` gains the read of that route, tested in `runners.client.test.ts`.

**s3**
- In `kit/bin/commands/runner.test.ts`, against its fake API:
  - a running job's reports carry `from` and the lines after the cursor, never one already
    accepted;
  - a report that fails is followed by one carrying the same lines;
  - 4,500 waiting lines go out in three reports of at most 2,000 lines and 256 KB;
  - `finish()` sends every line left before the final status;
  - each report still carries `logTail`.
- `omni help runner` describes the live log and the stream-json run. `kit/lib/help/entries.test.ts`
  passes.

**s4** (`ui: yes`)
- Each job row of `/app/runners` has a Terminal button, and the `<details>` tail is gone.
- Each runner row has a Terminal button. It opens its running job, else its last job, and is
  disabled and titled "No job yet" when the runner has run none.
- The panel matches the `runner-terminal` draft screen:
  - a header with the job, its repository, its runner, its status, a live dot while queued or
    running, and close;
  - monospace lines, with `✗` lines in the error colour, `PR:` links opening a new tab, and `Done:`
    in bold;
  - the whole width under 720 px.
- Opening the panel sets `?terminal=<job id>`, and a page loaded with it opens the panel. Escape and
  close remove the parameter, and the page's 5-second refresh keeps the panel and its lines.
- The panel reads from `after=0` while `more` is true. It then reads `after=<last seq>` every 5
  seconds with `poll()` while the job is queued or running and the tab is visible. Once the job
  ends, it reads once more and stops.
- It follows new lines at the bottom. Scrolled up, it stops following and shows Jump to latest, and
  pressing that follows again.
- These states show in the spec's words: waiting, old runner (with `omni update` to copy), cleared,
  dropped (`first > 1`) and reconnecting.
- The panel has no input.
- `apps/galaxy/src/runners/page/` tests prove each item above. The page's render test covers the
  buttons.
