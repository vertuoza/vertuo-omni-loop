---
prd: 2102
title: Runner machine health and token use, live on the Runners page
blocked-by: none
spec: file
phase0: server
---

# Runner machine health and token use, live on the Runners page

**Date:** 2026-10-16 · **PRD:** #2102 · **After:** PRD 1830 (runners), PRD 1894 (the Claude token
for jobs), PRD 1904 (live job logs) · **Touches:** `kit/lib/runner/` (`runner.ts`, `api.ts`, new
`health.ts` and `tokens.ts`), `kit/bin/commands/runner.ts` (three flags), `kit/lib/ask/context.ts`
(its usage sum, shared), `apps/galaxy/src/runners/` (contract, controller, service, repository,
page), `apps/galaxy/app/api/runners/[id]/health/` (new route), `supabase/migrations/` (one
migration), the `runners` draft screen.
**Out of scope:** the Claude plan's own usage limit (5-hour and weekly percentages, reachable only
through an undocumented endpoint), a cost in dollars, history beyond one hour, alerts by email or
phone, the machines that run `/omni:drive` without `omni runner`, and per-process figures.

## Problem

A runner (PRD 1830) is the machine the loop's agents run on: `omni runner` claims jobs, one per
slot, and each job runs `claude -p` in its own worktree and tmux session. Nothing tells anyone how
that machine is doing. A wave starts its own sub-agents inside a job, each with a `pnpm install` and
a test run, so a few slots can exhaust memory or disk. On a laptop, nine agents at once froze it
(the loop's cap of three agents came from that). The Runners page shows a runner as Online or Busy
right up to the moment it stops answering, and then as Offline, with no hint why. Whoever drives the
loop learns the machine is overloaded by SSHing into it, or after it fell over.

Token use is just as invisible. A job's tokens are in its Claude transcripts on the machine, and
only ask rounds sum them (`kit/lib/ask/context.ts`). Nobody can see what a job used, nor what the
machine burned in the last hours, without reading JSONL files by hand.

## Solution

### 1. The runner samples its machine (`kit/lib/runner/health.ts`)

Every 15 seconds, while it runs, the runner takes one sample:

| field | how it is read | unit |
|---|---|---|
| `cpu` | busy share of all cores since the previous sample, from the deltas of `os.cpus()` times | percent, 0–100 |
| `load1` | `os.loadavg()[0]` | — |
| `cores` | `os.availableParallelism()` | count |
| `memUsed`, `memTotal` | `os.totalmem()`; used = total − `MemAvailable` from `/proc/meminfo` on Linux, total − `os.freemem()` elsewhere | bytes |
| `diskFree`, `diskTotal` | `fs.statfs` on the folder that holds the jobs' worktrees (`~/wt`) | bytes |

The reads are injected, so `sample()` is a pure function of them and of the previous sample. A
field that cannot be read (no `/proc/meminfo` on a platform that needs it, `statfs` failing, the
first sample having no previous CPU times) is `null`.

### 2. A runner under pressure stops taking jobs

`pressure(sample, limits)` answers `null` or one reason, the first that holds, in this order:

| limit | default | flag | reason |
|---|---|---|---|
| memory used above | 85 % | `--max-memory <percent>` | `memory 91%` |
| disk free below | 10 GB | `--min-disk <GB>` | `disk 6 GB free` |
| 1-minute load above | 1.5 × cores | `--max-load <× cores>` | `load 14.2 on 8 cores` |

A `null` field never counts as pressure.

- **Paused:** as soon as a sample has a reason, the runner opens no new `next` poll. A slot already
  waiting on `next` keeps its hold, at most 40 s, and runs a job it gets. A running job is never
  touched.
- **Resumed:** after two samples in a row (30 s) with no reason, the free slots open their `next`
  polls again.
- **The terminal** prints one line on each change: `paused: memory 91%` and `resumed`.

### 3. The runner counts tokens (`kit/lib/runner/tokens.ts`)

Tokens are counted from Claude's transcripts, `~/.claude/projects/<folder>/**/*.jsonl`. The rule
is the one ask rounds already use, moved out of `kit/lib/ask/context.ts` so that both read the same
code: the sum of `message.usage` over assistant entries, each message id once, as
`{input, output, cacheRead, cacheWrite}`.

- **A job's tokens:** every transcript whose project folder is the job's worktree, or a folder
  below it. That includes the worktrees a wave's sub-agents run in, under the job's
  `.claude/worktrees/`. A neighbouring job's worktree that shares a prefix (`job-12` and `job-123`)
  is not below it.
- **The machine's tokens:** every transcript on the machine, in two windows: entries timestamped in
  the last 5 hours, and entries since midnight UTC.
- **Cost of reading:** a file is read again only when its size or modification time changed since
  the last count, and only the files modified within the window are opened.
- **When nothing can be read:** a count that cannot be read at all (no projects folder, a file
  refused) is `null`, never `0`.

### 4. The health report (runner to server)

On every sample the runner sends `POST /api/runners/<id>/health` with the kit's sign-in, as its
other routes:

```json
{ "cpu": 63.5, "load1": 7.9, "cores": 8, "memUsed": 13958643712, "memTotal": 17179869184,
  "diskFree": 41875931136, "diskTotal": 249821655040, "paused": null,
  "limits": { "maxMemory": 85, "minDiskGb": 10, "maxLoad": 1.5 },
  "tokens": { "last5h": { "input": 81234, "output": 402118, "cacheRead": 9120443, "cacheWrite": 611002 },
              "today": { "input": 120113, "output": 655001, "cacheRead": 14002118, "cacheWrite": 902114 } } }
```

- `HealthReportSchema` in `runners.contract.ts` is strict. Each number is non-negative or `null`.
  `paused` is a reason of at most 80 characters, or `null`. `limits` holds the three limits the
  runner pauses at.
- **What the route does:**
  - It sets `runners.health` (the report and the server's `at`) and `last_seen_at`.
  - It inserts one row in `runner_samples`.
  - It deletes that runner's samples older than one hour.
- **Refusals:** 400 a malformed report, 401 signed out, 403 another owner's runner, 404 no such
  runner, as the runners' routes refuse today.
- **A failed report:** a refusal or a timeout (5 s) prints one line on the runner. The runner keeps
  running, and its pause decision is unaffected: it is taken on the machine, not on the server.
- **A job's tokens:** each job report (`POST /api/runners/jobs/<id>`) also carries the job's
  tokens, as an optional `tokens` field (`JobUpdateSchema` gains it), stored in
  `runner_jobs.tokens`.
- **Only numbers leave the machine.** A path, a transcript's text or a model's output never does.

### 5. Storage (one migration)

- `runners.health jsonb null`: the last report, with `at`.
- `runner_jobs.tokens jsonb null`.
- A new table, `public.runner_samples`:
  - **Columns:** `runner_id` (references `runners (id) on delete cascade`), `workspace_id`
    (references `workspaces (id) on delete cascade`, for row-level security), `at timestamptz
    default now()`, `cpu real`, `mem_used bigint`, `mem_total bigint`, `disk_free bigint`,
    `tokens_5h bigint`.
  - **Primary key and index:** primary key `(runner_id, at)`.
  - **Access:** read by the workspace's members under row-level security, and written only by the
    routes as the service role, as `runner_jobs` is.
  - **Size:** at one sample per 15 s, a runner holds about 240 rows.

### 6. The Runners page shows it

Under each runner's row, a health line holds four gauges. Each gauge shows its value and a
sparkline of the last hour from `runner_samples`.

| gauge | value | the bar fills | warns at |
|---|---|---|---|
| CPU | `63%` and `load 7.9 / 8` | CPU percent | when the runner is paused for load |
| Memory | `13.0 of 16 GB` | used share | above 85 % |
| Disk | `39 GB free of 233` | used share | under 10 GB free |
| Tokens | `10.2M in 5 h · 15.7M today` | — (sparkline only) | — |

- **Thresholds:** the warn levels shown are the runner's own limits, sent with its report (`limits`
  in the report). A gauge past its limit reads in `--ask-red`, the colour a Failed job already uses: the reading
  tokens have no warning colour, and this PRD adds none.
- **Token totals:** a token figure is the sum of all four counts. Its title gives the split
  (`input 81k · output 402k · cache read 9.1M · cache write 611k`).
- **Paused:** a paused runner's state reads `Paused: memory 91%` in `--ask-red`, in place of
  Online or Busy. Paused is drawn from the last report; it is not a stored state.
- **A queued job** whose every possible runner is online and paused reads, under its status,
  `Waiting: vertuo-agents paused (memory 91%)` when it can go to one runner, or `Waiting: every
  runner paused (memory 91%)` when it can go to several, naming the first reason. A job some free
  runner could take shows nothing new.
- **A job's row** shows its tokens beside its status, `1.4M tokens`, once a report carried them.
- **Refresh:** the page keeps its 5-second refresh. Nothing else polls.

**The states of a health line:**

- **Live:** the gauges as above.
- **A field it could not read:** `—` in place of the value, with no bar.
- **Offline:** the last values greyed, under `as of 12 min ago`.
- **An old runner (no report ever):** `Update this runner to see its health.` with `omni update`
  to copy.
- **No sample yet in the hour:** the values with no sparkline.

## Decisions

- **Tokens counted from transcripts, not the plan's limit.** The person chose this. The Claude
  plan's 5-hour and weekly limits are reachable only through an undocumented endpoint that could
  break without warning. The transcripts are what ask rounds already read.
- **A health route of its own, every 15 seconds.** The person chose this over two alternatives:
  - Riding on `next`, which holds up to 40 s and would mix health with claiming.
  - A Supabase realtime channel, a second live mechanism next to the page's 5-second refresh, for
    no visible gain.
- **Fixed limits, changed with flags.** The person chose this over limits edited on the page. The
  pause is decided on the machine, so it holds when the server cannot be reached.
- **One hour of history.** The person chose this. About 240 rows per runner, trimmed on each
  insert, so no cron is needed.
- **The voice's objection, accepted.** The Lead Engineer (persona:Lead Engineer) would read a
  queued job under a quietly paused runner as a stuck loop. So a queued job says why it waits, not
  only the runner's row.
- **Two samples in a row to resume, one to pause.** Pausing at once protects the machine.
  Resuming after 30 s keeps one quiet sample from re-opening every slot while memory is still high.
  This is the most reversible choice, taken without asking: it is one constant.
- **A token figure is the sum of all four counts.** Cache reads dominate it, which the title's
  split makes visible. This is the most reversible choice, taken without asking: it is a display
  rule only.
- **Bytes on the wire, GB on the page.** The page divides by 1024³ and shows one decimal under
  100 GB.
- **The memory rule:** on Linux, `MemAvailable`, so the page cache does not count as used. That
  is the figure that predicts a freeze.
- **The `runners` draft screen** gains the health line and the queued reason. It is a draft, so it
  changes freely.

## User stories

- As the person who drives the loop, I open the Runners page on my phone and see that
  vertuo-agents is at 91 % memory and paused, so I know why my job waits, and I don't SSH in.
- As a runner's owner, I start `omni runner --max-memory 80` on a small machine, and it stops
  taking jobs before it swaps.
- As a PM, I see that `/omni:yolo 1717` used 14M tokens, and that the machine burned 40M today.
- As a lead engineer watching the board, I see `Waiting: every runner paused (disk 6 GB free)` on a
  queued job, and I know the loop is not stuck: a disk needs cleaning.

## Scope

**In:**
- Sampling, the pause and its flags, the token counts, the health route, and the job's tokens.
- The migration, and the health line and queued reason on the Runners page.
- The `runners` draft screen, and the kit README's runner section (the three flags).

**Out:** what the header lists.

## Test seams

Tests live beside the code (`omni kb show testing`). None calls the operating system, GitHub or
Supabase: the reads are injected, and transcripts are fixture files.

- **`kit/lib/runner/health.test.ts`, the sample:** `sample()` with injected `cpus`, `loadavg`,
  `meminfo`, `statfs`. It covers:
  - the CPU delta;
  - `MemAvailable` against `freemem`;
  - each unreadable field as `null`.
- **`kit/lib/runner/health.test.ts`, the pressure:** `pressure()` covers each limit alone, its
  exact edge (85 % does not pause, 85.1 % does), the order of reasons, and `null` never pausing.
  The resume rule is checked too: one quiet sample keeps it paused, two resume.
- **`kit/lib/runner/tokens.test.ts`:** fixture transcripts. It covers:
  - deduplication by message id;
  - a sub-agent's worktree below the job's counts;
  - `job-12` does not count `job-123`;
  - the 5-hour and midnight-UTC windows;
  - an unchanged file not read again;
  - an unreadable tree giving `null`.
- **The runner loop:** `runner.ts`'s loop with a fake clock and API. It covers:
  - a paused runner opening no new `next`;
  - a waiting slot keeping its hold;
  - a running job untouched;
  - a refused health report leaving the loop running.
- **`kit/bin/commands/runner.test.ts`:** the three flags, their defaults, and a bad value refused in
  plain words.
- **`apps/galaxy/src/runners/runners.contract.test.ts`:** `HealthReportSchema` valid and invalid,
  `JobUpdateSchema` with and without `tokens`, and an old runner's report still valid.
- **Controller and service tests:**
  - the route's 200, 400, 401, 403 and 404;
  - the snapshot and the sample written;
  - samples older than an hour deleted;
  - the job's tokens stored.
- **`runners.migration.test.ts`:** the columns, the table, its key and its row-level security.
- **Page model and render tests:** each gauge state, the warn colour past a limit, Paused, both
  queued-reason sentences, a job's tokens, offline greyed, and the old-runner line.
- **Mutation:** no file here is in the delivery core, so `pnpm mutation:changed` says so and exits.

## Risks

**What a merge publishes:**
- **The migration.** The `supabase` workflow applies it to production. It adds two nullable columns
  and one table.
- **The kit.** Every runner that runs `omni update` gets the sampling, the pause and the token
  counts.
- **The arcade.** The Runners page and the new route deploy with the release commit.

**Order:**
- **An old runner against the new server** sends no health and no tokens. Its row shows the
  old-runner line, and nothing else changes.
- **A new runner against an old server,** between the merge and the arcade's deploy:
  - The health route answers 404, and the runner prints one line per sample and carries on.
  - The old strict job contract refuses a report that carries `tokens`. So the runner sends
    `tokens` only once the health route has answered 2xx, and a job report it refused once is sent
    again without `tokens`.
- **The pause works with no server at all.**

**Load:**
- Each runner sends one small report every 15 s, and writes one row.
- The page reads at most 240 samples per runner on its 5-second refresh, and only while it is open.
- The runner re-reads only changed transcript files.

**A wrong pause:** a limit set too low keeps a runner from taking jobs. The page shows why, and
restarting it with another flag fixes it. Running jobs are never stopped.

**Rollback:**
- Revert the merge commit. The columns and the table stay, unused, until a later migration drops
  them.
- Updated runners get 404 on the health route and keep working, as above.

**The locked laws.** `omni kb laws` printed the 20 below for the files this design changes, and
the design keeps each one as it stands:
- The samples and the snapshot are read only by the runner's workspace members, under row-level
  security.
- Only numbers leave the machine.
- No secret reaches the browser (N-PRODUCT-17).

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

1. **The four figures every 15 seconds.** A runner started with `omni runner` sends its CPU,
   memory, disk and token counts every 15 seconds. Within 20 seconds, the Runners page shows them
   under its row, each with the last hour's sparkline.
2. **Pausing at the memory limit.** On a runner whose memory goes above 85 %, it opens no new
   `next` poll, and its row reads `Paused: memory <n>%` in `--ask-red`. Its running jobs
   keep running.
3. **Resuming.** After two samples in a row under every limit, the runner takes jobs again, and its
   row reads Online or Busy.
4. **The flags.** `omni runner --max-memory 70 --min-disk 20 --max-load 1` pauses at those limits.
   The page's warn levels follow them.
5. **Why a queued job waits.** A queued job whose every possible runner is paused reads `Waiting:
   <runner> paused (<reason>)`, or `Waiting: every runner paused (<reason>)`.
6. **A job's tokens.** A job's row shows the tokens its transcripts used, sub-agents included, once
   the runner reported them.
7. **The machine's tokens.** A runner's Tokens gauge shows the machine's tokens over the last 5
   hours and since midnight UTC, with the four-count split in its title.
8. **Offline.** A runner offline for more than 90 seconds shows its last figures greyed, under `as
   of <age>`.
9. **An old runner.** A runner from before this PRD shows `Update this runner to see its health.`
   and runs jobs as before.
10. **Only numbers leave the machine.** Only numbers leave the machine, and only the runner's
    workspace members can read them.
