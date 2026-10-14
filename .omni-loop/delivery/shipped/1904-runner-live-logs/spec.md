---
prd: 1904
title: Runners show live job logs
blocked-by: none
spec: file
phase0: server
---

# Runners show live job logs

**Date:** 2026-10-14 · **PRD:** #1904 · **After:** PRD 1830 (runners), bug 1883 (a dead job fails
at once) · **Touches:** `kit/lib/runner/` (`job.ts`, `runner.ts`, `log.ts`, `api.ts`, a new
`steps.ts`), `apps/galaxy/src/runners/` (contract, controller, service, repository, page),
`apps/galaxy/app/api/runners/jobs/[id]/lines/` (new route), `supabase/migrations/` (one table), the
`runners` draft screen and a new `runner-terminal` draft screen.
**Out of scope:** typing into a job from the page (a later PRD), showing claude's thinking or the
output of tool calls that succeeded, keeping a job's log after it leaves the Runners page, and
browser-side Supabase Realtime.

## Problem

A runner job (PRD 1830) runs `claude --dangerously-skip-permissions -p`, which prints nothing until
the run ends. Every 5 seconds the runner sends the last 200 lines (at most 16 KB) of a log that is
still empty, and the server overwrites `runner_jobs.log_tail` with it. For the whole run, often tens
of minutes, the Runners page shows "No log yet." under a closed `<details>` row: nobody can tell
whether the job is testing, editing, stuck, or about to open its pull request. When it ends, only
the last 200 lines survive, so the start of a long run is gone. The only way to watch is to SSH
into the machine and attach its tmux session.

## Solution

### 1. One readable line per step (the runner)

`omni runner job` starts `claude --dangerously-skip-permissions -p --output-format stream-json
--verbose`. claude then prints one JSON event per line as it works. A pure function,
`stepLine(event) → string[]` in `kit/lib/runner/steps.ts`, turns each event into readable lines,
each prefixed `hh:mm:ss ` (the runner's local time) and cut to 500 characters:

| event | line(s) |
|---|---|
| tool call `Bash` | `Bash: <the command's first line>` |
| tool call `Edit`, `MultiEdit`, `Write`, `NotebookEdit` | `Edit: <file path>` (`Write: <file path>` for `Write`) |
| tool call `Read`, `Grep`, `Glob` | `Read: <file path>`, `Grep: <pattern>`, `Glob: <pattern>` |
| tool call `Task` or `Agent` | `Agent: <its description>` |
| any other tool call | `<tool name>` |
| assistant text | `› <its first non-empty line>` |
| a tool result marked as an error | `✗ <its first line>`, then up to 20 more lines of its output, each indented two spaces |
| any `https://github.com/<owner>/<repo>/pull/<n>` in a tool result or assistant text, once per link | `PR: <link>` |
| the `result` event | `Done: ok · <n> turns · $<cost> · <duration>` (`Done: error · …` when it is an error), then the result text, every line of it |
| a stdout line that is not JSON, every stderr line, the `pnpm install` output | the line as is |
| any other event (system, thinking, a tool result that succeeded, an unknown type) | nothing |

The readable lines go to `~/logs/job-<id>.log`, as today, and to the tmux pane, so a person attached
to the session reads the same lines. The raw stream goes to `~/logs/job-<id>.jsonl` beside it and
never leaves the machine. `lastPullRequest` keeps reading the readable log, which holds every
`PR:` link.

### 2. Only the new lines are sent (runner to server)

Each line of a job's readable log has a sequence number, its 1-based line number in the file. The
runner keeps a cursor per job: the last sequence number the server accepted. On every 5-second tick
it sends the lines after the cursor in its existing report, `POST /api/runners/jobs/<id>`:

```json
{ "status": "running", "logTail": "<last 200 lines, as today>", "from": 1201, "lines": ["12:04:31 Bash: pnpm test", "…"] }
```

- One report carries at most 2,000 lines and 256 KB. More waiting goes in the next report, and the
  final report of `finish()` sends every line left, in as many reports as it takes.
- The cursor moves only when the server answers 2xx, so a failed report sends the same lines again.
- `logTail` stays, so the server can keep `runner_jobs.log_tail` as the row's preview.
- `JobUpdateSchema` gains `from` (a positive integer) and `lines` (strings of at most 600
  characters, at most 2,000), together or not at all.

### 3. The last 20,000 lines of each listed job (storage)

One new table in one migration, `public.runner_job_lines`:

| column | type | |
|---|---|---|
| `job_id` | uuid | references `runner_jobs (id) on delete cascade` |
| `workspace_id` | uuid | references `workspaces (id) on delete cascade`, for row-level security |
| `seq` | integer | `> 0` |
| `text` | text | `char_length(text) <= 600` |
| `at` | timestamptz | `default now()`, when the server received it |

Primary key `(job_id, seq)`. Read by the workspace's members under row-level security, written
only by the routes as the service role, as `runner_jobs` is.

- **Append:** `insert … on conflict (job_id, seq) do nothing`, so a report sent twice adds nothing.
- **Trim:** after an append, the job keeps its last 20,000 lines: rows with `seq <= max(seq) -
  20000` are deleted.
- **Retention:** when a job ends, the lines of the workspace's ended jobs beyond the 50 most recent
  (`ENDED_JOBS_SHOWN`, the jobs the Runners page lists) are deleted. A job no longer listed has no
  lines.
- A report that carries only `logTail` (a runner from before this PRD) updates `log_tail` and adds
  no line.

### 4. Reading the lines

`GET /api/runners/jobs/<id>/lines?after=<seq>` (browser, the signed-in member's session):

```json
{ "status": "running", "lines": [{ "seq": 1201, "text": "12:04:31 Bash: pnpm test" }], "more": false, "first": 1, "logTail": null }
```

- It answers at most 5,000 lines with `seq > after` (`after` defaults to 0), in order, and `more:
  true` when there are more.
- `first` is the smallest `seq` the job still holds, or `null` when it holds none.
- `logTail` is the job's `log_tail` only when it holds no line, and `null` otherwise.
- A job outside the caller's workspaces, or that does not exist, answers 404.

### 5. The Terminal panel (the Runners page)

- **A Terminal button on each job row** replaces today's `<details>` and its `<pre>` tail. It sits
  beside Cancel and Send again.
- **A Terminal button on each runner row** opens the job that runner is running, or the last job it
  ran when it is idle. With no job yet, it is disabled, titled "No job yet".
- **The panel** slides over the right side of the page (the whole width under 720 px):
  - Its header shows `job <short id> · <repo> · <runner>`, the job's status (a live dot while queued
    or running) and a close button.
  - Its body shows the lines in a monospace font on the terminal's dark background:
    - `✗` lines and their indented output read in the error colour;
    - each `PR:` link is a link that opens in a new tab;
    - `Done:` lines are bold.
- **Following:** the panel follows the newest line while its scroll is at the bottom. Scrolling up
  stops following and shows **Jump to latest**, which scrolls down and follows again.
- **The URL:** opening the panel sets `?terminal=<job id>` on the page's URL, so the link opens the
  page with the panel open. Escape or the close button closes it and removes the parameter. The
  page's own 5-second refresh leaves the panel open and its lines in place.
- **Loading and refreshing:**
  - On opening, it reads the lines from `after=0`, again while `more` is true.
  - While the job is queued or running and the tab is visible, it reads `after=<last seq>` every 5
    seconds, with the repository's `poll()`.
  - Once the job has ended, it reads once more, then stops: the whole kept log stays readable.
- **States:**
  - **Waiting:** "Waiting for the first line…" while running with no line yet.
  - **Old runner:** "Update this runner for live logs." with `omni update` to copy, above the
    `logTail`, when only a tail exists.
  - **Cleared:** "This job's log was cleared." when an ended job holds no line and no tail.
  - **Dropped:** "Earlier lines were dropped." above the first line, when `first > 1` (a job
    keeps its last 20,000).
  - **Reconnecting:** "Reconnecting…" in the header when a read fails; the lines stay and the next
    poll tries again.
- **Nothing to type:** the panel has no input. Sending commands is a later PRD.

## Decisions

- **New lines only, not the whole tail.** Re-sending a 20,000-line tail every 5 seconds would move
  about 2 MB per running job per tick. Each report carries only the lines after the cursor (asked:
  the person wants "the last 20K lines, refreshed quickly, like 5 seconds", not every log forever).
- **A lines table, not a growing text column or a Storage file.** The table is append-only, cheap to
  trim, and lets the panel read only what it lacks. A text column would move the whole log on every
  read and write. A Storage file appends awkwardly and needs a second read path. Approach A, approved
  in the design.
- **Retention follows the page.** A job's lines are kept while the Runners page lists it (the
  workspace's 50 most recent ended jobs, plus every queued and running job), then deleted (asked).
- **Polling, not Realtime.** Lines arrive every 5 seconds anyway. The panel uses `poll()`, as the
  Ask and dossier pages do, rather than a first browser-side `postgres_changes` subscription (approach
  B, rejected).
- **A panel over the page, linkable.** Not a page per job (asked). `?terminal=<job id>` makes it
  shareable.
- **The runner's Terminal opens its current job,** or its last when idle (assumed from "a Terminal
  button on each runner").
- **What a line shows.** Tool calls, file edits, assistant text, errors, PR links and the result.
  Not thinking, and not the output of tool calls that succeeded. The raw stream stays on the machine
  in `job-<id>.jsonl`.
- **The voice's objection, accepted.** persona:B-E DEv objected that one-line summaries hide the
  failing test, so they would still SSH in. A failed tool result now shows up to 20 lines of its
  output under its `✗` line.
- **`log_tail` stays.** It is the row's preview and the fallback for a runner from before this PRD,
  so a fleet updates its runners whenever it likes.
- **Design memory.** The `runners` screen is a draft: it is brought up to the Terminal buttons, and
  the panel becomes its own draft screen, `runner-terminal`. Neither is locked.
- **No proof video** (asked).

## User stories

- As a person who sent `/omni:yolo 1717` to a runner, I open its Terminal and see `Bash: pnpm test`
  appear while it runs, so I know it is working and on what.
- As a reviewer, I open the Terminal of a job that ended two hours ago and read every step it took,
  from the first line, up to its last 20,000.
- As a skeptical developer, when a job fails I read the failing command's output under its `✗` line
  without SSH-ing into the box.
- As a lead, I press Terminal on a runner and land on whatever it is doing now.
- As anyone, I paste the page's link with `?terminal=<job>` to a teammate, and the panel opens for
  them.

## Scope

**In:**
- the stream-json run and `stepLine`;
- the readable and raw log files;
- the cursor and the batched sends;
- the contract's `from` and `lines`;
- the `runner_job_lines` migration with its row-level security, trim and retention;
- the lines route;
- the Terminal buttons and panel;
- the `runners` draft brought up to date and the `runner-terminal` draft;
- the kit's runner docs (`omni help runner`), where they describe the log.

**Out:**
- typing into a job;
- thinking and successful tool output on the page;
- logs kept after a job leaves the page;
- Realtime in the browser;
- downloading a log;
- searching or filtering the log.

## Test seams

Tests live beside the code (`omni kb show testing`). None calls GitHub or Supabase.

- **`kit/lib/runner/steps.test.ts`:** `stepLine` over a recorded stream-json fixture
  (`kit/lib/runner/fixtures/stream.jsonl`):
  - one case per row of the table in **Solution 1**;
  - the 500-character cut;
  - the 20-line error output;
  - a PR link named once;
  - an unknown event giving nothing;
  - a line that is not JSON passed through.
- **`kit/lib/runner/job.test.ts`:**
  - the spawn arguments include `--output-format stream-json --verbose`;
  - readable lines reach the log and the pane;
  - the raw stream reaches `.jsonl`.
- **`kit/lib/runner/runner.test.ts`,** with its existing fake API:
  - only lines after the cursor are sent;
  - a failed report resends them;
  - more than 2,000 lines are split;
  - `finish()` flushes every line left;
  - `logTail` is still sent.
- **The contract and the service** (`apps/galaxy/src/runners/*.test.ts`), against the repository's
  fake:
  - `from` and `lines` come together or not at all, with the size limits;
  - an append sent twice adds nothing;
  - the 20,000-line trim;
  - deleting lines of ended jobs beyond 50;
  - an old `logTail`-only report;
  - `after` paging with `more` and `first`;
  - 404 outside the workspace.
- **The migration:** `supabase/checks/access.sql` gains rows for `runner_job_lines`: a member reads
  their workspace's lines, a non-member reads none, nobody but the service role writes.
- **The panel** (`apps/galaxy/src/runners/page/Terminal.test.tsx`):
  - following versus scrolled up, and Jump to latest;
  - polling stops once the job has ended;
  - `?terminal=` opens and closes it;
  - each state of **Solution 5**;
  - the runner button picking the running job, the last job, or disabled.

## Risks

**What a merge publishes:**
- **The migration.** It is applied to production by the `supabase` workflow. It only adds a table.
- **The kit.** Every runner that runs `omni update` gets the new `omni runner`.
- **The arcade.** The Runners page and the new route deploy with the release commit.

**Order:**
- The arcade and the migration deploy within minutes of the merge. The kit reaches a runner only
  when its owner updates it.
- An old runner against the new server keeps working, on `logTail` only.
- A new runner against an old server would be refused by the old `.strict()` contract. This lasts
  only between the merge and the arcade's deploy. The runner retries its report on the next tick,
  as it does today.

**Load:**
- A busy job writes a few hundred lines a minute, at most 20,000 rows per job, and 50 ended jobs
  per workspace.
- The panel reads only new lines, every 5 seconds, and only while it is open and the tab is
  visible.

**Rollback:**
- Revert the merge commit. The table stays, unused, until a later migration drops it.
- Runners already updated keep sending `from` and `lines`. The reverted contract refuses those
  reports, so such a runner must be put back with `omni update` to the previous version.
- Plan the revert with the fleet's owners.

**The locked laws.** `omni kb laws` printed the 20 below for the files this design changes. The
design keeps each as it stands. The lines are read only by workspace members, and no secret reaches
the browser (N-PRODUCT-17).

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
- N-PRODUCT-13: the install could overwrite a person's own settings without them knowing. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-14: a rule quietly loses its test, and the team only learns it when the server refuses the pull request. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-15: unreviewed work reaches every user, and nobody chose to ship it. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-16: scores and history could change after the fact, and players could no longer trust what they earned. Changing it needs @pierrederval to approve the pull request on GitHub.
- N-PRODUCT-17: anyone opening the arcade could read a key that controls the database or a paid service. Changing it needs @pierrederval to approve the pull request on GitHub.

## Acceptance criteria

1. **Steps appear as they happen.** A runner job running `/omni:yolo <n>` writes a line to its
   readable log within 5 seconds of claude starting a tool call. The Terminal panel shows that line
   within 10 seconds of the call.
2. **Each step reads as one line.**
   - A Bash call reads `hh:mm:ss Bash: <command>`.
   - An edit reads `hh:mm:ss Edit: <path>`.
   - A pull request the run opens reads `PR: <link>`.
   - The run's end reads `Done: ok · <n> turns · $<cost> · <duration>` followed by the result text.
3. **A failure shows its output.** A failed tool call's line starts with `✗` and is followed by at
   most 20 lines of its output.
4. **Only new lines are sent.** A report never re-sends a line the server already accepted, and
   carries at most 2,000 lines and 256 KB. After a failed report, the next one carries the same
   lines again, and no line is stored twice.
5. **Each job keeps its last 20,000 lines.**
   - A job holds at most its last 20,000 lines.
   - After a job ends, every listed job keeps its lines.
   - A job beyond the workspace's 50 most recent ended jobs holds none.
6. **Two Terminal buttons.**
   - Every job row has a Terminal button, which opens the panel on that job.
   - Every runner row has one. It opens the runner's running job, else its last job, and is disabled
     titled "No job yet" when it has run none.
7. **The panel follows the newest line.**
   - It follows new lines while scrolled to the bottom.
   - Scrolling up stops it and shows Jump to latest.
   - Pressing Jump to latest scrolls down and follows again.
8. **The panel can be linked.** Opening the page with `?terminal=<job id>` opens the panel on that
   job. Escape or the close button closes it and removes the parameter.
9. **An ended job keeps its whole log.** After the job ends, the panel stops polling and still shows
   every kept line, from the first.
10. **Old runners still work.** A runner from before this PRD still updates `log_tail`. Its job's
    panel shows that tail under "Update this runner for live logs."
11. **Only members can read.**
    - A non-member's read of a job's lines answers 404.
    - The access check shows members reading only their own workspace's lines, and only the service
      role writing.
12. **The panel is read-only.** It has no input of any kind.
