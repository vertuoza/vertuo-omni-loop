# Settled outbox items — PRD 1830

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-runners-check-in-ci -->

## s1-01-runners-check-in-ci — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-runners-check-in-ci
prd: 1830
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The new database check for runners must run on every pull request, but the file that lists those checks was not in this slice's ground. Should this slice add its step there?

## The decision, in plain words

I added one step to that list so the new check runs on every pull request, as the repository's rules ask for each new database check.

## The intro, for fun

A check that never runs is a smoke alarm with no battery.

## The punchline, for fun

So the battery went in, one aisle over from where the plan said to shop.

## The options, in plain words

A. Keep the step in the workflow, so the check runs on every pull request
B. Remove the step and leave the check file unused until a later change wires it in

## What I had to decide

Whether the runners' database check runs in the continuous integration list, added by this slice although that list sits outside its planned ground.

## What I did meanwhile

Added one step, `Who may read and write the runners, and how a runner claims a job`, to the supabase workflow's check job, after the outbox items step. No other line of that file changed.

## What it costs to change later

A constant: removing the step is deleting seven lines; keeping it costs nothing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s1 named supabase/checks/ but not the workflow that runs each check (author).

```

<!-- /omni-outbox-settled: s1-01-runners-check-in-ci -->

<!-- omni-outbox-settled: s1-02-runner-workspace-from-repos -->

## s1-02-runner-workspace-from-repos — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-runner-workspace-from-repos
prd: 1830
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

A person can belong to several workspaces, and a runner does not say which one it joins. Which workspace does a new runner register in?

## The decision, in plain words

A runner joins the workspace its repositories belong to for the person who starts it. All its repositories must belong to that one workspace, and a runner's name stays with the person who first registered it.

## The intro, for fun

A runner walks into a building with three front doors.

## The punchline, for fun

It takes the one its repositories have the keys to.

## The options, in plain words

A. The workspace its repositories belong to, all in one workspace; a name is its first owner's
B. Add a workspace field to register, defaulting to the person's first workspace
C. One runner may serve repositories of several workspaces, one row per workspace

## What I had to decide

How register picks the runner's workspace, and who may register a name again.

## What I did meanwhile

register asks repo_workspace() for each repository (lower-cased, duplicates dropped) and refuses with 403 when one is outside the caller's workspaces or when two land in different workspaces. A name already registered by another person in that workspace is refused with 403; the same person registering again updates slots, repositories, version and the check-in.

## What it costs to change later

A constant: a later change could add a `workspace` field to the register body, which the contract refuses today, without touching stored rows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the runner registers with the Omni app but not how the workspace is chosen (author).

```

<!-- /omni-outbox-settled: s1-02-runner-workspace-from-repos -->

<!-- omni-outbox-settled: s1-03-ended-job-report-refused -->

## s1-03-ended-job-report-refused — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-ended-job-report-refused
prd: 1830
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

A runner may report on a job that already ended, for example one marked lost while the runner was silent. What should the app answer?

## The decision, in plain words

The app refuses the report with a conflict, saying the job has ended and why, and the runner is expected to stop that run. A runner coming back from silence finds its own jobs marked lost before its return counts.

## The intro, for fun

A runner comes back from a long coffee and says it is still on it.

## The punchline, for fun

The app says the job was handed in as lost, please put the pen down.

## The options, in plain words

A. Refuse with 409 and the reason; the runner stops the run
B. Answer 200 with cancel true, so the runner kills the run as for a cancel
C. Accept the late report and overwrite the lost status

## What I had to decide

The answer to a report on an ended job, and the order of the lost-runner sweep and the caller's own check-in.

## What I did meanwhile

POST /api/runners/jobs/<id> answers 409 {error: 'This job has ended: <status>[, <reason>]. Stop it.'} for a done, failed or cancelled job, and for a status that goes back. Each next and job update runs runners_mark_lost() before it records the caller's check-in, so a runner silent over 90 s loses its own claimed and running jobs on its next call, as the spec's 'on the next next' reads. s2's runner should treat a 409 on a report as a stop.

## What it costs to change later

A constant on both sides: the status code and the order of two calls in the service, and the matching branch in the runner.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names status updates after cancel and after runner lost as cases to test, not the answer (author).

```

<!-- /omni-outbox-settled: s1-03-ended-job-report-refused -->

<!-- omni-outbox-settled: s1-04-runners-page-read-no-route -->

## s1-04-runners-page-read-no-route — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-04-runners-page-read-no-route
prd: 1830
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The Runners page needs the runners and jobs, but the spec lists six routes and none of them reads that list. How does the page read it?

## The decision, in plain words

I kept to the six routes. The page's read is a function the page's server code calls directly, which marks lost jobs first, as the spec asks of each page read.

## The intro, for fun

Six doors were drawn on the plan, and the page needed a window.

## The punchline, for fun

So the page reads from inside the house instead.

## The options, in plain words

A. A server-side read the page calls, no seventh route
B. Add a seventh route that lists the runners and jobs, for the page to ask every few seconds

## What I had to decide

Whether the Runners page reads through a seventh route or through a server-side read.

## What I did meanwhile

runners.service.ts has board(viewer, workspace): the workspace's runners with their state, its queued and running jobs then the last 50 ended, and the viewer's owner flag and fleet, a member only. The page's server code reaches it as runnersDeps().service, from runners.live.ts. No GET /api/runners route was added; the page's 5-second refresh re-renders the server page (s3's choice).

## What it costs to change later

A constant: adding a GET route later is one controller function and one route file over the same service call.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the page reads its rows every 5 seconds but names no route for it (author).

```

<!-- /omni-outbox-settled: s1-04-runners-page-read-no-route -->

<!-- omni-outbox-settled: s1-05-job-times-four-columns -->

## s1-05-job-times-four-columns — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-05-job-times-four-columns
prd: 1830
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

A job can end three ways, done, failed or cancelled, and the spec asks for a time per status. Does each ending need its own time?

## The decision, in plain words

A job keeps four times: when it was queued, claimed, started running and ended. The status says how it ended, so the three endings share one time.

## The intro, for fun

Three ways to finish a race, and one finish line.

## The punchline, for fun

The scoreboard says how you crossed it.

## The options, in plain words

A. Four times: queued, claimed, running, ended
B. Six times, one per status

## What I had to decide

The time columns of runner_jobs.

## What I did meanwhile

runner_jobs has queued_at, claimed_at, running_at and ended_at; a check ties ended_at to the three ended statuses. The browser's Job shape carries queuedAt, claimedAt, runningAt and endedAt.

## What it costs to change later

A migration: splitting ended_at into done_at, failed_at and cancelled_at later is new columns and a backfill from the status.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's 'a time per status' does not say whether the three endings are separate (author).

```

<!-- /omni-outbox-settled: s1-05-job-times-four-columns -->

<!-- omni-outbox-settled: s2-01-runner-wire-shapes -->

## s2-01-runner-wire-shapes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-runner-wire-shapes
prd: 1830
slice: s2
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The terminal side and the web side of runners were built at the same time, so the exact words they use to talk to each other were not settled anywhere. Which words should they share?

## The decision, in plain words

The terminal side uses the words of the spec's data section: a job comes with its number, its line, its repository and who sent it, and the terminal reports back a status, the log's end, the pull request link, the exit code and a reason.

## The intro, for fun

Two teams built the two ends of one bridge on the same afternoon.

## The punchline, for fun

They agreed on the river, and mostly on the bolts.

## The options, in plain words

A. A. Keep the spec's field names on both sides, and align the route's contract to them when the wave merges.
B. B. Rename the runner's fields to whatever the route's contract chose.
C. C. Share one contract module between the kit and the app.

## What I had to decide

The names and shapes of what the runner sends to, and reads from, the six runner routes, written before the routes existed.

## What I did meanwhile

kit/lib/runner/api.ts reads and writes the spec's field names: register sends {name, slots, repos, version} and reads {id}; next is GET /api/runners/next?runner=<id>, a 204 for none, else {id, line, repo, sent_by}; a job update POSTs {status, log_tail, pr_url, exit_code, reason} to /api/runners/jobs/<id> and reads {cancel}. The runner reports running every 5 s and its last status once.

## What it costs to change later

A field renamed on either side is a one-line change in the runner's schema or the route's contract, plus its test, before the feature merges.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) s1's contract was not pushed when this slice was built, so the two sides were not compared; the wave's merge should check them together.
- (author) A runner whose every slot is busy keeps no next call open; unless the job updates also count as a check-in on the server, it would read as offline and its jobs as lost after 90 s.

```

<!-- /omni-outbox-settled: s2-01-runner-wire-shapes -->

<!-- omni-outbox-settled: s2-03-runner-start-checks -->

## s2-03-runner-start-checks — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-13
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-13
- Slice: s2
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-runner-start-checks
prd: 1830
slice: s2
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The spec says how a runner signs in but not which Omni page it talks to, nor how it tells that Claude is signed in. How should it find both?

## The decision, in plain words

The runner talks to the page named in the settings of the folder it starts in, else of the first repository it holds. It asks Claude whether it is signed in, and also refuses to start without the terminal tool every job runs in.

## The intro, for fun

A new courier asked which depot to report to.

## The punchline, for fun

We said: the one on the first parcel's label.

## The options, in plain words

A. A. The page from the settings here or of the first repository held, with claude and tmux checked before registering.
B. B. A required --url flag naming the Omni page.
C. C. Check the sign-in by running a one-word prompt through claude.

## What I had to decide

Where omni runner reads ask.url, and how it checks that claude is installed and signed in before it registers.

## What I did meanwhile

ask.url comes from the config of the folder omni runner runs in, else of the first checkout under --repos that sets one; none, it refuses in one line. claude --version checks it is installed, claude auth status (exit 0 and no "loggedIn": false) that it is signed in, and tmux -V that tmux is there; each missing tool is one line and no registration.

## What it costs to change later

A --url flag, or another check, is a few lines in kit/bin/commands/runner.ts and kit/lib/runner/terminal.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) claude auth status was not run on this machine: the check relies on it exiting non-zero, or printing loggedIn false, when Claude Code is signed out; to be checked by hand on the agent server.

```

<!-- /omni-outbox-settled: s2-03-runner-start-checks -->
