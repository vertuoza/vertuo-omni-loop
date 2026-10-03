# Plan: Parsed environment

PRD #1059, specified in `spec.md` beside this plan. Built on the feature branch `feat/parsed-env` into
`main` (the feature PR says `Closes #1059`), from sub-PRs on `feat/parsed-env--<slice>` into the feature
branch (each says `Part of #1059`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `kit/lib/env/` holds the shared helpers (a feature group complete or `null`, one error naming every variable and no value) and the kit, game and scripts module; the kit, the game and the scripts read their environment through it, each command checking what it needs at its entry; the bundle is rebuilt | `kit/` `game/` `scripts/` `.omni-loop/bin/` | — | 1 |
| s2 | The GitHub App reads its environment through `apps/omni-app/src/env.ts`, parsed when `api/github.ts` and `api/inngest.ts` load, with the webhook secret and the GitHub App's id and key required in production | `apps/omni-app/` | s1 | 2 |
| s3 | The arcade reads its environment through `apps/galaxy/src/env.ts` (server, parsed by a new `instrumentation.ts`) and `env.client.ts` (literal `NEXT_PUBLIC_*` reads), `arcadeMode` included, and its `.env.example` lists exactly what the schema reads | `apps/galaxy/` | s1 | 2 |
| s4 | `scripts/env-guard.test.ts` refuses `process.env` outside the env modules; a docs check proves every `.env.example` and README variable list matches the schemas, and the lists are fixed; a decision record and the `conventions` form tell agents the rule | `scripts/` `kit/` `game/` `apps/` `README.md` `.omni-loop/knowledge/adr/` `.omni-loop/knowledge/playbook/conventions.md` | s2, s3 | 3 |

**Shared ground.** `scripts/`, `kit/` and `game/` are s1's and s4's (s4 adds the guard in `scripts/` and
fixes any leftover read it finds): waves 1 and 3. `apps/` is s2's and s3's by app, and s4's for the READMEs
and leftovers: waves 2 and 3. s2 and s3 share nothing, so they run together.

## Per slice: done when

**s1**

- `kit/lib/env/` exports the helpers the other modules use: a group schema that gives a complete typed
  group, `null` when none of its variables is set, and a problem naming every variable when it is
  half-set or malformed; one error carrying every problem, with no value in its text (a test with a fake
  secret proves it).
- The kit, game and scripts module's `readEnv(source)` gives their groups (`openrouter`, `proof`, the
  terminal and CI values, the workspace, the Supabase pair); `kit/bin/omni.ts` `main()` parses once and
  passes groups on; a command missing what it needs (`OMNI_LOOP_WORKSPACE` without `--workspace`, the
  Supabase pair for `schemas:verify` and `personas-import`) exits non-zero naming the variable before any
  work.
- Passing the environment to a child process (`GH_TOKEN`, `GIT_TERMINAL_PROMPT`, `FALLOW_AUDIT_BASE`)
  happens inside the module, with the reason beside it.
- No `process.env` in `kit/`, `game/` or `scripts/` outside the module (the guard comes in s4; the sub-PR
  says the count is 0).
- The bundle is rebuilt and its dist test passes; command output is unchanged where the environment is
  complete.

**s2**

- `apps/omni-app/src/env.ts` `readEnv(source)` gives the GitHub App's groups (the webhook secret, the
  GitHub App's id and key, Supabase, OpenRouter, the stage and judge secrets, `GALAXY_URL` with its
  default); in production the webhook secret and the id and key are required.
- `api/github.ts` and `api/inngest.ts` parse at module load; a test proves a broken environment throws
  the named error there. The Inngest SDK's own variables stay its, with the reason beside them.
- `CanonEnvSchema`, `StoreEnvSchema` and `requiredEnv` are replaced by the module's groups; code takes the
  group it needs; tests pass objects.
- No `process.env` in `apps/omni-app` outside `env.ts`.

**s3**

- `apps/galaxy/src/env.ts` `readEnv(source)` gives the arcade's groups and its `mode`, with
  `arcadeMode`'s existing cases unchanged; `instrumentation.ts`'s `register()` parses once on the server,
  and a test proves a broken environment throws the named error there.
- `env.client.ts` holds the only client reads, literal `process.env.NEXT_PUBLIC_*`, and parses them.
- With nothing set, development serves the demo and production the closed mode; every optional feature
  is off when its variables are unset.
- The 7 `vi.stubEnv` uses and the direct `process.env` writes in tests become passed objects.
- `apps/galaxy/.env.example` lists exactly the variables the schemas read.
- No `process.env` in `apps/galaxy` outside `env.ts` and `env.client.ts`; `next build` passes.

**s4**

- `scripts/env-guard.test.ts` walks every source file (tests and generated files exempt) and fails on a
  `process.env` member read, index, spread or pass outside the env modules, naming file and line; no
  comment escape. Its fixtures flag those forms and pass the env modules and `env.client.ts`.
- A docs check fails when an `.env.example` or README variable list and the schemas differ either way;
  the root, `apps/omni-app`, `apps/galaxy` and `game` lists are fixed to pass.
- A decision record under `.omni-loop/knowledge/adr/` and `omni kb show conventions` say: the
  environment is read through the runtime's env module, as feature groups.
- `pnpm typecheck`, `pnpm typecheck:tsc`, `pnpm test`, `pnpm lint` (0 findings), the fallow audit and
  `omni check all` pass.
