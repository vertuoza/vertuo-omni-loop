---
prd: 1059
title: Parsed environment
blocked-by: none
spec: file
---

# Parsed environment

**Date:** 2026-10-03 · **PRD:** #1059 · **Follows:** PRDs 1030 (no escape hatches) and 1049 (branded
IDs, which this was split from) · **Touches:** a new `kit/lib/env/`, `apps/omni-app/src/env.ts`,
`apps/galaxy/src/env.ts`, `env.client.ts` and `instrumentation.ts`, every environment read in `kit/`,
`game/`, `scripts/`, `apps/omni-app` and `apps/galaxy`, the `.env.example` and README variable lists,
and a new guard · **Out of scope:** adding or removing a variable, any feature's behaviour when its
configuration is complete, the deployment settings themselves.

## Problem

Measured on `main` on 2026-10-03: the code reads its environment raw about 83 times, 32 distinct
variables, in four runtimes: the arcade's server code 57 times in 47 files, the GitHub App 10, the kit 7,
the game 5 and the scripts 4 (the arcade's client reads two `NEXT_PUBLIC_*` values, inlined at build).

- **Nothing fails at startup.** The three zod environment schemas that exist (`CanonEnvSchema`,
  `StoreEnvSchema`, `SupabaseEnv`) are loose and all-optional; `requiredEnv` in the GitHub App throws
  only at first use. A missing webhook secret silently refuses every delivery.
- **Half-set pairs fail silently.** A Supabase URL without its key, a GitHub App id without its private
  key, a client id without its secret: each turns its feature off, or fails deep in a request, with
  nothing naming the variable.
- **Malformed values reach the code:** nothing checks that a URL is a URL.
- **The docs drift:** `apps/galaxy/.env.example` lists 12 variables and misses 5 the code reads.

Most variables are optional on purpose: unset, a feature is off (OpenRouter, the proof, the shared
secrets), and the arcade has a closed mode and a demo mode with no Supabase at all. A check that required
everything would break development, the demo, previews and tests.

## Solution

1. **One environment module per runtime,** each exporting `readEnv(source)`, a pure function from a
   plain object to typed **feature groups**: a group is complete, or `null` when none of its variables is
   set (the feature is off).

   | runtime | module | parsed at |
   |---|---|---|
   | the kit, the game, the scripts (one package) | `kit/lib/env/` | `main()` and each command's entry |
   | the GitHub App | `apps/omni-app/src/env.ts` | module load of `api/github.ts` and `api/inngest.ts` |
   | the arcade, server | `apps/galaxy/src/env.ts` | a new `instrumentation.ts`, Next's `register()`, once per server |
   | the arcade, client | `apps/galaxy/src/env.client.ts` | build, from literal `process.env.NEXT_PUBLIC_*` reads, which Next inlines |

   Platform values come out typed too: the arcade's `mode` (`supabase`, `demo` or `closed`, today's
   `arcadeMode` rule unchanged) and whether the runtime is in production.
2. **What fails, at startup, in one error naming every variable concerned** (never a value):
   - a set value that is malformed (a URL that is not a URL, an id that is not a number);
   - a half-set group (one of its variables set, another not);
   - in the GitHub App in production: the webhook secret, or the GitHub App's id and private key,
     missing;
   - in the kit, the game and the scripts: what the command being run needs (the workspace without
     `--workspace`, the Supabase pair for `schemas:verify` and `personas-import`), before any work.

   Everything else unset stays off, as today: the closed and demo modes and every optional feature work
   as they do.
3. **Code takes the group it needs as a parameter,** as the kit already takes `env`; `null` is "off" in
   the types. Passing the environment on to a child process (`GH_TOKEN`, `GIT_TERMINAL_PROMPT`,
   `FALLOW_AUDIT_BASE`) and the variables the Inngest SDK reads itself stay, inside the env modules, with
   the reason beside them.
4. **The guard,** `scripts/env-guard.test.ts`, like the other source guards: no `process.env` (a member
   read, an index, a spread or the object passed on) outside the env modules, tests and generated files
   exempt, no comment escape.
5. **The docs check:** every `.env.example` and README variable list names exactly the variables the
   schemas read; the lists are fixed to match.
6. **Agents are told:** a decision record and the playbook's `conventions` form.

## Decisions

Taken in the brainstorm on 2026-10-03 with the person who asked for this PRD.

- **Split from branded IDs** (PRD 1049): they share no code.
- **What fails at startup:** the production-required set, malformed values and half-set pairs. Over
  "everything, strictly in production" (an optional feature could no longer be off in production
  without a code change) and "typed access only" (no startup guarantee).
- **Feature groups,** each complete or `null`, over a flat object of optional strings: a pair is then
  whole or absent in the types, and every caller handles "off".
- **The arcade gets `instrumentation.ts`:** it has no startup hook today.
- **No proof video:** nothing visible changes.
- **The voice.** B-E DEv objected that a startup check throwing in production takes the whole function
  down for one typo, and wanted the error to name the variable and the deploy to show it. Settled
  `none`: the person approved the design as shown, which names every variable and never a value.

## User stories

1. As the person deploying, a half-set pair or a malformed value fails the deployment's startup with the
   variable's name, not a blank error in a request an hour later.
2. As an agent adding a feature that needs a variable, I add it to the runtime's schema and its docs, and
   the code gets a typed group; the guard refuses a raw `process.env` read.
3. As an agent writing a test, I pass a plain object to `readEnv` or a group to the code, and never touch
   the process environment.
4. As a developer running the arcade locally, the demo and closed modes work with nothing set, as today.

## Scope

In:

- `kit/lib/env/` (shared helpers and the kit, game and scripts module), the GitHub App's and the arcade's
  modules, the arcade's `instrumentation.ts`, and their tests.
- Every environment read in `kit/`, `game/`, `scripts/`, `apps/omni-app` and `apps/galaxy` moved to them.
- `scripts/env-guard.test.ts`, the docs check, the `.env.example` and README variable lists.
- A decision record and the `conventions` form.

Out:

- Adding, removing or renaming a variable; deployment settings.
- A feature's behaviour when its configuration is complete.
- `packages/` (no environment reads).

## Test seams

- **`readEnv`, on plain objects, per runtime:** a complete group comes back typed; an empty group is
  `null`; a half-set group throws naming both variables; a malformed value throws naming it; a missing
  production-required group throws in production and not elsewhere; the error never holds a value (a
  fake secret proves it).
- **Today's behaviour, pinned:** `arcadeMode`'s existing cases give the same mode; the demo and closed
  modes work with no Supabase; every optional feature is off when its variables are unset.
- **Startup:** the arcade's `register()` and the GitHub App's module-load parse throw the named error on a
  broken environment; a kit command missing what it needs exits non-zero naming the variable, before any
  work.
- **The guard,** on fixture sources: it flags `process.env.X`, `process.env[name]` and `{...process.env}`
  outside an env module, passes the env modules and `env.client.ts`'s literal `NEXT_PUBLIC_*` reads, and
  passes on the whole tree.
- **The docs check:** a variable read but not listed fails it, and the reverse.
- Tests pass plain objects, never mutate `process.env`; the repository's testing form holds.

## Risks

Merging rebuilds the kit's bundle and deploys the arcade and the GitHub App. A deployment whose
configuration is broken today in a way nothing noticed (a half-set pair, a malformed URL, the GitHub App
in production without its secret) now fails at startup, naming the variable: that is the intent, and the
fix is the deployment's setting, not the code. Before merging, the production and preview settings of
both apps are checked against the schemas. Nothing is stored and no migration runs.

**Rollback:** revert the feature PR. The guard can also be reverted alone.

## Acceptance criteria

- Each runtime has one env module whose `readEnv` returns typed feature groups, each complete or `null`.
- A half-set group, a malformed value, or (in the GitHub App in production) a missing webhook secret or
  GitHub App id and key fails at startup with one error naming every variable concerned and no value.
- With nothing set, the arcade serves its demo (development) or closed (production) mode, and every
  optional feature is off, as today.
- No source file outside the env modules reads `process.env`, and the guard proves it on every source
  file.
- Every `.env.example` and README variable list names exactly the variables the schemas read, and a check
  proves it.
- `pnpm typecheck`, `pnpm typecheck:tsc`, `pnpm test`, `pnpm lint` (0 findings), the fallow audit and the
  arcade's `next build` pass.
- `omni kb show conventions` tells agents to read the environment through the runtime's env module.
