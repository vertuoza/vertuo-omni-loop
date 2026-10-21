---
prd: 1814
title: Same gate for every agent — git hooks for everyone, quick CI on every PR
blocked-by: none
spec: file
phase0: server
---

# Same gate for every agent

**Date:** 2026-10-13 · **PRD:** #1814 · **Touches:** `.githooks/`, `scripts/` (a hook installer,
the push hook's steps), `package.json` (`prepare`), `.github/workflows/quick.yml`,
`.claude/settings.json`, `.claude/hooks/`, the `verification` and `ci` playbook forms, `AGENTS.md` ·
**Kind:** Bounded

## Problem

A neutral audit of this repository's agent setup, done beside demo-org/vnext's on 2026-10-13, named
one weakness first: **the grade is self-reported.** Three facts make it so.

1. **There is no git hook.** `.git/hooks` holds only git's samples, and nothing sets
   `core.hooksPath`. The only commit gate is a Claude Code `PreToolUse` hook
   (`.claude/hooks/fallow-gate.sh`), which Codex, Cursor and people never run. The verification
   form still says "A commit hook runs only the checks that need no build … Never skip a hook": a
   hook that does not exist for git.
2. **The gate it has lets changes through.** `fallow-gate.sh` exits 0 when `jq` is missing, when the
   fallow binary cannot be found, and on any runtime error of the audit ("Runtime errors fail open").
   It also audits the main checkout rather than a worktree when the worktree has no `.fallowrc.jsonc`
   reachable, which the verification form has to explain.
3. **Most pull requests run no CI.** `checks` runs only on a ready pull request into `main`. A draft
   runs nothing, and a sub-PR into a feature branch runs nothing: the verification form says "A
   sub-pull request runs no CI, so these are its only grade". A wave merges slices on the word of the
   agent that built them.

## Solution

### 1. Git hooks, installed by `pnpm install`

- A tracked `.githooks/` folder holds `pre-commit` and `pre-push`, plain POSIX shell scripts that
  call Node scripts under `scripts/`. No hook manager and no new dependency.
- `package.json` gains `"prepare"`, which runs a small installer script: inside a git work tree it
  sets `git config core.hooksPath .githooks`, and prints one line saying so. Outside a git work tree
  (a tarball, a container build), it prints one line saying it skipped and exits 0. Worktrees share
  the repository's config, so every worktree of a checkout gets the hooks from one install.
- **pre-commit** runs the fallow audit (`fallow audit`, about 0.5 s measured on 2026-10-13) from the
  root of the work tree being committed, so a commit in a worktree is audited against that worktree.
  It needs no build, as the verification form asks.
- **pre-push** runs `check:changed`'s **typecheck** and **lint** steps only (about 10 s), measured
  from the merge-base with the branch's upstream, or `origin/main` when the branch has none. Tests
  are left to CI (section 3). `scripts/check-changed.ts` gains a way to run a subset of its steps,
  so the hook and `pnpm check:changed` share one implementation.
- **The hooks fail closed.** When a tool they need cannot be found (fallow, pnpm), or the audit
  cannot run, the hook refuses the commit or push, printing one line naming what is missing and the
  fix (`run pnpm install`). The tools are looked up in the work tree's `node_modules/.bin`, then in
  the main checkout's (a worktree with no install of its own uses the main checkout's, as
  `fallow-gate.sh` does today). No `jq` is needed: a git hook reads no JSON.
- `git commit --no-verify` and `git push --no-verify` stay the emergency hatch the briefing's Hooks
  section describes: used only in an emergency, and the pull request says why.

### 2. The Claude-only hook goes

`.claude/hooks/fallow-gate.sh`, its test `.claude/hooks/fallow-gate.test.ts`, and the `PreToolUse`
entry that runs it in `.claude/settings.json` are deleted. A Claude session's `git commit` goes
through the git hook like everyone else's, so the audit is not run twice. The `SessionStart`
briefing hook stays. The cases the old test covered that still apply (the worktree is audited, a
missing binary is named) move to the new hooks' tests.

### 3. `quick`: CI on every pull request `checks` does not grade

A new workflow, `.github/workflows/quick.yml`, with one job, `quick`:

- **Runs on** every pull request event (opened, pushed to, reopened, ready for review) whose pull
  request is a **draft**, or whose **base is not `main`** (a sub-PR into a feature branch, a slice,
  a rework). A ready pull request into `main` is graded by `checks`, unchanged, and `quick` skips.
- **Skips** a phase-0 pull request (head `docs/phase-0-*`, `branches.phase0`): it carries only a
  PRD's docs, and the omni-loop App's inbox check grades it, as today. A pull request that changes
  only `**/*.md` or `docs/**` skips through the settle gate, as `checks` does.
- **Waits** through the same `settle` gate as `checks` (`scripts/settle-head.sh`, 30 s), with a
  concurrency group of its own (`quick-<head branch>`), so a burst of pushes costs one run.
- **Does:** `pnpm install --frozen-lockfile`, then `pnpm check:changed --base origin/<base branch>`:
  typecheck, lint of the changed files, `vitest related` (or the whole suite when a shared file
  changed) and the fallow audit, all four steps.
- It is one check, `quick`, on the pull request. The `checks` jobs and `scripts/settle-head.sh`
  do not change.

### 4. The knowledge says what is true

- The verification form: "A commit hook runs …" now names the two hooks and what each runs. "A
  sub-pull request runs no CI, so these are its only grade" becomes: a sub-PR is graded by `quick`,
  and the full `pnpm test` and `pnpm lint` before it is marked ready still apply, since `quick` runs
  only what changed. The note that the commit hook audits the main checkout goes.
- The CI form: a row for `quick` in the workflows table, the "A draft runs no CI, and neither does a
  sub-pull request" paragraph rewritten, and the paragraph on the Claude session's fallow audit
  replaced by the git hooks.
- `AGENTS.md`'s Setup section says `pnpm install` installs the hooks. The `session` context budget
  (9 KB) holds: trim, never raise.

## Decisions

- **D1. Plain `core.hooksPath`, no hook manager.** Husky, lefthook and simple-git-hooks would each
  add a dependency to do what one `git config` line does. Reversible: delete `.githooks/` and the
  `prepare` line.
- **D2. The push hook runs typecheck and lint only; tests run in `quick`.** Taken from
  persona:Lead Engineer's objection to the design: "If the push hook ever costs minutes, my
  engineers will learn `--no-verify` and the gate protects nothing. Keep it to seconds." Settled
  **accepted**: `check:changed` can reach the whole test suite (about 2.5 min) when the lockfile
  changes, so the tests moved to CI.
- **D3. This repository only.** Shipping the hooks and `quick` to every repository the kit installs
  in is a later PRD, once they have run here. The kit's `omni init` changes nothing.
- **D4. Phase-0 pull requests stay out of `quick`.** The idea named them. They are docs-only, `checks`
  already excludes them by their head, and the App's inbox check grades them, so `quick` would run an
  install to find nothing to check.
- **D5. The hooks fail closed, a fallow runtime error included.** `fallow-gate.sh` fails open on a
  runtime error so that a fallow bug never blocks work. Here `--no-verify` is the way past a broken
  tool, and its use is stated in the pull request: a gate that opens by itself is how the old one
  came to protect nothing. Reversible in one line of each hook.
- **D6. `quick` is a workflow of its own, not a job in `checks.yml`.** `checks` has a tested shape
  (`scripts/checks-workflow.test.ts`) and its own concurrency rules (issue 1167); a separate file
  changes neither.
- **D7. No proof video.** Nothing here shows in a browser (asked 2026-10-13, answered no).
- **D8. Complements PRD 1739.** PRD 1739 (shipped) made the kit's defaults agent-agnostic and left
  the plugin's hooks to a follow-up. These git hooks are this repository's own gate, below any
  agent; they replace no hook of the kit's plugin.

## User stories

- As an agent other than Claude (Codex, Cursor), when I commit a change that adds an unused export,
  git refuses it and names the finding, as it would for Claude.
- As a person committing by hand, I get the same gate as the agents, in under a second for a commit
  and about ten seconds for a push.
- As a wave's lead agent, a sub-PR I am about to merge into the feature branch carries a green or
  red `quick` check, not only its builder's word.
- As a reviewer, a draft feature PR shows a `quick` check on every push, before anyone marks it
  ready.
- As anyone whose tool install is broken, the hook tells me what is missing and how to fix it,
  instead of letting my change through unchecked.

## Scope

**In:** `.githooks/pre-commit`, `.githooks/pre-push`, the installer and the `prepare` script, a
step filter on `check:changed`, `.github/workflows/quick.yml`, deleting the Claude fallow hook and
its settings entry, the verification and CI forms, `AGENTS.md`, and tests for each.

**Out:** making `quick` or `checks` required on `main` (a GitHub branch-protection setting a person
turns on); shipping hooks through the kit (D3); changes to `checks.yml` or `settle-head.sh`; e2e
tests (PRDs 1277–1279); coverage and mutation on pull requests (a later PRD).

## Test seams

Read with `omni kb show testing`: vitest, next to the code, never calling GitHub.

- **The installer:** run it in a temporary git repository and assert `core.hooksPath`; run it in a
  temporary folder that is not a git work tree and assert it exits 0 and prints its skip line.
- **The hooks:** run each hook script in a temporary git repository with a stub `fallow` and a stub
  `pnpm` on `PATH` (as `fallow-gate.test.ts` stubs fallow today): the stub's failure refuses, its
  success passes, a missing stub refuses with the "run pnpm install" line, and a commit in a
  `git worktree` runs the audit from that worktree's root.
- **`check:changed`'s step filter:** unit tests in `scripts/check-changed.test.ts` on the planned
  steps (`planChecks`) for the subset the push hook asks for.
- **`quick.yml`:** read and parsed like `scripts/checks-workflow.test.ts` reads `checks.yml`: its
  trigger, its `if` (draft or base not `main`, never a `docs/phase-0-` head), its `needs: settle`,
  its concurrency group, and its run step naming `check:changed --base`.
- **Settings:** a test that `.claude/settings.json` holds no `PreToolUse` entry naming
  `fallow-gate.sh` and that the file is gone.

## Risks

Read with `omni kb show releasing`. Merging publishes no app and no data: it changes how commits,
pushes and pull requests are checked in this repository.

- **A hook that blocks wrongly stops everyone.** Fail-closed (D5) means a fallow or tsgo fault
  blocks commits until fixed. `--no-verify` is the hatch; rollback is reverting this PRD's feature
  PR, or `git config --unset core.hooksPath` on one machine.
- **CI minutes.** `quick` runs on every push to a draft or sub-PR, behind the 30 s settle. A wave of
  five slices pushing a few times each adds a few runs of about 3–5 minutes (install plus changed
  checks). Watched through the Actions usage page after the first wave; the settle wait is the
  knob.
- **Push hook on a branch with no upstream.** It falls back to `origin/main`, which may be stale on
  a machine that has not fetched: the typecheck covers the whole project anyway, and lint may check
  more files than changed, never fewer.

Rollback: revert the feature PR. Each machine that installed the hooks keeps `core.hooksPath`
pointing at a folder that no longer exists, which git treats as no hooks.

## Acceptance criteria

1. After `pnpm install` in a clone of this repository, `git config core.hooksPath` prints
   `.githooks`. `pnpm install` outside a git work tree exits 0 with one skip line.
2. A commit that adds a fallow finding beyond the baselines (an unused export) is refused by git,
   naming the finding, whichever agent or person runs `git commit`.
3. A commit in a `git worktree` is audited against that worktree's files.
4. With fallow unreachable, `git commit` is refused with one line naming fallow and `pnpm install`;
   `jq` plays no part.
5. A push whose changed TypeScript fails `pnpm typecheck` or lint is refused; a push with nothing
   wrong passes, in about ten seconds on this repository.
6. A draft pull request into `main`, and a pull request into a feature branch, each get a `quick`
   check that goes red when a test related to a changed file fails, and green otherwise.
7. A ready pull request into `main` gets `checks` and its `quick` reports skipped. A phase-0 pull
   request and a docs-only pull request run neither `quick`'s install nor its checks.
8. `.claude/hooks/fallow-gate.sh`, its test, and its `PreToolUse` entry in `.claude/settings.json`
   are gone, and a Claude session's `git commit` is still audited, by the git hook.
9. The verification form, the CI form and `AGENTS.md` describe the two hooks and `quick`; no line
   says a sub-pull request runs no CI or that a commit hook audits the main checkout.
   `node .omni-loop/bin/omni.mjs check` is green, `session` under its 9 KB ceiling.
