---
prd: 1830
title: Runners — send work from the Omni app to a terminal
blocked-by: none
spec: file
phase0: server
---

# Runners — send work from the Omni app to a terminal

**Date:** 2026-10-13 · **PRD:** #1830 · **After:** PRD 426 (the stage's Copy button), PRD 1628 and
PRD 1660 (kit tokens and the device sign-in), PRD 1139 (the Loop page), ADR-0095 (the galaxy's
layering) · **Touches:** `supabase/migrations/` (two tables), `apps/galaxy/src/runners/` and
`apps/galaxy/app/api/runners/` (new), `apps/galaxy/app/app/runners/` (new page), the copy buttons of
`apps/galaxy/src/dossier/page/`, `apps/galaxy/src/nav/sidebar.ts`, `kit/bin/commands/runner.ts` and
`kit/lib/runner/` (new), `/omni:pr`'s body, the kit README.
**Out of scope:** restarting a runner on reboot (a systemd unit, in the infrastructure repository),
alerts when a job fails or a runner goes offline, one GitHub or Claude identity per runner or per
pod, conversational skills (`/omni:brainstorm`, `/omni:think-big`), `/omni:drive`, and automatic retries.

## Problem

Every command the Omni app gives a person ends as a line to copy (`/omni:yolo 1717`, `/omni:pr-care
1801`) into a terminal they have open. Work starts only when someone sits at a computer with
Claude Code, the repository and its sign-ins. A server set up for agents (the first one,
`vertuo-agents`, is a Hetzner box reachable over Tailscale only) can run that line headless today,
but only over SSH, by hand: `ssh agent@vertuo-agents yolo 1717`.

Nothing carries a command from the app to a terminal. Terminals push their status (`working_pings`,
keyed by Claude session, not by machine) and poll for answers (`/api/ask/rounds/<id>/wait`) and
approvals; the app never sends them work. A pod cannot say "this server is ours", and the app
cannot show which servers are up, what they are running, or where a run ended.

## Solution

A **runner** is a machine running `omni runner`. It registers with the Omni app, shows live on a
new **Runners** page, and takes **jobs** from an inbox. A job is one `/omni:` line the app already
lets a person copy, sent with **Send to terminal** instead.

### Words

| word | meaning |
|---|---|
| runner | one machine running `omni runner`, signed in with a kit token, with a name, a number of slots and the repositories it holds |
| pod | a team of the workspace; the app calls it a **fleet** (`public.teams`), and every player belongs to one |
| job | one `/omni:` line for one repository, sent to a pod, to one runner, or to any runner |
| slot | one job a runner may run at once |

### Data

Two tables, in one migration, read by workspace members under row-level security and written only
by the routes (service role):

- **`runners`:** `id`, `workspace_id`, `owner` (the person whose kit token registered it), `name`
  (unique in the workspace), `fleet` (nullable: none is a shared runner), `slots` (1–8),
  `repos text[]` (`owner/name`), `version`, `last_seen_at`, `created_at`. A runner is **online**
  when `last_seen_at` is under 90 seconds old, **busy** when every slot holds a job, otherwise
  **offline**.
- **`runner_jobs`:** `id`, `workspace_id`, `line`, `repo`, `to_runner` (nullable), `to_fleet`
  (nullable), `sent_by`, `status` (`queued`, `claimed`, `running`, `done`, `failed`,
  `cancelled`), `runner_id`, `cancel_requested`, `log_tail` (the last 200 lines, at most 16 KB),
  `pr_url`, `exit_code`, `reason`, and a time per status. At most one of `to_runner` and
  `to_fleet` is set; neither means any runner of the workspace.

### The routes

Under `apps/galaxy/app/api/runners/`, in ADR-0095's roles (`runners.contract.ts`,
`runners.controller.ts`, `runners.service.ts`, `runners.repository.ts`). The runner's routes take
the kit's sign-in (`OMNI_TOKEN` traded as today); the browser's take the session.

| route | caller | does |
|---|---|---|
| `POST /api/runners/register` | runner | creates or updates the runner by name: slots, repos, version; answers its id |
| `GET /api/runners/next?runner=<id>` | runner | counts as a check-in, then holds up to 50 s; answers the job it claimed, or 204 |
| `POST /api/runners/jobs/<id>` | runner | status, log tail, PR link, exit code; answers `{cancel: true}` when a cancel waits |
| `POST /api/runners/jobs` | browser | queues a job: line, repo, target |
| `POST /api/runners/jobs/<id>/cancel` | browser | the sender or a workspace owner |
| `PATCH /api/runners/<id>` | browser | a workspace owner sets or clears its fleet |

**Claiming** happens in one statement (`for update skip locked`), so two runners never take the
same job. A runner takes the oldest queued job it may run while it has a free slot:

- addressed to it, to its fleet, or, for a runner with no fleet only, to any runner;
- for a repository in its `repos`.

**A lost runner:** each `next`, each job update and each read of the Runners page first marks the
claimed or running jobs of a runner silent for over 90 s as `failed`, reason `runner lost`. No job
is retried by itself: a run cut short may already have pushed a branch.

### Who may send

- **The line** must read `/omni:<skill> <args>`. The skill must be one of `yolo`, `yolo-fix`,
  `pr-care`, `do-work`, `wave`, `bug-fix`, `visual-fix`, `plan`, `pitch` or `prove`: the ones the app copies that
  run without a person typing and end on their own. `/omni:drive` never ends, so it waits for the
  loop's own PRD. The arguments must be letters, digits,
  spaces and `._/:#-` only, 200 characters at most. The route checks it, and the runner checks it
  again before running.
- **The target:**
  - Any workspace member may send to a runner with no fleet, or to any runner.
  - Only that fleet's players and the workspace's owners may send to a fleet, or to a runner in
    one.
- **The repository** must be the workspace's (`repo_workspace`).

### Send to terminal

Every button that copies an `/omni:` line (`StageHeaderCopy` on a PRD's page, and the panes that
copy one) gains **Send to terminal** beside it. The button shows when the line's skill is on the
list and the workspace has at least one runner the viewer may send to.

It opens a small picker:

- **Any runner**, then each fleet with a runner, then each runner by name, with its state.
- **Send** is the one primary action.

Once sent, it says `Queued for <target>` with a link to the job on the Runners page.

### The Runners page

`/app/runners`, an entry of the sidebar's Dashboard group beside Loop.

- **Runners:** one row per runner, showing:
  - its name and its state (online, busy, offline, with when it was last seen);
  - its fleet, which an owner can change in place;
  - slots used out of slots, its repositories and the kit version.
- **Jobs:** queued and running first, then the last 50 that ended. Each job shows its line, its
  repository, who sent it, where it went, its status and its times.
  - Opening a job shows its log tail and its PR link.
  - A queued or running job has **Cancel**.
  - A failed or cancelled job has **Send again**.
- **No runner yet:** the page says how to start one, with the command to copy.

The page reads its rows again every 5 seconds while it is open.

### `omni runner`

`omni runner --name <name> --repos <dir> [--slots 4] [--timeout 3h]`, in the kit
(`kit/bin/commands/runner.ts`, `kit/lib/runner/`):

- **Start:**
  - It reads the kit token the way every kit command does.
  - It lists the git checkouts under `--repos` by their `origin` (`owner/name`).
  - It checks that `claude` is installed and signed in.
  - It registers, then keeps one `next` open per free slot.
- **Each job:**
  - It checks the line again.
  - It runs `git fetch`, then adds a worktree `~/wt/<repo>-job-<id>` on branch `agent/job-<id>`
    from the default branch (`--no-track`).
  - It runs `pnpm install --frozen-lockfile` when there is a lockfile.
  - It then starts `claude --dangerously-skip-permissions -p` with the line, from a file, never
    through a shell. The run happens in a tmux session named `job-<id>`, so a person can attach to
    it over SSH, and its output goes to `~/logs/job-<id>.log`.
  - Every 5 seconds it sends the log tail and reads whether a cancel waits.
  - At the end it reports `done`, with the last pull request URL of the job's repository found in
    the log, or `failed` with its exit code.
  - It removes the worktree and keeps the branch.
- **The sender:** the run gets `OMNI_SENT_BY=<login>` and `OMNI_RUNNER=<name>`. When they are set,
  `/omni:pr` writes `Sent from the Omni app by @<login> on runner <name>` in the body of the pull
  requests it opens.
- **Failures:**
  - The app unreachable: it retries after 5 s, doubling up to 60 s, and keeps its running jobs
    going.
  - The token refused: it stops with `no sign-in (omni setup-token)`.
  - `claude` missing or signed out: it refuses to register, with one line saying which.
  - A job past `--timeout`: killed, `failed`, reason `timeout`.
  - A cancel: the job is killed, then marked `cancelled`.
  - On Ctrl-C it stops taking jobs and waits for the running ones.

The manual `yolo` script on the box stays as it is. Its sessions are named by ticket, a runner's by
`job-<id>`, so the two never collide.

## Decisions

- **The runner long-polls the app** (approach A of three). Rejected:
  - Supabase Realtime on the jobs table: a Supabase session on the runner, realtime rules, and a
    second way in.
  - A poll every 15 s: slow, and constant requests with nothing to do.
- **Lines, not prompts** (the person's answer): any `/omni:` line the app copies, from a fixed list
  of skills that run headless. No free text.
- **The runner registers itself and lives on its own page** (the person's answer). Its pod is a
  setting a workspace owner changes at any time, never fixed at registration, and a pod may have
  several runners.
- **A pod is a fleet:** the workspace's teams already exist as fleets (`public.teams`), and every
  player has one. The page says "fleet", the app's word.
- **Owners set fleets, members send:** the target rules above. The runner works under its owner's
  GitHub and Claude accounts; one identity per pod is a later PRD.
- **No automatic retry:** a lost or failed job waits for a person to press **Send again**.
- **First PRD of several** (the person's answer): send, run and result. Restart on reboot, alerts
  and per-pod identities come after.
- **The voice's objection, accepted.** Lead Engineer: unattended runs under one person's accounts
  blur who owns the pull request that comes out. Met by recording the sender on the job and naming
  them, with the runner, in every pull request the job opens.
- **No proof video** (the person's answer).

## User stories

1. As a PM on a PRD's page, I press **Send to terminal** next to **Build it**, pick my fleet's
   runner, and the PRD starts building without my opening a terminal.
2. As a workspace owner, I start `omni runner` once on a server and see it online on the Runners
   page, then give it to a fleet.
3. As anyone in the workspace, I see on the Runners page what each runner is doing, read a job's
   log tail, and open the pull request it made.
4. As the sender, I cancel a job I sent by mistake, or send a failed one again.
5. As a reviewer, I read in the pull request who sent the job and on which runner.

## Scope

In:

- the migration and its two tables;
- the six routes and the claim rules;
- the line and target checks;
- Send to terminal on every copy button whose skill is on the list;
- the Runners page and its sidebar entry;
- `omni runner`;
- the sender line in `/omni:pr`'s body;
- the kit README's runner section.

Out: everything named under **Out of scope**, and any change to the manual `yolo` script.

## Test seams

Every test runs on fixtures: none calls GitHub, Supabase or Claude (testing playbook).

| risk | test |
|---|---|
| a runner takes only jobs it may run | service tests on realistic rows: to a runner, to a fleet, to any; a runner with a fleet skipping "any"; a repository it does not hold |
| two runners never take one job | a repository test running two claims against one queued job |
| a silent runner's jobs end as `runner lost` | service test with a fixed clock, at 89 s and at 91 s |
| a line outside the list never runs | contract tests on the line check: each listed skill, an unlisted one, a conversational one, shell characters, 201 characters; the same cases in the runner's own check |
| a sender outside the fleet is refused | controller tests: member, fleet player, owner, other workspace; bad or missing token; a repository outside the workspace |
| the long-poll | controller test: a job answered at once, a 204 after the hold, the check-in counted |
| status updates | service tests: in order, out of order, after cancel, after `runner lost` |
| `omni runner` | `main()` on a fixture repository with a fake app (injected `fetch`) and a fake `claude`: register, claim, worktree, log tail, PR link read, timeout kill, cancel kill, the app unreachable then back, Ctrl-C waiting |
| Send to terminal and the page | component tests: the button hidden with no runner and for an unlisted skill; the picker listing only targets the viewer may use; each runner state and job status; Cancel and Send again shown only where they apply; no runner yet |
| the sender line | `/omni:pr`'s body with and without `OMNI_SENT_BY` |
| the migration | the migration-order and database checks the repository already runs |
| layering | `scripts/layering-guard.test.ts` and `scripts/import-guard.test.ts`, with no new baseline line |

By hand, once, on `vertuo-agents`: send `/omni:yolo` for a small PRD from its page, watch the job
on the Runners page, and open its pull request.

## Risks

- **What merging publishes:**
  - the migration, on the next deploy of the database;
  - the routes and the Runners page, on the galaxy's next production deploy;
  - `omni runner`, in the next kit release.

  Until a runner registers, nothing changes for anyone: the button stays hidden.
- **Commands from a web page run with permissions skipped.** Only the listed skills run, with
  checked arguments, passed from a file. Only signed-in members can queue a job, and only an owner
  can move a runner between fleets. The runner opens no port.
- **One person's accounts:** every job runs under the runner owner's GitHub and Claude accounts and
  spends their plan's limits. The pull request names the sender.
- **Rollback:** revert the feature pull request. The page and the button go, and a running
  `omni runner` stops at its next call with `refused (404)`. The tables can stay, unused, until a
  follow-up migration drops them.

## Acceptance criteria

1. `omni runner --name vertuo-agents --repos ~/repos` on a server with a kit token shows the runner
   online on `/app/runners` within 10 seconds, with its slots and repositories. It shows as
   offline within 2 minutes of being stopped.
2. A workspace owner sets the runner's fleet on the Runners page. The runner then takes only jobs
   sent to it or to that fleet, and stops taking jobs sent to any runner.
3. On a PRD's page, **Send to terminal** next to **Build it** queues `/omni:yolo <n>`. A free runner
   the sender may use claims it within 5 seconds. The Runners page shows it running, its log tail
   updated, and then done with the pull request's link.
4. A line whose skill is not on the list, or whose arguments hold any other character, is refused
   by the route and never reaches a runner. A runner given one anyway refuses to run it.
5. A member who is not in a runner's fleet, and is not an owner, sees no fleet runner in the picker,
   and the route refuses the job when they send it anyway.
6. Two runners waiting on one queued job: exactly one claims it.
7. A runner stopped with a job running leaves that job `failed`, reason `runner lost`, within 2
   minutes. It is never run again unless someone presses **Send again**.
8. Cancel on a queued job marks it `cancelled` at once. On a running job, it kills the run within
   10 seconds and marks it `cancelled`.
9. A job running past `--timeout` is killed and marked `failed`, reason `timeout`.
10. The pull request a job opens says `Sent from the Omni app by @<login> on runner <name>`.
11. With no runner in the workspace, no **Send to terminal** button shows anywhere, and the Runners
    page says how to start one.
