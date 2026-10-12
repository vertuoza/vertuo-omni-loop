---
prd: 1218
title: Roadmap prerequisites — a checklist the agent checks and fixes before the loop gets stuck
blocked-by: none
spec: file
---

# Roadmap prerequisites

**Date:** 2026-10-08 · **PRD:** #1218 · **Touches:** `kit/lib/roadmap/` (parse, grade, push),
`kit/lib/roadmap/prereqs/` (new: the base checks and the runner), `kit/bin/commands/roadmap.ts`
(`omni roadmap prereqs`, `omni roadmap tick`), `kit/lib/next/roadmap.ts` (a new hold reason),
`kit/plugin/skills/roadmap/`, `kit/plugin/skills/mega-roadmap/`, `kit/plugin/skills/drive/`,
`kit/plugin/skills/mega-drive/`, `supabase/migrations/` (one new migration),
`apps/galaxy/src/roadmap/` and `apps/galaxy/app/roadmaps/[id]/` (tabs, the Prerequisites pane),
`docs/guide/roadmaps.md`.
**Out of scope:** installing software on a person's computer, creating or changing a secret, a token
or anyone's access, a prerequisites check outside a roadmap (`/omni:yolo` on a lone PRD), a general
`omni doctor`.

## Problem

A roadmap is driven for hours across many PRDs, and it stalls on things nobody wrote down:

- **A repository could not reach a private npm package.** `pnpm install` failed in the agent's
  worktree, every slice of the PRD went red, and the loop burned its attempts on a problem no code
  change could fix.
- **A laptop had no Docker.** The tests that need a database could not run, so the preflight was red
  on that machine and nothing could merge.

Nothing in the kit checks the setup a roadmap needs. `commands.preflight` runs the project's tests;
it does not say *why* they cannot run. The tool requirements are a manual table in the guide. The
author only learns what was missing once the loop is already stuck, often hours later, and the
people who write roadmaps are often not the people who know how to install Docker or grant an npm
token.

## Solution

A roadmap names its **prerequisites**: what has to be true on the machine, on GitHub and around the
repository before its PRDs can be built. The agent checks them, fixes the ones it safely can, and
lists the rest for the author on a **Prerequisites** tab of the roadmap's page — each with a plain
explanation, the command to copy, what that command does, and who can do it. The drive holds only
the PRDs an open prerequisite blocks; everything else keeps building.

### 1. The table in `roadmap.md`

An optional `## Prerequisites` section, after `## Open questions`, with this table:

| id | category | need | check | fix | blocks | who |
|---|---|---|---|---|---|---|
| p1 | local | Docker is running, for the database tests | `base:docker` | | r2, r3 | check |
| p2 | access | the `@vertuoza/ui` package installs | `npm view @vertuoza/ui version` | | all | check |
| p3 | permissions | the Vercel preview has `DATABASE_URL` | | | r4 | person |

- **id:** `p1`, `p2`, …, unique in the table.
- **category:** one of `local` (tools on the machine that runs the loop: Docker, Node, pnpm, git),
  `access` (registries, private packages, other repositories), `permissions` (GitHub scopes, write
  access, secrets and environment variables), `github` (labels, workflows, branch settings, the
  Omni Loop app installed), `services` (a database, preview deployments, the Omni app sign-in).
- **need:** one plain sentence: what must be true, and for what.
- **check:** how to verify it — a base check `base:<name>` from the kit's catalog, a shell command
  that exits 0 when it holds, or empty when nothing can verify it.
- **fix:** empty, or a base fix `base:<name>` the kit may run itself (the `agent` rows only).
- **blocks:** the row ids of `## PRDs` it blocks, or `all`.
- **who:** `agent` (the agent checks it and fixes it itself), `check` (the agent checks it, a person
  fixes it), or `person` (nothing can verify it: the author ticks it).

Every `check` and `person` row has its **author card**, written under the table as a `### <id>`
subsection with exactly four labelled lines:

```markdown
### p1

- **Why:** The tests for this roadmap start a database in Docker. Without Docker running, they
  cannot run, and no slice can merge.
- **Command:** `open -a Docker`
- **What it does:** Starts the Docker app on your Mac. If it is not installed, get it from
  https://www.docker.com/products/docker-desktop and open it once.
- **Who can do it:** Anyone with this laptop.
```

The words are for someone who is not technical: no jargon without its meaning, one command per
card (the simplest one that works on the platform the roadmap's author uses), and the install step
spelled out when a tool is missing.

### 2. The base checks

The kit ships a small catalog under `kit/lib/roadmap/prereqs/`, each with a check, a card, and for
some a fix the agent may run:

| name | category | checks | agent fix |
|---|---|---|---|
| `gh-auth` | permissions | `gh` is signed in, with the `repo` scope | — |
| `node` | local | Node ≥ the version the repository needs | — |
| `pnpm` / `npm` / `yarn` | local | the repository's package manager runs | — |
| `install` | access | the dependencies install from a clean lockfile | runs the install |
| `registry` | access | the registry the lockfile names answers | — |
| `docker` | local | `docker info` answers | — |
| `labels` | github | the loop's labels exist | creates them when `labels.autoCreate` is true |
| `env-file` | local | each `.env.example` has its `.env` | copies the example when the `.env` is missing, never overwriting one |
| `omni-signin` | services | `omni` is signed in to the Omni app | — (the card gives `omni signin`) |

**What the agent may fix:** only what is inside the repository or its own session and can be undone.
It never installs software, never starts or stops a system service, never writes a secret, a token
or a value it was not given, and never changes anyone's access. Everything else is a `check` row:
the agent verifies it and the author does it.

Every roadmap gets the base rows `gh-auth`, `node`, the package manager, `install` and `labels`,
blocking `all`; the skill adds the rest from what each PRD needs.

### 3. `omni roadmap prereqs <n> [--fix] [--json]`

1. Reads the roadmap's table and the ticks on its issue.
2. Runs each `check`, with a 30-second limit each. A check that times out or crashes is **not ok**,
   never passed.
3. With `--fix`, runs the `agent` rows' fixes once, then checks them again.
4. Prints one line per row, grouped by category: `ok`, `fixed`, `waits on you` (with the card's
   command), or `ticked` (a `person` row a person ticked).
5. Sends the result to the roadmap's page, with the machine's name (the host name) and the time.
   When the page cannot be reached, it says so in one line and the exit code is unchanged.
6. Exits 0 when every row is ok, fixed or ticked; 1 otherwise.

`omni roadmap tick <n> <id>` posts a marked comment on the roadmap issue, as
`omni roadmap answer` does; the page's tick posts the same comment.

### 4. The roadmap skills

`/omni:roadmap` and `/omni:mega-roadmap`, in the step that draws the map:

- read each PRD for what it needs to be built and tested (a container, a private package, a
  secret, a service, a permission) and write the `## Prerequisites` rows and their cards, the base
  rows first;
- show them in the map, grouped by category, so the one checkpoint covers them;
- after `omni roadmap check` is green, run `omni roadmap prereqs <n> --fix` once and report its
  lines in the hand-off, the open ones first.

In a plan repository, a row may add a `repos` cell naming the targets it concerns; its checks run
in the read-only clone only when they read (never `install`).

### 5. The check

`omni roadmap check` refuses, naming the row: an unknown `category` or `who`, an id that is not
unique, a `blocks` that names no row, a `check` naming no base check, a `fix` on a row that is not
`agent` or naming no base fix, an `agent` row without a fix, a `check` or `person` row without its
card, and a card missing one of its four lines.

### 6. The drive

`/omni:drive --roadmap <n>` and `/omni:mega-drive --roadmap <n>` run `omni roadmap prereqs <n> --fix`
on the first tick, and again on any tick whose next step starts a PRD a prerequisite blocks.
`omni next --roadmap` reads the last result of this machine:

- a PRD blocked by a row that is not ok, fixed or ticked gets the gate
  `hold`, with `waits on prerequisite <id> (<category>): <need>` and the Prerequisites tab's link;
- the rows before it in the gate table keep precedence (a `person` question still parks);
- once every PRD not held is done, the drive stops and lists each open prerequisite with its card's
  command.

A row that turns ok on a later check, or that a person ticks, frees its PRDs on the next tick.

### 7. The page

The roadmap's page gets two tabs, **Overview** (today's Milestone, Gantt, Open questions and PRDs)
and **Prerequisites**, picked by `?tab=`, in the PRD page's tab style.

The Prerequisites tab shows a count line (`7 ok · 1 fixed · 2 wait on you`), then the rows grouped
by category, those that wait on you first. Each row shows its need, its state, the PRDs it blocks,
and when and on which machine it was last checked. A row that waits on you opens its card: **Why**,
the **command** in a code box with a **Copy** button, **What it does** and **Who can do it**. A
`person` row has a **Mark as done** button, for a signed-in member, which posts the tick.

A roadmap without a `## Prerequisites` section shows the tab with one line saying so.

## Decisions

- **The table lives in `roadmap.md`,** not in a second file and not in a general `omni doctor`: it
  is reviewed in the phase-0 PR with the rest of the roadmap, and only a roadmap knows that one PRD
  needs Docker or a private package.
- **Prerequisites come from the PRDs plus a base set** (the person's choice): the base rows catch
  what every loop needs, the PRD rows catch what this roadmap needs.
- **The agent fixes only what is safe and undoable** (the person's choice), and the author cards
  are written for a non-technical reader, with the command, a copy button and one plain sentence on
  what it does (the person's addition).
- **An open prerequisite holds only the PRDs it blocks** (the person's choice); `all` holds them
  all. Checks run again every tick that would start a blocked PRD, so a fix frees the work without
  anyone telling the loop.
- **The voice objected** (persona:Irisa): "I don't master the technical harness, so a 'permissions'
  or 'github' item that lands on me just sits there. Each one should say who on my team can do it,
  not only give me a command." Settled `accepted`: every card has a **Who can do it** line.
- **Machine-bound results.** A `local` row is true of one machine; the page shows the machine and
  the time, and the drive reads the result of the machine it runs on.
- **A check that cannot run is not ok.** A timeout or a crash never counts as passed: a false green
  would stall the loop later, which is the very thing this PRD prevents.
- **No proof video** (the person's answer).

## User stories

- As a roadmap author, I see before the drive starts that this laptop has no Docker, with the
  command to start it and what it does, instead of finding a red preflight hours later.
- As a PM who is not technical, I read on the Prerequisites tab what is missing, copy the command
  or forward the card to the person it names, and the loop picks up once it is done.
- As the agent, I fix the missing install or `.env` myself and say so, and never touch a secret.
- As a lead engineer, I review the prerequisites in the phase-0 PR with the rest of the roadmap.
- As the drive, I keep building the PRDs no open prerequisite blocks.

## Scope

In: the `## Prerequisites` table and its cards, their parse and grade, the base catalog, the
`prereqs` and `tick` commands, the new hold, the four skills' steps, one migration with the
prerequisite rows and their last result, the roadmap page's tabs and the Prerequisites pane, the
guide.

Out: prerequisites of a lone PRD outside a roadmap, any fix that installs software or touches access
or secrets, notifying anyone outside the page and the drive's own lines.

## Test seams

- **Parser and grade** (`kit/lib/roadmap/parse.test.ts`, `grade.test.ts`): a valid table and its
  cards; each refusal in section 5 with valid and invalid rows; a roadmap without the section is
  still valid.
- **The runner** (`kit/lib/roadmap/prereqs/*.test.ts`): checks injected as fakes — ok, not ok,
  timeout, crash; a fix that succeeds and one that does not; `--fix` never runs a fix on a row that
  is not `agent`; the base checks against a stubbed command runner, never the real machine.
- **The command** (`kit/bin/roadmap.test.ts`, through `main()` on `makeRepo()`): the grouped lines,
  the exit code, the push body, an unreachable page; `tick` posts the marker comment on a stubbed
  GitHub.
- **The gate** (`kit/lib/next/roadmap.test.ts`): a blocked row holds only the PRDs it names; `all`
  holds them all; a ticked or ok row frees them; a person question still parks first.
- **Galaxy**: a migration test with realistic rows (`apps/galaxy/src/roadmap/migration.test.ts`),
  the API's validation of the new push body, and a page test of the tab — grouping, the count
  line, the card, the copy button, the tick button only for a member, the empty state.
- No test calls GitHub or Supabase, or runs Docker or an install on the machine.

## Risks

- **A merge publishes** the kit (the `omni` binary and the plugin's skills) and, through the
  `supabase` workflow, one migration on production. The migration only adds a table and a column
  (additive); rollback is a revert of the PR plus a migration that drops them. A roadmap written
  before this PRD has no `## Prerequisites` section and keeps working unchanged.
- **A shell `check` in `roadmap.md` runs on the driver's machine.** It is reviewed in the phase-0 PR
  like any committed script, runs with a time limit, and is never a fix: only the kit's base fixes
  run as fixes.
- **A false "ok"** would stall the loop later; the runner treats any failure to run as not ok.

## Acceptance criteria

1. `omni roadmap check` accepts a roadmap with a valid `## Prerequisites` table and its cards, and
   refuses each fault of section 5, naming the row and the fault.
2. `omni roadmap prereqs <n>` prints one line per row grouped by category, exits 1 while a row
   waits on a person and 0 once every row is ok, fixed or ticked.
3. With `--fix`, an `agent` row whose fix works shows `fixed`; no fix runs on a `check` or `person`
   row; nothing installs software or writes a secret.
4. A check that times out or crashes shows `waits on you`, never `ok`.
5. `omni next --roadmap <n>` holds exactly the PRDs a not-ok row blocks, with the line
   `waits on prerequisite <id> (<category>): <need>` and the tab's link, and frees them once the row
   is ok or ticked.
6. `/omni:roadmap` writes the base rows and the rows its PRDs need, each `check` or `person` row
   with its four-line card, and its hand-off lists the open ones.
7. The roadmap's page has **Overview** and **Prerequisites** tabs; the Prerequisites tab groups the
   rows by category with those waiting on you first, shows each card with its command, a working
   **Copy** button, what it does and who can do it, and the last check's machine and time.
8. A signed-in member can mark a `person` row done from the tab, and the next tick reads it.
9. A roadmap without the section still checks, drives and renders as it does today.
