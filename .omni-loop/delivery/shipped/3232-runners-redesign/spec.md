---
prd: 3232
title: "Runners page: running by default, Needs you, repositories drawer"
blocked-by: none
spec: file
phase0: server
proof: video
---

## Problem

The Runners page (`/app/runners`, the `runners` screen) lists every job in one table: queued and running
first, then the jobs waiting for an answer, then the last 50 that ended. On a busy day the few jobs that
are moving sit among rows of Cannot run, Failed and Done, and a person scrolls to find what runs now.
Worse, the jobs that wait on a person (Need human, Waiting on answers, Stopped mid-way) read as Done
rows in that same list, so they are easy to miss.

Each runner row lists its repositories inline, separated by dots, in mono type: a runner holding 17
repositories makes its row seven lines tall, and the full list is otherwise only in a `title`
tooltip a keyboard or touch user cannot reach. The page also says "Runners" twice (the page title, then
a section heading), and a runner's slots say how many are used but not who uses them.

## Solution

One page, the same data, read the same way (the board, every 5 s); no route, API or stored shape
changes.

**1. The jobs, by bucket.** Every job falls in exactly one bucket, a pure function of the job, the
board, the fleets and the answered ids (`jobBucket` in `model.ts`):

| bucket | the statuses it holds |
|---|---|
| Needs you | Need human, Waiting on answers, Held, Answered (with its Fix with answers button), Stopped mid-way, Lost 3 times |
| Running | Queued (with or without a Waiting line), Starting, Running, Lost · resuming, Answered · fixing |
| Cannot run | Cannot run, whatever its reason |
| Failed | Failed (its exit code or reason), Timeout, Runner lost with no resume |
| Done | Done, Ready, Answered · fixed, a bug fix's own end, Cancelled (by a person or an API key) |

**2. The filter.** Above the jobs table, a SegmentedControl with five tabs, each with its count:
**Running · Cannot run · Failed · Done · All**. Running is the default. The choice is kept in the URL as
`?jobs=running|cannot|failed|done|all`, read on the server as `?terminal=` and `?answer=` are, so a
filtered view survives the 5 s refresh, a reload and a shared link; any other value reads as Running.
Each tab is a link, so it works without script. The Cannot run and Failed counts read in `--ask-red`
with an icon when above zero. All lists every job, the Needs you jobs included, so its count is the
sum of the five buckets.

**3. Needs you.** A band between the runner cards and the filter lists the Needs you jobs, each with
its status, its line, its one action and its Terminal, whatever tab is open. With none, the band is not
drawn. The page's one primary action is chosen as today (Resume, then a job lost 3 times, then Fix with
answers, then Send again), among the jobs on screen only: the band, then the open tab.

**4. Empty tabs.** An empty Running tab reads **Nothing running.**, then the last job that ended
(`Last job: <status> · <line> · <age>`), then one link per other tab with a count above zero. Any other
empty tab reads **No job here.** with `Nothing here in the last 50.` under it.

**5. Cannot run, one fix each.** Beside Cancel, a Cannot run row offers the one action its reason
calls for:

| reason | action |
|---|---|
| `No runner holds <repo>`, `<runner> does not hold <repo>` | Copy `omni runner --name <name> --repos <dir>` |
| `No runner of <fleet> holds <repo>` | for a workspace owner, **Show fleet**: scrolls to and focuses the fleet picker of the first runner that holds the repository; nothing for anyone else |
| `The runner it was sent to is gone`, `Fleet <fleet> is gone` | **Send to any runner**: the same line and repository, sent to Any runner as the person who presses it; the old job keeps its Cancel |
| `Update the runner's kit` | Copy `omni update` |

**6. Repositories drawer.** A runner's repositories become one button, `<n> repositories`, followed by
`· <k> with jobs` when some of them have a job queued or running. It opens a Drawer, the same kind as
the Terminal and Need human drawers, set on the URL as `?repos=<runner name>` (an unknown name opens
nothing). The drawer holds the runner's name, `<n> repositories this runner holds`, a search field
that filters as one types, and the list: repositories with a job queued or running first, then A–Z.
Each repository shows its owner dimmed and its name, its running and queued counts (a Cannot run job
marked so), its last ended job among the last 50 (status, pull request, age, or `No job in the
last 50`), and the other runners that hold it (`Also on <runner>, <runner>`, or `Only on this
runner`). A line at the drawer's foot reads `Last job: among the last 50 only.` Esc,
the close button and a click outside close it and clear `?repos=`.

**7. The runner card.** Each runner is a card, in this order:
1. Its name, its fleet (picker or text, as today) and its Terminal; `Keeps … until …` under the name.
2. **Can it take work:** its state (Online, Busy, Offline with its age, `Paused: <reason>`), one pip per
   slot, filled when used, and `<used> of <slots> slot(s)`; a busy pip is titled with the fleet of the
   job using it, and the line under the pips names them: `Used by <fleet>, Any runner`. A job's fleet is
   the label of its `toFleet`, `Any runner` when it went to any runner, and the runner's name when it
   was sent to that runner.
3. Its account chips, then Tokens (`<n> in 5 h · <n> today`) with the hour's sparkline.
4. CPU, Memory and Disk, each with its bar, a tick at the runner's own limit (`health.limits`) when it
   has one, and its sparkline; a figure past its limit reads in `--ask-red` with an icon.
5. The repositories button, then the kit version, in `--ask-red` with `blocks <n> job(s)` only when a
   queued job reads `Update the runner's kit` and this runner could take it.

The states the screen file lists (offline grey with `as of`, `Update this runner to see its health.`,
Paused) keep their words.

**8. One title.** The page says Runners once, in its header, followed by a summary line:
`<n> runners · <k> online · <u> of <s> slots in use`. The section heading "Runners" goes.

**9. Not colour alone.** Every status drawn in `--ask-red` or `--ask-plasma` carries an icon beside its
words.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | ui | `jobBucket`, `bucketCounts`, `JOB_BUCKETS` | no written convention: follows `apps/galaxy/src/runners/page/model.ts` (`statusTone`, `cannotRunReason`) |
| vertuo-omni-loop | ui | `repositoryRows`, `slotFleets`, `kitBlocks` | no written convention: follows `apps/galaxy/src/runners/page/health.ts` (`gaugesOf`, `accountChips`) |
| vertuo-omni-loop | ui | `Repositories.tsx` (the drawer) | no written convention: follows `apps/galaxy/src/runners/page/NeedHuman.tsx` |
| vertuo-omni-loop | ui | `?jobs=`, `?repos=` | no written convention: follows `?terminal=` and `?answer=` in `apps/galaxy/app/app/runners/page.tsx` |

## Decisions

- **Bounded design**, approved in chat on 2026-11-24 by Pierre, from the mockup a UX-UI designer, a UX
  researcher and an AI engineer drew and reviewed together.
- **The objection** (`persona:F-E Developer`): "With Failed hidden by default, I'd miss that my job died
  until someone asks me why nothing shipped." Settled: none. Pierre approved the design as drawn; the
  red Failed count on its tab is the signal.
- **Fleet per slot, shown from what the board has.** Pierre asked to see which fleet uses each runner
  slot. A job carries `toFleet` only when it was sent to a fleet, so a job sent to Any runner reads
  `Any runner`. Storing the sender's fleet on every job is a later PRD (Pierre, 2026-11-24).
- **Show fleet, not Give runner to fleet.** For `No runner of <fleet> holds <repo>`, the action focuses
  the fleet picker instead of moving a runner to the fleet in one press: moving a runner changes where
  every other job goes, so the person picks it in the picker, which is reversible (most reversible
  option; never#2).
- **Send to any runner keeps the old job.** It sends a new job and leaves the old one queued with its
  Cancel: nothing is cancelled without a person's own press (BR-PRODUCT-136 holds the same spirit for a
  lost job).
- **Out of scope, for a later PRD** (the contract does not carry them): live slices merged on a running
  job, a usage % per account, a last-activity time and the current step.

## User stories

- As a person watching the runners, I open the page and see only what runs now, so I know at a glance
  whether the loop is moving.
- As a person a job waits on, I see every job that needs me above the list, whatever tab is open.
- As a person whose job cannot run, I get the one thing to do about it beside the reason.
- As a workspace owner, I read which repositories a runner holds, search them, and see which have work,
  without a seven-line row.
- As a lead engineer, I see which fleet uses each slot of a runner.

## Scope

In: `apps/galaxy/app/app/runners/page.tsx` (two URL parameters), `apps/galaxy/src/runners/page/`
(`RunnersPage.tsx`, `runners.css`, `model.ts`, `health.ts`, a new `Repositories.tsx`, `actions.tsx`
for Send to any runner and Show fleet), their tests, and the `runners` screen file and mockup in the
screen library.

Out: any route, API, contract or migration; the Terminal and Need human drawers themselves; the
missing signals listed in Decisions; storing a job's fleet.

## Test seams

- **Pure model tests** (`model.test.ts`, `health.test.ts`): `jobBucket` maps every status of the screen
  file to its one bucket (a table test, one row per status); `bucketCounts` sums to the number of jobs;
  `repositoryRows` sorts busy first then A–Z and filters by a search; `slotFleets` names `toFleet`'s
  label, `Any runner` or the runner's name; `kitBlocks` counts only the queued jobs this runner could
  take with the kit reason.
- **Render tests** (`render.test.ts` pattern, the demo board): the default page lists only Running jobs
  and the Needs you band; `?jobs=failed` lists only failed ones; the tab counts; the empty Running tab;
  the drawer opened by `?repos=`; "Runners" appears once.
- No test calls GitHub or the database (testing form).

## Risks

- **What a merge publishes:** the arcade's Vercel project (`apps/galaxy`) redeploys; no migration, no kit
  change. Rollback: revert the feature PR; nothing is stored, so nothing needs undoing.
- **A hidden job.** A job in a bucket nobody opens is missed: the counts on every tab and the Needs you
  band answer it, and the bucket table test makes every status land in exactly one bucket.
- **The primary action** moves to the band; on a tab with no candidate, the page has none, as the
  design form allows.
- **The Legal entries:** L-GDPR-1 (only workspace members read its logins): the drawer and the slot
  line show only what the page already shows its members. No other entry touched.
- **The locked laws: none touched.**
- **The business laws:** BL-ACCESS-1 (when a person leaves a workspace, every access they had through it ends at once): kept, the page reads only what the member's session allows and adds no access. BR-PRODUCT-136 (while a lost job's automatic resume exists, the page offers no
  action on it): kept, Lost · resuming sits in Running with no action. ADR-0095 (client → controller →
  service → repository) and ADR-0041 (imports name their extension): kept, the new code is in the
  page's ui layer.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: The page opens on what is running
  Given a board with running, queued, cannot run, failed and done jobs
  When a member opens the Runners page with no jobs filter
  Then the jobs table lists only the running, starting and queued jobs that can run
  And each tab shows its count, the Cannot run and Failed counts in red
```

### AC-2 · test

```gherkin
Scenario: The filter is kept in the address
  Given a board with two failed jobs
  When a member opens the Runners page with the filter set to failed
  Then the jobs table lists exactly the two failed jobs
  And the Failed tab is the selected one
```

### AC-3 · test

```gherkin
Scenario: Jobs that need a person are never hidden
  Given a board with a Need human job and a Stopped mid-way job
  When a member opens the Runners page on any tab
  Then the Needs you band lists both jobs with their actions
  And with no such job the band is not drawn
```

### AC-4 · test

```gherkin
Scenario: Every job lands in exactly one bucket
  Given one job for every status the runners screen lists
  When the page sorts them into buckets
  Then each job is in exactly one of Needs you, Running, Cannot run, Failed and Done
  And the All count equals the number of jobs
```

### AC-5 · test

```gherkin
Scenario: Nothing running says so and points elsewhere
  Given a board whose jobs have all ended, one of them failed
  When a member opens the Runners page
  Then the jobs area reads Nothing running with the last job that ended
  And it links to the Failed and Done tabs
```

### AC-6 · test

```gherkin
Scenario: A cannot run job offers its one fix
  Given a queued job whose repository no runner holds
  And a queued job whose runner needs a kit update
  When a member opens the Cannot run tab
  Then the first job offers to copy the runner command beside Cancel
  And the second offers to copy omni update beside Cancel
```

### AC-7 · test

```gherkin
Scenario: A runner's repositories open in a drawer
  Given a runner holding seventeen repositories, three with jobs
  When a member opens its repositories
  Then the card reads 17 repositories · 3 with jobs instead of the list
  And the drawer lists the three busy repositories first, then the others A to Z
  And typing in its search keeps only the repositories that match
```

### AC-8 · test

```gherkin
Scenario: The slots name the fleet using them
  Given a runner with two of three slots used, one by a job sent to fleet Cyan and one by a job sent to any runner
  When a member opens the Runners page
  Then its card reads 2 of 3 slots, used by Cyan and Any runner
```

### AC-9 · test

```gherkin
Scenario: The page says Runners once
  Given a workspace with runners
  When a member opens the Runners page
  Then the heading Runners appears once, with the count of runners, online runners and slots in use
```
