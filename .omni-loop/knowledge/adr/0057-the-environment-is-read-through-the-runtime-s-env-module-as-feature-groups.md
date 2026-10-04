# ADR-0057 — The environment is read through the runtime's env module, as feature groups

**Status:** accepted · **Date:** 2026-10-03 · **PRD:** #1059

## Context

The code read its environment raw about 83 times, 32 distinct variables, in four runtimes. Nothing
failed at startup: a half-set pair (a Supabase URL without its key, a GitHub App id without its
private key) turned its feature off or failed deep in a request, a malformed URL reached the code,
and the docs drifted (`apps/galaxy/.env.example` missed 5 of the variables the arcade read). PRD 1059
gave each runtime one env module and moved every read into it. Without a guard, the next agent
writes `process.env.X` again.

## Decision

1. **One env module per runtime,** each exporting `readEnv(source)`, a pure function from a plain
   object to typed **feature groups**, built from the helpers in `kit/lib/env/group.ts`:

   | runtime | module |
   |---|---|
   | the kit, the game, the scripts | `kit/lib/env/read.ts` |
   | the GitHub App | `apps/omni-app/src/env.ts` |
   | the arcade, server | `apps/galaxy/src/env.ts` |
   | the arcade, browser | `apps/galaxy/src/env.client.ts` (literal `process.env.NEXT_PUBLIC_*`, which Next inlines) |

2. **A group is complete, or `null`** when none of its variables is set: the feature is off, and the
   types make every caller handle it. A half-set group or a malformed value is one `EnvError` at
   startup naming every variable concerned, never a value.
3. **Code takes the group it needs as a parameter;** tests pass plain objects to `readEnv`, or a
   group to the code, and never write `process.env`. The kit's `askModel` and `classifyCandidate`
   take the `openrouter` group, never a raw environment.
4. **Only the env modules touch `process.env`.** `scripts/env-guard.test.ts` reads the syntax tree of
   every source file (tests and generated files exempt, as the ID guard chooses them) and fails on any
   access outside the four modules above, naming the file and line: a member read, an index, a
   spread, the object passed or assigned, `env` destructured from `process` or imported from
   `node:process`. A string or a comment is text, not a read: a generated shell script that spells
   `process.env`, or a bundler's `define` key, passes. No allowlist beyond the modules, no comment
   escape.
5. **What a module reads beyond its groups is named in it:** the values a platform sets
   (`PLATFORM_VARIABLES`: `NODE_ENV`, `NEXT_PHASE`, `NEXT_RUNTIME`, `VERCEL_ENV`, `COLUMNS`,
   `NO_COLOR`, `GITHUB_OUTPUT`, `npm_execpath`…) and the ones an SDK reads itself (`SDK_VARIABLES`:
   the Inngest SDK's `INNGEST_*`). Passing the environment on to a child process (`GH_TOKEN`,
   `GIT_TERMINAL_PROMPT`, a check step's variables) happens inside the module, with its reason.
6. **The docs list exactly what is read.** Each module exports `VARIABLES`, derived from its groups.
   The docs check (`kit/lib/env/docs.ts`) compares it, both ways, with `apps/galaxy/.env.example`
   (every `NAME=` line) and with each README's one marked list: the backticked names between
   `<!-- omni:env-variables -->` and `<!-- /omni:env-variables -->` in `README.md` (the kit's),
   `game/README.md` (the game's groups), `apps/omni-app/README.md` (with the SDK's) and
   `apps/galaxy/README.md`. Each runtime runs it on its own docs (`scripts/env-docs.test.ts`,
   `apps/omni-app/src/env-docs.test.ts`, `apps/galaxy/src/env-docs.test.ts`), so no file imports two
   runtimes' modules. Platform values are listed nowhere.

## Consequences

- A deployment whose configuration is half set or malformed fails at startup naming the variable;
  the fix is the deployment's setting.
- A new variable is a member of a group in the runtime's module, a line in its docs list, and a typed
  value for the code that needs it; a raw read fails `pnpm test` with the file and line.
- A new runtime needs its own env module, added to the guard's list, and its own docs check.
- The guard reads `process` by name: a value aliased from `process` under another name
  (`const p = process; p.env`) is not read. Review is where such an alias is caught.
