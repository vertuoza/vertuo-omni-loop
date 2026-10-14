# Plan: omni runner hands the Claude token to its jobs

PRD #1894, spec beside this plan (`spec.md`). The feature branch `feat/runner-claude-token` merges
into `main` through the feature PR (`Closes #1894`); the one slice is a sub-PR from
`feat/runner-claude-token--s1` into the feature branch (`Part of #1894`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Jobs get `CLAUDE_CODE_OAUTH_TOKEN` when the runner has it: the env group, `jobEnv`, their tests and the README line | `kit/lib/env/read` `kit/bin/commands/runner` `kit/README.md` | — | 1 |

**Shared ground.** One slice, so none. `kit/dist/` is built: the slice rebuilds it only to test, and
the wave rebuilds it once after merging.

## Per slice: done when

**s1**
- `kit/lib/env/read.ts` reads `CLAUDE_CODE_OAUTH_TOKEN` as `vars.claudeToken` (a string, or `null`
  when unset or blank), listed in `PLATFORM_VARIABLES`; `read.test.ts` covers set, unset and blank.
- `jobEnv` adds `CLAUDE_CODE_OAUTH_TOKEN` to each job's session when it is set, and nothing when it
  is not. `runner.test.ts`, through `main()` with the fake terminal, shows both, and that no line the
  runner prints holds the token.
- The kit README's runner section, under **What it needs**, says to export `CLAUDE_CODE_OAUTH_TOKEN`
  from `claude setup-token` on a headless server.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` green.
