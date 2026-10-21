---
prd: 1894
title: omni runner hands the Claude token to its jobs
blocked-by: none
spec: file
phase0: server
---

# omni runner hands the Claude token to its jobs

**Date:** 2026-10-14 · **PRD:** #1894 · **After:** PRD 1830 (runners), ADR-0057 (the environment is
read in one module) · **Touches:** `kit/lib/env/read.ts` and its test, `kit/bin/commands/runner.ts`
and its test, the kit README's runner section.

## Problem

A server that runs jobs unattended signs Claude in with `claude setup-token`, which gives a token
meant to be set as `CLAUDE_CODE_OAUTH_TOKEN`. `omni runner` starts each job in its own tmux session
and gives that session only `PATH` and `OMNI_TOKEN` (`jobEnv` in `kit/bin/commands/runner.ts`). A
tmux session takes the rest of its variables from the tmux server, not from the runner. So a runner
started with `CLAUDE_CODE_OAUTH_TOKEN` set runs jobs that never see it: Claude falls back to its
stored sign-in, and when that has expired the job fails with "OAuth session expired". On
nimbus-agents, on 2026-10-14, that is how the first `/omni:pr-care` job ended. The start script now
works around it with `tmux set-environment -g CLAUDE_CODE_OAUTH_TOKEN …`.

## Solution

- `kit/lib/env/read.ts` gains a `CLAUDE_TOKEN` group: one optional variable,
  `CLAUDE_CODE_OAUTH_TOKEN`, read as `vars.claudeToken` (a string, or `null` when unset or blank).
  It is listed in `PLATFORM_VARIABLES`, beside the other variables a person or a platform sets and
  no docs page names, and its value is never printed.
- `jobEnv` adds `CLAUDE_CODE_OAUTH_TOKEN` to each job's session when `vars.claudeToken` is set. Unset,
  the session gets exactly what it gets today, and Claude in the job uses its stored sign-in.
- The kit README's runner section says, in **What it needs**: on a server signed in with
  `claude setup-token`, export `CLAUDE_CODE_OAUTH_TOKEN` before `omni runner`, and its jobs get it.

`ANTHROPIC_API_KEY` is not passed: a job must never start billing an API key nobody chose for it.

## Decisions

- **Only the OAuth token** (the person's answer to the design): `CLAUDE_CODE_OAUTH_TOKEN` alone, never
  `ANTHROPIC_API_KEY`.
- **Read in the env module** (ADR-0057): the runner reads `vars.claudeToken`, never `process.env`.
- **The voice's objection, accepted as a written risk.** Lead Engineer: the token goes into the tmux
  command line, so anyone on the box can see it in `ps` for a moment. It travels the way `OMNI_TOKEN`
  already does, and a runner's box has one user; it is named under **Risks**.
- **No proof video** (the person's answer).

## User stories

1. As the person running `omni runner` on a headless server, I export `CLAUDE_CODE_OAUTH_TOKEN` from
   `claude setup-token`, start the runner, and every job signs in to Claude with it.
2. As the same person, with no token set, my jobs keep using Claude's stored sign-in, as today.

## Scope

In: the env group, `jobEnv`, their tests, and the README line.

Out: any other variable passed to jobs, refreshing or checking the token, and the start script on
nimbus-agents, which is the infrastructure repository's and drops its workaround after this ships.

## Test seams

Every test runs on fixtures: none calls Claude, GitHub or the Omni page (testing playbook).

| risk | test |
|---|---|
| the variable read as a token, or as none | `kit/lib/env/read.test.ts`: set, unset, blank, and listed in `PLATFORM_VARIABLES` |
| the job's session gets the token only when it is set | `kit/bin/commands/runner.test.ts`, through `main()` with the fake terminal: the started session's `env` carries `CLAUDE_CODE_OAUTH_TOKEN` when it is set, and has no such key when it is not |
| the value never printed | the same runner test: nothing the runner prints holds the token |

## Risks

- **What merging publishes:** the next kit release carries it; the runner on nimbus-agents picks it
  up after a `git pull` and a restart.
- **The token on the command line:** tmux receives each session variable as an argument, so the token
  shows in `ps` on the box for the instant tmux starts, as `OMNI_TOKEN` already does. A runner's box
  has one user, `agent`.
- **Rollback:** revert the pull request; the start script's `tmux set-environment` line works again.
- The locked laws: none touched.

## Acceptance criteria

1. With `CLAUDE_CODE_OAUTH_TOKEN` set when `omni runner` starts, every job's tmux session is started
   with `CLAUDE_CODE_OAUTH_TOKEN` set to the same value.
2. With it unset or blank, the session is started with only `PATH` and `OMNI_TOKEN`, as today.
3. The runner never prints the token, in any line.
4. The kit README's runner section says to export `CLAUDE_CODE_OAUTH_TOKEN` from
   `claude setup-token` on a headless server.
5. On nimbus-agents, with the `tmux set-environment` line removed from the start script, a job sent
   from the app signs in to Claude and runs.
