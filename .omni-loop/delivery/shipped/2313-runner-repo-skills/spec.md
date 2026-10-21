---
prd: 2313
title: A repository allows its own skills on a runner
blocked-by: none
spec: file
phase0: server
---

# A repository allows its own skills on a runner

**Date:** 2026-10-21 · **PRD:** #2313 · **From:** request #2312 · **Touches:** `supabase` (one
migration), `apps/galaxy` (Settings › Repositories, the runners' contract and service), `kit` (the
runner's line check, its job, `omni runner send`).

## Problem

A runner only runs the loop's own skills. `RUNNABLE_SKILLS` (`kit/lib/runner/line.ts:8`) and its
twin `RUNNER_SKILLS` (`apps/galaxy/src/runners/runners.contract.ts:30`) are fixed lists, and a line
must read `/omni:<skill>`. A repository with a skill of its own cannot send it to a runner:
`acme/widgets` (a fictional example) has `/validate-prd <n>`, which validates a PRD's acceptance
criteria on the feature PR's ephemeral environment (Playwright, GraphQL checks, a report and one clip
per criterion, sent to the Proof tab with `omni proof push`). It runs by hand today: on a runner,
`/validate-prd 347` fails the shape check, and `/omni:validate-prd 347` fails the list.

## Solution

**A workspace owner allows a repository's own skills, one by one, in Settings › Repositories; the
app queues a line of an allowed skill; the runner checks the allowance and the skill's presence on
the default branch again before it runs it.**

1. **Settings › Repositories.** Each repository row gains a **Runner skills** block, closed by
   default. Opened, it lists every `.claude/skills/<name>/SKILL.md` on the repository's default
   branch, read live through the GitHub App, never stored: one line per skill with the `name` of its frontmatter, its `description` as the name's tooltip
   (never text at rest), and an **Allow on runner** switch. Only an owner turns it on or
   off, as "Phase 0 on the server"; anyone else sees it disabled. An allowed skill reads
   `allowed by <login> on <date>`. An allowed skill no longer on the default branch reads **gone**,
   its switch still on so an owner can turn it off; nothing runs it (item 4). A folder with no
   `SKILL.md`, or whose `name` is not a valid skill name, is left out. A failed read says
   `Skills could not be read: <why>`, and the allowed skills stay listed.
2. **The allowance holds by name.** It is a row per `(workspace, repository, skill)`; a later change
   to the skill's `SKILL.md` on the default branch keeps it allowed. Turning it off deletes the row.
3. **The line.** For a repository, a line is `/omni:<skill> <args>` with `<skill>` on the fixed list,
   as today, or `/<name> <args>` with `<name>` one of the repository's allowed skills. A name is
   `[a-z][a-z0-9-]*`, and a name on the fixed list is never allowed, so `/yolo` never means
   `/omni:yolo`. Same 200 characters at most, the skill included, and the same argument characters
   (letters, digits, spaces and `._/:#-`). **Send to terminal** and `omni runner send` take both.
4. **The run.** The job a runner claims carries its repository's allowed skills, read when it is
   claimed: a skill turned off while its job waits is refused on the runner. Before the run starts,
   the runner checks the line against them (`checkRunnerLine`), then that
   `.claude/skills/<name>/SKILL.md` exists in the job's worktree, which is cut from
   `origin/<default branch>`: a skill only on a branch never runs.
5. **Its MCP servers.** A job of a repository skill whose worktree holds `.mcp.json` runs
   `claude -p` with `--mcp-config .mcp.json`, so the repository's servers (Playwright, for
   `/validate-prd`) load with no approval prompt. A job of a fixed skill runs as today.
6. **What such a job is.** No yolo outcome: its milestones are the generic ones, queued, claimed,
   running, then done or failed from its exit code. It is never resumed by answers: a person may only
   dismiss its questions. It never continues a PRD (Fix on a runner once answered). Its first
   argument, when it is a PRD number, lists it among that PRD's jobs (`/validate-prd 347`
   under PRD 347).

**The data.** One migration, dated after the newest on `main`:

- `public.repository_runner_skills (workspace_id, full_name, skill, allowed_by, allowed_at)`, primary
  key `(workspace_id, full_name, skill)`, `full_name` lowercased, `skill` checked against
  `^[a-z][a-z0-9-]*$` and at most 64 characters. Row-level security lets the workspace's members
  read it; nobody writes it directly.
- `set_repository_runner_skill(p_workspace uuid, p_full_name text, p_skill text, p_allowed boolean)`:
  security definer, `repository_owner_only(p_workspace)` first, as `set_repository_phase0()`. On
  inserts the row (allowed by `auth.uid()`, now), off deletes it. Refuses a malformed name or a name
  on the fixed list (22023, hint `skill`) and a repository the workspace does not list (P0002, hint
  `full_name`).
- `repository_runner_skills_of(p_workspace uuid, p_full_name text) returns text[]`: the allowed
  names, which `queue()` and the claim read.

**The contract.** `checkLine(line, allowed = [])` (app) and `checkRunnerLine(line, allowed = [])`
(kit) answer `{ ok, kind: 'omni' | 'repository', skill, args }` or `{ ok: false, reason }`, the
same verdict for the same input. `RunnerJobSchema` (app) and `JobSchema` (kit) gain
`allowedSkills: string[]`; the kit reads a job without it as `[]`, so an older app's job runs as
today. `omni runner send` checks the shape and the fixed list itself, and leaves an allowed name to
the app, whose refusal it prints.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | database | `repository_runner_skills` | no written convention: follows `public.repositories` and `repository_phase0()` ← supabase/migrations/20261122090000_phase0_flag.sql:18 |
| vertuo-omni-loop | database | `set_repository_runner_skill()` | set_repository_phase0() ← supabase/migrations/20261122090000_phase0_flag.sql:27 |
| vertuo-omni-loop | database | `repository_runner_skills_of()` | no written convention: follows `repository_phase0()` ← supabase/migrations/20261122090000_phase0_flag.sql:54 |
| vertuo-omni-loop | contract | `allowedSkills` | no written convention: follows `sentBy` ← apps/galaxy/src/runners/runners.contract.ts:120 |
| vertuo-omni-loop | screen | Runner skills · Allow on runner | the issue's words (#2312); switches follow `Switch` ← apps/galaxy/src/repositories/RepositoriesView.tsx:124 |

## Decisions

- **Approach: an owner's allowance on the server, sent with each job** (approved in the design).
  Rejected: the repository listing its skills in its own `config.yml` (anyone who merges decides
  what runs on someone else's machine), and running any skill on the default branch.
- **A changed `SKILL.md` keeps its allowance** (asked: the person chose "holds by name" over tying
  it to the blob SHA).
- **The runner loads the repository's `.mcp.json` for a repository-skill job** (asked: the person
  chose this over leaving it to the skill, or a second switch). Allowing the skill allows its
  servers.
- **Product repositories:** a job always belongs to one repository, and the runners know no product
  job, so an allowance on a repository holds for every job on it, whichever product sent it.
  Settled from the code (`runners.service.ts`), not asked.
- **The allowed skills are read when a job is claimed**, not when it is queued, so turning a skill
  off stops a job that waits.
- **A name on the fixed list is never allowed**, so a line's meaning never depends on a setting.
- **A repository-skill job is never resumed by answers**: the resume line (`resumeLine()`) is a
  fixed skill's; such a job's questions can only be dismissed.
- **A skill's description is its name's tooltip,** never text at rest: the word pass refused a
  description of 8 and 12 words in the after, and a `SKILL.md` description often runs longer.
- **The voice.** persona:B-E DEv objected: "A skill I allowed once keeps running with
  `--dangerously-skip-permissions` and its MCP servers loaded without asking, even after someone
  rewrites its SKILL.md. I would never know what I actually approved." Settled `none`: the person
  approved the design without answering it.

## User stories

- As a workspace owner, I open Settings › Repositories, open **Runner skills** under
  `acme/widgets` (a fictional example), see `validate-prd`, read its description on its tooltip, and turn
  **Allow on runner** on; the line then reads `allowed by <me> on <today>`.
- As a member, I send `/validate-prd 347` from Send to terminal, or with
  `omni runner send '/validate-prd 347'`, and a runner holding the repository runs it with
  its Playwright server loaded.
- As a member, sending a skill no owner allowed tells me
  `/<name> is not allowed on a runner for <repo>: an owner allows it in Settings › Repositories.`
- As an owner, when the skill is removed from the default branch, its line reads **gone**, and a job
  sent for it fails `refused: /<name> is not on <default branch>`.

## Scope

In: the migration, the Runner skills block, the live GitHub read, the line check on both sides,
`queue()`, the claim, `answer()`, `continue.ts`, `sendable()`, the runner's place check, the job's
`--mcp-config`, `omni runner send`, their tests, `kit/dist` rebuilt.

Out: an allowance tied to a `SKILL.md`'s version; skills outside `.claude/skills/` (a plugin's, a
user's); a yolo outcome or a resume for a repository skill; any change to the fixed list.

## Test seams

Every test runs on fixtures: none calls GitHub or Supabase (`omni kb show testing`).

- **The line, both sides** (`apps/galaxy/src/runners/runners.contract.test.ts`): the two fixed lists
  stay equal; one table of lines runs through `checkLine` and `checkRunnerLine` and expects the same
  verdict: `/omni:yolo 1`, `/validate-prd 347` allowed and not, `/yolo` allowed as a name,
  `/Bad_Name`, 201 characters, a `;` in the arguments, `/vercel:deploy`.
- **The migration** (`apps/galaxy/src/runners/runners.skills.migration.test.ts`, as
  `runners.migration.test.ts`): owner only, the name checks, a member reads and cannot write.
- **The service** (`runners.service.test.ts`): `queue()` takes an allowed skill and refuses another
  with its reason; the claim carries `allowedSkills` as they stand then; `answer()` refuses a
  repository-skill job.
- **The read** (`apps/galaxy/src/repositories/skills.test.ts`, a stubbed `RepoReader`): the list with
  its frontmatter; a folder with no `SKILL.md` and a bad name left out; a failed read.
- **The screen** (`apps/galaxy/src/repositories/render.test.ts`): closed by default, switches
  disabled for a member, `allowed by … on …`, **gone**, the read's error.
- **The kit:** `kit/lib/runner/line.test.ts` (the same table); `runner.test.ts` (`placeOf` refuses a
  skill missing from the worktree and runs one present; a job without `allowedSkills` reads `[]`);
  `job.test.ts` (`--mcp-config .mcp.json` only for a repository-skill job whose worktree has it);
  the `omni runner send` test (a `/name` line goes to the app; a malformed one is refused locally).

## Risks

- **What merging publishes:** a database migration (a table and two functions), the app's Settings
  › Repositories and runners routes, and the kit's runner in the next `v0.0.N` release
  (`omni kb show releasing`). Nothing changes before an owner allows a skill: every list reads empty.
- **Rollback:** a follow-up migration drops `repository_runner_skills` and both functions; the app
  and kit revert by a revert of the feature PR. A runner on an older kit ignores `allowedSkills` and
  refuses every `/<name>` line, as today.
- **What an allowance hands over:** a job runs `claude --dangerously-skip-permissions -p`
  (`kit/lib/runner/job.ts:23`) on the runner's machine, now with the repository's MCP servers loaded.
  Allowing a skill is allowing what it, and those servers, do there; by name, so a later merge to its
  `SKILL.md` is allowed too. Only the default branch, after a reviewed merge, is read.
- **The locked laws:** none of them changes. The ones this design leans on:
  - BR-PRODUCT-63: an agent link reads only repositories in its own workspace; the skills read and
    the allowance are per workspace and repository, so another team's private work is never shown.
    Changing it needs @pierrederval to approve the pull request on GitHub.
  - N-PRODUCT-17: no secret is ever sent to the browser; the GitHub App's token stays in the server
    read, and the browser gets names and descriptions only. Changing it needs @pierrederval to
    approve the pull request on GitHub.
  - N-PRODUCT-15: only a person merges into the main branch; a repository skill's job opens pull
    requests at most, as any job. Changing it needs @pierrederval to approve the pull request on
    GitHub.
  - The others `omni kb laws` printed (BR-PRODUCT-3, 5, 6, 12, 28, 29, 39, 59, 64, 94; N-PRODUCT-3,
    4, 7, 8, 13, 14, 16) are not touched by these files. Changing any needs @pierrederval to approve
    the pull request on GitHub.

## Acceptance criteria

1. An owner sees, under a repository in Settings › Repositories, a closed **Runner skills** block
   that, opened, lists each `.claude/skills/<name>/SKILL.md` of the default branch with its name and
   description as its tooltip and an **Allow on runner** switch; a member sees the switches disabled.
2. Turning a switch on records the owner and the time, shown as `allowed by <login> on <date>`;
   turning it off removes it. `set_repository_runner_skill()` refuses anyone but an owner, a malformed
   name and a fixed skill's name.
3. An allowed skill that left the default branch reads **gone**; a job sent for it fails on the
   runner with `refused: /<name> is not on <default branch>`.
4. `/validate-prd 347` is queued by Send to terminal and `omni runner send` when allowed, and
   refused with `/validate-prd is not allowed on a runner for <repo>: an owner allows it in
   Settings › Repositories.` when not. `/omni:<fixed skill>` lines behave as today.
5. `checkLine` and `checkRunnerLine` give the same verdict for every line of the shared table.
6. A job claimed after its skill was turned off fails `refused: …` without running.
7. A repository-skill job whose worktree holds `.mcp.json` runs with `--mcp-config .mcp.json`; a
   fixed-skill job's arguments are unchanged.
8. A repository-skill job ends done or failed from its exit code, with no outcome; answering its
   questions is refused, dismissing them works.
