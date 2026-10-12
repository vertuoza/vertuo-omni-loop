---
prd: 1695
title: A world-class AGENTS.md for this repository
blocked-by: none
spec: file
phase0: server
---

# A world-class AGENTS.md for this repository

**Date:** 2026-10-12 · **PRD:** #1695 · **Touches:** `AGENTS.md`, `CLAUDE.md`, `.omni-loop/config.yml`
· **Kind:** Bounded, docs only

## Problem

vertuo-omni-loop builds a framework for coding agents, yet it gives a coding agent nothing to read
when it opens the repository. There is no root `AGENTS.md` and no root `CLAUDE.md`
(`.omni-loop/config.yml` says so on purpose, with `paths.context: []`). The loop's rules reach an
agent through one door only: the `SessionStart` hook in `.claude/settings.json`, which prints
`omni kb show briefing`. That door opens for a Claude Code session in this checkout and for no
other agent: Codex, Cursor, Copilot, Gemini CLI, Jules and the rest see no briefing, no command, no
map. Even a Claude session gets only the briefing, never the commands or the layout.

The commands themselves have a trap no file names. With the pnpm a developer's machine carries
today (12.x), every `pnpm` script in this repository refuses to run ("node_modules are out of sync
with your lockfile … the "pnpm" field in package.json is no longer read"): CI installs pnpm 9, and
nothing in the repository pins it. An agent that cannot run `pnpm test` cannot follow the briefing.

The person also asked whether Claude Code has moved from `.claude/` to `.agents/`. It has not
(checked against code.claude.com on 2026-10-12): settings, skills, hooks, commands and subagents
still live in `.claude/`, and Claude Code reads no `.agents/` directory. What became the shared
standard is the **`AGENTS.md` file** (agents.md, stewarded by the Agentic AI Foundation under the
Linux Foundation): read by Codex, Cursor, Copilot, Gemini CLI and others, and natively by Claude
Code when no `CLAUDE.md` exists. Claude Code's documented way to serve both is a shared
`AGENTS.md` plus a `CLAUDE.md` that holds `@AGENTS.md`.

## Solution

Three files, no code.

1. **`AGENTS.md` at the root.** Plain Markdown, at most 150 lines, written for any coding agent.
   It holds only what an agent would otherwise get wrong, and points at the playbook for the rest.
   Its sections, in this order:
   - **What this repository is:** one paragraph (the kit, dogfooded by the repository that builds
     it) and a map of the top-level folders, one line each: `kit/`, `game/`, `apps/galaxy/`,
     `apps/omni-app/`, `packages/`, `supabase/`, `scripts/`, `fallow/`, `layering/`, `mutation/`,
     `docs/`, `.omni-loop/`.
   - **Before you change anything:** run `node .omni-loop/bin/omni.mjs kb show briefing`, and
     `kb show <form>` for the form the work touches (`verification`, `testing`, `conventions`,
     `architecture`, `design`, `releasing`, …). The playbook is the source of truth; when
     `AGENTS.md` and a form disagree, the form wins.
   - **Setup:** Node ≥ 22.18; **pnpm 9** (`npx pnpm@9 …` or `corepack`), and why: pnpm 12 refuses
     the lockfile; `pnpm install --frozen-lockfile` once from the root; `apps/galaxy/.env.local`
     only for the game's scripts and the arcade, never for the tests.
   - **Commands:** a table, each row the command, what it does, its measured wall time on a
     developer laptop (rounded) and what it needs: the briefing, `pnpm test`, `pnpm lint`
     (and `pnpm lint <path>…`), `pnpm typecheck`, `pnpm check:changed [--base origin/<branch>]`,
     `pnpm mutation:changed`, `pnpm kit:build`, `node apps/omni-app/build.ts`. Every row was run
     green before it was written (see **Test seams**).
   - **Generated files:** `kit/dist/` and `apps/omni-app/api/` are built, never hand-edited. Inside
     a wave, a slice rebuilds them only to test and commits none; the wave rebuilds once
     (`generated:` in `.omni-loop/config.yml`, PRD 1138). Outside a wave, the change commits its
     rebuild: `kit/test/dist.test.ts` fails on a stale bundle.
   - **Never:** the briefing's Never lines, one short line each, then "the briefing has the full
     text".
   - **The loop:** the seven stages on one line; the folder is the status; only a person merges
     into `main`; the Claude skills (`/omni:brainstorm`, `/omni:yolo`, `/omni:bug-fix`, …) and the
     terminal commands any agent can run (`omni status`, `omni prd <n>`, `omni board <n>`,
     `omni next`, `omni check`, `omni help <name>`).
   - **Where to read next:** `.omni-loop/knowledge/` (registers, `adr/`, `playbook/`, `design/`),
     `docs/guide/`, and the nested `apps/galaxy/AGENTS.md`, which applies inside that folder.

2. **`CLAUDE.md` at the root:** the one line `@AGENTS.md`, a real file and not a symlink (a symlink
   breaks Claude's Edit and Write tools and Windows checkouts), the same pattern
   `apps/galaxy/CLAUDE.md` already follows. Claude-only behaviour stays where it is: the briefing
   arrives through the `SessionStart` hook, the plugins and hooks in `.claude/settings.json`.

3. **`.omni-loop/config.yml`:** `paths.context: [AGENTS.md]`, so the skills read it as context
   and `omni phase0` counts it as a document; the comment above it is rewritten to say the root
   `AGENTS.md` is the repository's agent instructions and `CLAUDE.md` imports it.

`.claude/` is unchanged and nothing moves to `.agents/`.

## Decisions

- **Scope: this repository only.** The kit does not install or maintain an `AGENTS.md` in the
  repositories it is installed in (the person's answer: "for this repo to get best-practises — not
  trying to enforce to other repo").
- **Pointer plus short core, not a copy and not a generator.** `AGENTS.md` carries the core every
  agent needs up front and points at `omni kb show <form>` for the rest, so the playbook stays the
  single source; no script renders it and no test compares it.
- **No `.agents/` move.** Claude Code reads no `.agents/` directory today; moving `.claude/` would
  switch off the hooks, the plugins and the statusline.
- **`CLAUDE.md` imports, it does not link.** `@AGENTS.md` rather than a symlink, as above.
- **Commands carry their cost.** The voice objected at the design (persona:B-E DEv): *"If this
  file just repeats the README, it's fluff. I'd only trust it if every command in it actually runs,
  and it says which ones are slow."* Settled `accepted`: every command is run green before it is
  written, and each row gives its measured time and what it needs. Running them found the pnpm 9
  trap the Setup section now names.
- **Proof video: no.** Nothing a browser can film.

## User stories

- As a Codex, Cursor or Copilot agent opening this repository, I read `AGENTS.md` and know the
  layout, the commands, the pnpm version and the rules before my first edit.
- As a Claude Code session, I get the same file through `CLAUDE.md`'s import, besides the briefing
  the hook prints.
- As a developer who doubts the tool (persona:B-E DEv), I can run any command `AGENTS.md` names and
  it does what the file says, in about the time it says.
- As the Lead Engineer, every agent on the team, whatever its vendor, starts from the same rules.

## Scope

In: the root `AGENTS.md`, the root `CLAUDE.md`, the `paths` block of `.omni-loop/config.yml`.

Out: any kit code, template or skill; installing `AGENTS.md` in other repositories; moving
`.claude/`; pinning pnpm in `package.json` (`packageManager`), which changes the install and
belongs in its own change; rewriting `apps/galaxy/AGENTS.md`, which `next dev` writes; fixing the
stale "No formatter and no linter is configured" line in the conventions form (raised in Risks).

## Test seams

No source file changes, so there is no unit test. The seams are the commands themselves:

- Before `AGENTS.md` is committed, each command it lists is run once from a clean checkout with
  pnpm 9, and each must exit 0; its row gives the wall time measured there. A command that does not
  pass is not listed.
- `node .omni-loop/bin/omni.mjs check inbox` is green, and `omni config paths.context` prints
  `["AGENTS.md"]`.
- `pnpm test` stays green: `.omni-loop/config.yml` still parses, and no guard reads the new files.
- Claude Code loads the import: in a fresh session at the root, `/memory` lists `AGENTS.md` through
  `CLAUDE.md`.

## Risks

Merging publishes three files on `main`; nothing deploys, and the release workflow's version commit
follows as after every merge. Rollback is reverting the merge commit.

- **Drift.** A command or a folder changes and `AGENTS.md` does not. Kept small by holding no rule
  text the playbook owns, and by naming the playbook as the winner when they disagree.
- **Context cost.** Every Claude session in this repository now loads `AGENTS.md` besides the
  briefing; the 150-line cap bounds it.
- **The playbook disagrees with itself today:** the conventions form says no linter is configured,
  while `pnpm lint` is a CI check. `AGENTS.md` follows the verification form; the conventions line
  is left for its own fix.

## Acceptance criteria

1. A root `AGENTS.md` exists, at most 150 lines, with the eight sections of **Solution** in that
   order.
2. Every command in its Commands table exits 0 when run from a fresh checkout with pnpm 9, and its
   row names a measured wall time and what it needs.
3. Its Setup section names pnpm 9 and says pnpm 12 refuses the lockfile.
4. Its Never section has one line for each Never line of `omni kb show briefing`, and no rule the
   briefing does not hold.
5. A root `CLAUDE.md` exists, is a regular file (not a symlink), and its whole content is
   `@AGENTS.md`.
6. `.omni-loop/config.yml` sets `paths.context: [AGENTS.md]`, and `omni config paths.context` prints
   it.
7. `.claude/` is unchanged, and no `.agents/` directory exists.
8. `pnpm test`, `pnpm lint` and `pnpm typecheck` are green on the feature branch.
