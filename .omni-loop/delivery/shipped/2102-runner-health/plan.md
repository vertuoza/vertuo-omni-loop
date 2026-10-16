# Plan: Runner machine health and token use, live on the Runners page

PRD #2102. The spec is `spec.md`, beside this plan. The feature branch `feat/runner-health` goes
into `main` with `Closes #2102`. Each slice is a sub-PR from `feat/runner-health--<slice>` into the
feature branch, with `Part of #2102`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | Every 15 s a runner samples its machine (CPU, load, cores, memory, disk) and sends `POST /api/runners/<id>/health`. The app stores the snapshot in `runners.health`, adds a row to `runner_samples` (its row-level security, its one-hour trim), and returns each runner's health and last hour of samples with the board. A refused or slow report never stops the runner. | `kit/lib/runner/health` `kit/lib/runner/runner.` `kit/lib/runner/api.` `supabase/migrations/` `supabase/checks/runner_` `supabase/database.types.ts` `apps/galaxy/src/runners/runners.` `apps/galaxy/app/api/runners/[id]/health/` | — | 1 | deep |
| s2 | A runner under pressure (memory above 85 %, disk free under 10 GB, load above 1.5 × cores) opens no new `next`, prints `paused: <reason>`, puts the reason in its report, and resumes after two quiet samples. Its running jobs are untouched. `--max-memory`, `--min-disk` and `--max-load` change the limits, which the report carries. The kit README's runner section names the flags. | `kit/lib/runner/health` `kit/lib/runner/runner.` `kit/bin/commands/runner.` `kit/README.md` | s1 | 2 | deep |
| s3 | The Runners page draws the health line under each runner: CPU, Memory, Disk and Tokens gauges with the hour's sparklines, `--ask-red` past the runner's limits, `Paused: <reason>` as the state, `—` for an unread figure, greyed `as of <age>` when offline, and the old-runner line. A queued job whose every possible runner is paused says why it waits. | `apps/galaxy/src/runners/page/` | s1 | 2 | build |
| s4 | Tokens are counted from Claude's transcripts: the ask rounds' usage sum is shared from `kit/lib/ask/context.ts`. Each job's report carries the tokens of its worktree and every folder below it, stored in `runner_jobs.tokens`. Each health report carries the machine's last 5 h and today. The page shows a job's tokens and fills the Tokens gauge with its split. | `kit/lib/runner/tokens` `kit/lib/ask/context.` `kit/lib/runner/runner.` `kit/lib/runner/api.` `supabase/migrations/` `supabase/checks/runner_` `supabase/database.types.ts` `apps/galaxy/src/runners/runners.` `apps/galaxy/src/runners/page/` | s2, s3 | 3 | build |

**Shared ground.** Several slices declare the same prefixes; the waves keep them apart:

- `kit/lib/runner/runner.` is declared by s1, s2 and s4, in waves 1, 2 and 3.
- `kit/lib/runner/health` is declared by s1 and s2, in waves 1 and 2.
- `kit/lib/runner/api.`, `supabase/migrations/`, `supabase/checks/runner_`,
  `supabase/database.types.ts` and `apps/galaxy/src/runners/runners.` are declared by s1 and s4, in
  waves 1 and 3.
- `apps/galaxy/src/runners/page/` is declared by s3 and s4, in waves 2 and 3. It holds the page's
  render and model tests that both change.
- s2 and s3 share no ground, so they run side by side in wave 2.
- `kit/dist/` is generated: no slice commits it.

## Per slice: done when

### s1 (deep: a new route, a migration with row-level security, and the runner's loop)

- **The sampler.** `sample()` in `kit/lib/runner/health.ts` turns injected `cpus`, `loadavg`,
  `meminfo` and `statfs` reads into `{cpu, load1, cores, memUsed, memTotal, diskFree, diskTotal}`.
  - CPU is computed from the delta with the previous sample.
  - On Linux, memory used is total − `MemAvailable`.
  - Each field it cannot read is `null`.
- **The report.** The runner's loop sends `POST /api/runners/<id>/health` every 15 s, with a 5 s
  limit. A refusal or a timeout prints one line, and the loop runs on (a fake-clock test proves
  it).
- **The contract.** `HealthReportSchema` is strict. Its tests cover valid reports, invalid
  numbers, an unknown field, and `paused` and `limits` as optional.
- **The route.** It answers 200, 400, 401, 403 (another owner's runner) and 404. A 200:
  - sets `runners.health` (with the server's `at`) and `last_seen_at`;
  - inserts one `runner_samples` row;
  - deletes that runner's samples older than one hour.
- **The migration.** It adds `runners.health` and the `runner_samples` table, with primary key
  `(runner_id, at)`. Workspace members read it under row-level security, and only the service role
  writes it. The migration test proves each of these.
- **The board.** It carries each runner's `health` (or `null`) and its samples of the last hour,
  oldest first.

### s2 (deep: the pause decides when a machine claims work)

- **The pressure rule.** `pressure(sample, limits)` answers `null` or the first reason, in the
  order memory, disk, load: `memory 91%`, `disk 6 GB free`, `load 14.2 on 8 cores`.
  - 85 % does not pause, 85.1 % does.
  - A `null` field never pauses.
- **Paused.** While paused, a fake-clock loop test proves that:
  - no free slot opens `next`;
  - a slot already waiting keeps its hold and runs the job it gets;
  - a running job is never touched.
- **Resuming.** One quiet sample keeps the runner paused, and two in a row resume it. The terminal
  prints `paused: <reason>` and `resumed` once per change.
- **The report.** It carries `paused` and `limits`.
- **The flags.**
  - `omni runner --max-memory 70 --min-disk 20 --max-load 1` pauses at those limits.
  - Leaving them out gives 85, 10 and 1.5.
  - A value out of range (memory outside 1–100, a negative disk, a load of 0 or less) is refused in
    plain words before the runner registers.
- **The README.** The kit README's runner section names the three flags and what pausing does.

### s3 (`ui: yes`)

- **The health line.** Under each runner's row, four gauges as the spec's table says, each with an
  SVG sparkline of the hour's samples.
  - A gauge past the runner's own `limits` reads in `--ask-red`.
  - Tokens reads `—` until s4 fills it.
- **The states.** Each state of the spec's §6 renders, with a model and a render test for each:
  - live;
  - a field it could not read, as `—` with no bar;
  - offline, greyed under `as of <age>`;
  - an old runner, as `Update this runner to see its health.` with `omni update` to copy;
  - no sample in the hour, with no sparkline.
- **Paused.** A runner whose last report has `paused` reads `Paused: <reason>` in `--ask-red`, in
  place of Online or Busy. Offline still wins.
- **Why a queued job waits.** A queued job whose every possible runner (any, its fleet's, or its
  one runner) is online and paused reads one of:
  - `Waiting: <runner> paused (<reason>)`, when it can go to one runner;
  - `Waiting: every runner paused (<reason>)`, when it can go to several.

  A job that some unpaused online runner could take shows nothing new.
- **The draft screen.** The page matches the `runners` draft screen's mockup, and the word pass on
  it finds nothing.

### s4

- **The shared usage sum.** `kit/lib/ask/context.ts` and `kit/lib/runner/tokens.ts` use one
  function, the usage sum. The ask round tests pass unchanged.
- **The tokens tests**, in `tokens.test.ts`, on fixture transcripts, prove that:
  - a message id is counted once;
  - a sub-agent's worktree below the job's counts;
  - `job-12` does not count `job-123`;
  - the 5 h and midnight-UTC windows hold;
  - an unchanged file is not read again;
  - an unreadable tree gives `null`.
- **The job report.** It carries `tokens`, which the app stores in `runner_jobs.tokens`; a
  migration adds the column. A report that a server refuses for `tokens` is sent again without
  them, as the spec's Risks say.
- **The health report.** It carries `tokens.last5h` and `tokens.today`. Each sample stores
  `tokens_5h`.
- **The page.**
  - A job's row shows `<n> tokens` beside its status once a report carried them.
  - The Tokens gauge shows `<n> in 5 h · <n> today`, with the four-count split in its title, and its
    sparkline from `tokens_5h`.
