# Plan: Targets declare a setup command

PRD #1804, built from the spec beside this plan (`spec.md`). The feature branch `feat/target-setup`
merges into `main` through the feature PR ("Closes #1804"); each slice is a sub-PR from
`feat/target-setup--<slice>` into the feature branch ("Part of #1804").

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `commands.setup` exists in the config (default `null`) and `omni init` proposes it from the lockfile, asks for it and takes it as a flag, and writes it into the config it creates | `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/init/` `kit/bin/commands/init.ts` `kit/bin/init.test.ts` | — | 1 |
| s2 | The multi-repository skills run a target's committed setup before its committed preflight, in the same worktree; a red setup holds the slice or target as stuck; the guards, `omni help` and the guide say the same | `kit/plugin/skills/do-work/` `kit/plugin/skills/ultra-wave/` `kit/plugin/skills/ultra-yolo/` `kit/plugin/skills/ultra-yolo-fix/` `kit/plugin/skills/mega-bug-fix/` `kit/plugin/skills/mega-pr-care/` `kit/plugin/skills/mega-drive/` `kit/test/plugin.test.ts` `kit/lib/help/entries.ts` `kit/bin/help.test.ts` `docs/guide/several-repositories.md` | — | 1 |

No prefix is declared by both slices, so they share no ground. `kit/dist/` is rebuilt once on the
feature branch after the wave merges.

## Per slice: done when

**s1**
- `omni config commands.setup` prints the committed command, and `null` when the key is absent; a
  non-text value is refused (`kit/lib/config.test.ts`).
- `detectCommands` returns, for each lockfile, the command in the spec's table; the first wins in
  the spec's order; no lockfile returns `null`.
- `omni init` writes `setup:` under `commands` in the config it creates, asks for it when it cannot
  detect it, and takes it as a flag beside `--test` and `--preflight` (`kit/bin/init.test.ts`).

**s2**
- `/omni:do-work`'s **Under `--target <name>`** says the target's committed setup runs, when it has
  one, in the slice's worktree before its committed preflight, both read from the target's default
  branch.
- `/omni:ultra-wave`, `/omni:ultra-yolo`, `/omni:ultra-yolo-fix`, `/omni:mega-bug-fix` and
  `/omni:mega-pr-care` say the same wherever they run a target's preflight; `/omni:mega-drive`'s
  summary names it.
- Each says a red setup holds its slice or target as stuck, quoting the failing line, counting
  toward no attempt, never editing the target to make it pass; a target with no preflight still
  runs nothing, and one with no setup runs its preflight alone.
- The guardrails still forbid any command in a target beyond its committed setup and preflight, and
  `kit/test/plugin.test.ts` requires those words, with setup before preflight.
- `omni help`'s entries for those skills and `docs/guide/several-repositories.md` name the setup.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.
