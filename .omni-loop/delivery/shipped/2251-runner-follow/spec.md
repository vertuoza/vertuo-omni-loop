---
prd: 2251
title: The terminal sends a PRD to a runner and follows it
blocked-by: none
spec: file
phase0: server
---

## Problem

A person brainstorms a PRD in their terminal, approves it on its page, and sends `/omni:yolo <n>` to
a runner with Send to terminal. From then on:

- **The terminal shows nothing.** No `omni` command sends a job or reads one: the job's live lines are
  readable from the browser alone. The session that wrote the PRD has nothing to watch.
- **The Runners page does not say which PRD a job builds.** A job row shows its line
  (`/omni:yolo 2223`), not the PRD's title or a link to its page.
- **Nothing says how many runner slots are free** without opening the Runners page.

## Solution

1. **`/omni:yolo-runner <n>`,** a new skill, the runner's twin of `/omni:yolo`:
   - It first looks for a job of PRD n in this repository that is queued or running (one sent from
     the page included) and follows it rather than sending a second one.
   - Otherwise it sends `/omni:yolo <n>`. With more than one runner online for this repository, it
     asks once where (in Claude: `AskUserQuestion`): **Any runner** first, then each fleet and each
     online runner, with its free slots (`nimbus-agents · 2 of 4 free`). Under `OMNI_UNATTENDED` it asks
     nothing and sends to any runner. With none online, it sends anyway and says the job waits in the
     queue.
   - Then it follows the job (below) until it ends, and hands off on the ending's next step:
     **Waiting on answers** → answer on the feature PR, then `/omni:yolo-fix <n>`; **Held** → what holds
     it, then `/omni:yolo-runner <n>`; **Ready** → review and merge the feature PR; **Failed** or
     **Runner lost** → the reason and the Runners page link.
2. **Two kit commands,** with the terminal's own sign-in:
   - `omni runner send '<line>' [--to <runner|fleet>]` queues a line through the route Send to terminal
     uses; it prints the job's id, and refuses a line no runner runs, as the page does.
   - `omni runner follow <n>` finds the PRD's newest job in this repository and prints one line per
     **milestone** until the job ends, then exits: `0` on done, `1` on failed, cancelled or runner lost.
     Ctrl-C stops the following only; the job runs on.
3. **The milestones,** each printed once, in order: `queued`; `claimed by <runner>`; `waiting for
   approval` (while the job's lines show `omni wait approval` waiting); each `PR: <link>` line the job
   writes; `<k>/<total> slices merged` when the board's count goes up; then the end: `Waiting on
   answers`, `Held`, `Ready` or `Done` (PRD 2223's outcome), `Failed: <reason>`, `Cancelled`, or `Runner
   lost`, with the PRD page link. Every 5 seconds it reads the job and its new lines.
4. **The server** opens three reads to the kit's sign-in, each for a member of the workspace only:
   - `GET /api/runners`: the workspace's runners, each with its name, fleet, state, slots used and
     slots, and repositories;
   - `GET /api/runners/jobs?repo=<owner/repo>&prd=<n>`: that PRD's jobs in that repository, newest
     first, with status, runner, PR link, outcome and times;
   - `GET /api/runners/jobs/<id>/lines?after=<seq>`, which today reads the browser's session only, also
     takes the kit's sign-in.
5. **The Runners page:** a job whose line names a PRD (`/omni:<skill> <n>`) of a dossier in its
   repository shows, under its line, `PRD <n>` linking the PRD's page, then ` · <title>` as plain text. A line naming no
   known PRD shows as today.
6. **The HUD band** (`omni now --json`, read by omni-hud):
   - a **runners** row, `runners 3/8 slots free`, only while at least one runner of the workspace is
     online for this repository (persona:B-E DEv's objection, accepted); hidden otherwise, and hidden
     when the read fails. The read is cached for 30 seconds.
   - while `omni runner follow` runs in this session, a **runner** row with its last milestone:
     `PRD 2223 on nimbus-agents · 1/2 slices merged`.
7. **The hand-offs:** where `/omni:brainstorm` and `/omni:yolo-fix` end on `/omni:yolo <n>`, the
   **What is next?** block adds one line above the command: "To build it on a runner instead:
   `/omni:yolo-runner <n>`." The last line stays `/omni:yolo <n>`.

## Conventions

| repo | layer | name | source |
| --- | --- | --- | --- |
| vertuo-omni-loop | skill | `/omni:yolo-runner` in `kit/plugin/skills/yolo-runner/SKILL.md` | no written convention: follows `/omni:yolo-fix` ← `kit/plugin/skills/yolo-fix/SKILL.md:1` |
| vertuo-omni-loop | CLI | `omni runner send`, `omni runner follow` | no written convention: follows `omni runner sender` ← `kit/bin/commands/runner.ts:224` |
| vertuo-omni-loop | route | `GET /api/runners`, `GET /api/runners/jobs?repo=&prd=` | no written convention: follows `apps/galaxy/src/runners/runners.controller.ts:14` |
| vertuo-omni-loop | kit module | `kit/lib/runner/follow.ts` (`milestones`) | no written convention: follows `kit/lib/runner/log.ts` |
| vertuo-omni-loop | HUD fields | `runners: { free, slots } \| null` and `runner: { line } \| null` on `HudNow` | no written convention: follows `HudWait` ← `kit/plugin-hud/types/index.d.ts:16` |

## Decisions

- **A dedicated skill, `/omni:yolo-runner`** (the person's choice), not a question at the end of the
  brainstorm: one name per place the build runs is less confusing.
- **Milestones, not the live log** (the person's choice): the full log stays on the Runners page.
- **Follow before send:** a job of the PRD already queued or running is followed, never doubled.
- **One PRD for the three parts** (the person's choice): the page's PRD, the terminal's send and
  follow, and the HUD share the same new reads.
- **The voice's objection** (persona:B-E DEv: a runners row on every terminal is noise) was
  **accepted**: the row shows only while a runner is online for this repository.
- **No migration:** a job's PRD is read from its line and its repository.

## User stories

- As the person who wrote a PRD, I run `/omni:yolo-runner 2223` and watch it build on the runner from
  my terminal, step by step, until it tells me what to do next.
- As someone who sent a PRD from its page, I run `/omni:yolo-runner 2223` and it follows that job
  instead of sending a second one.
- As a reviewer on the Runners page, I see which PRD each job builds and open it in one click.
- As anyone in a terminal, I see in the band how many runner slots are free.

## Scope

In: the skill, the two commands, the three reads, the Runners page PRD line, the two HUD rows, the
hand-off line.
Out: sending from the HUD; following several jobs at once; any change to what a runner runs or how
a job reports.

## Test seams

Read with `omni kb show testing`. Unit tests, no network:

- `milestones` (`kit/lib/runner/follow.test.ts`): each kind from a job and its lines; a PR line seen
  twice prints once; the board count only going up; each ending.
- `omni runner send` and `follow` (`kit/bin/commands/runner.test.ts`) against a fake page: the line
  refused, the job found by PRD, a running job followed rather than sent, exit codes, held lines.
- The routes (`runners.controller.test.ts`, `runners.service.test.ts`): the kit's sign-in accepted,
  another workspace's runners and jobs never read, the PRD filter.
- The Runners page (`model.test.ts`, `render.test.ts`): the PRD line and link; none for an unknown PRD.
- `omni now` (`kit/lib/now/now.test.ts`) and the band (`kit/plugin-hud/tests/hud.test.tsx`): the
  runners row shown and hidden, the runner row while following.
- `kit/test/plugin.test.ts`: the new skill's front matter, and the hand-off line in brainstorm and
  yolo-fix.

## Risks

- **New reads with the kit's sign-in:** each must read the caller's workspace only. Rolled back by
  removing the routes; the page is unchanged.
- **Polling:** a follow reads every 5 seconds and the HUD every 30 seconds (cached): small next to the
  runner's own reports.
- **Published by merging:** the Omni app on deploy, and the kit (skill, commands, HUD) on its next
  release.

The locked laws this touches: **BR-PRODUCT-63** (an agent link reads only repositories in its own
workspace) is read, never changed: the new reads answer a member of the job's workspace only. If
broken, an agent could read another team's private work. Changing it needs @pierrederval to approve
the pull request on GitHub. The other locked laws are untouched.

## Acceptance criteria

1. `/omni:yolo-runner <n>` with no job of PRD n sends `/omni:yolo <n>` (asking where when more than one
   runner is online) and follows it; with a queued or running job, it follows that job and sends none.
2. `omni runner follow <n>` prints each milestone once, in order, and exits `0` on done, `1` on failed,
   cancelled or runner lost; Ctrl-C leaves the job running.
3. A job ending on `Waiting on answers` hands off to answering, then `/omni:yolo-fix <n>`.
4. The three reads answer a member of the workspace with the kit's sign-in, and nobody else.
5. A Runners page job whose line names a known PRD shows `PRD <n>` (linking its page) and its title.
6. The band shows `runners <free>/<slots> slots free` only while a runner is online for this
   repository, and the runner row while a follow runs.
7. `/omni:brainstorm` and `/omni:yolo-fix` hand-offs name `/omni:yolo-runner <n>` above their last line.
