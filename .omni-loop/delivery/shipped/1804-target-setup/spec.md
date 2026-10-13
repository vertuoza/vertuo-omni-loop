---
prd: 1804
title: Targets declare a setup command, run before their preflight
blocked-by: none
spec: file
phase0: server
---

## Problem

In a plan repository, the multi-repository skills (`/omni:ultra-wave`, `/omni:ultra-yolo`,
`/omni:ultra-yolo-fix`, `/omni:mega-bug-fix`, and `/omni:do-work` under `--target`) run exactly one
command in a target beyond `git` and `gh`: its own committed preflight. They never install. But
every slice is built in a fresh worktree of the target's clone, where no dependency is installed,
so the preflight of any target that needs one (`node_modules`, `vendor/`) fails before a single
test runs. `/omni:ultra-yolo` step 4 then says "red for want of an install: name it as a human step
and let its CI decide": the local check is lost, and a person installs by hand or waits on CI.

The rule against installing exists for a reason: an install runs the target's lifecycle scripts, so
the kit runs only what the target's own team committed. The fix keeps that reason and gives the team
a place to commit its install.

## Solution

1. **A new optional key, `commands.setup`,** in `.omni-loop/config.yml`, beside `preflight`
   (`kit/lib/config.ts`, the `commands` section): a command that prepares a fresh checkout to run
   the preflight, as `pnpm install --frozen-lockfile`. It defaults to `null`.
2. **`omni init` proposes it** from the lockfile, in `kit/lib/init/detect.ts`, beside `test` and
   `preflight`, and writes it into the config it creates (`kit/lib/init/config-text.ts`):

   | lockfile | `setup` |
   |---|---|
   | `pnpm-lock.yaml` | `pnpm install --frozen-lockfile` |
   | `yarn.lock` | `yarn install --immutable` |
   | `bun.lock` or `bun.lockb` | `bun install --frozen-lockfile` |
   | `package-lock.json` | `npm ci` |
   | `composer.lock` | `composer install` |
   | none of them | `null` |

   The first that exists wins, in that order. It is a proposal in the config the team reviews and
   commits, never a command the kit runs on its own.
3. **The multi-repository skills run it.** Wherever a target's preflight is about to run, in the same
   worktree, the target's committed `commands.setup` runs first, when it has one:
   - `/omni:do-work` **Under `--target <name>`**: in the slice's worktree, before the preflight.
   - `/omni:ultra-wave`: the target's check after the wave's merges.
   - `/omni:ultra-yolo` step 4 item 2, and `/omni:ultra-yolo-fix` where it runs a target's preflight.
   - `/omni:mega-bug-fix`: before each preflight that proves red and green.
   - `/omni:mega-pr-care`: before the preflight of its fix loop on a target PR.

   `/omni:mega-drive`'s summary of the rule, `omni help`'s entries that state it
   (`kit/lib/help/entries.ts`) and the guide's page on several repositories
   (`docs/guide/several-repositories.md`) say the same.

   It is read exactly as the preflight is: from the target's `.omni-loop/config.yml` on its default
   branch, never from a slice branch and never from an imported copy's playbook.
4. **The rule's words change** from "the one command ever run beyond `git` and `gh` is its own
   committed preflight" to "the only commands ever run beyond `git` and `gh` are its own committed
   setup, then its own committed preflight". "Never install in a target" becomes "never install in a
   target beyond its committed setup".
5. **A target without a preflight runs nothing,** its setup included: CI stays its check, as today.
   **A target without a setup** runs its preflight alone, as today.

## Decisions

- **Targets only** (asked, answered): the key is read only by the multi-repository skills. The
  kit's own-repository flows (`/omni:wave`, `/omni:do-work` without `--target`, `/omni:bug-fix`)
  are unchanged: there an agent already follows the `setup` playbook form.
- **A setup that fails holds that slice, or that target's finish, as stuck,** quoting its failing
  line. It counts toward no `limits.attempts`, and the agent never edits the target to make it pass:
  a broken install belongs to the target's team. (Taken with the design; the most reversible choice.)
- **Setup runs in every worktree where a preflight runs,** not once per clone: each slice's worktree
  is fresh, so a clone-wide install would leave it empty.
- **The name `setup`** matches the playbook form an agent reads for the same job in its own
  repository.
- **The voice's objection** (persona:Lead Engineer, below) was answered by the design as approved: a
  setup runs only when the target's team committed it, and `omni init` only proposes one. Settled:
  `none`, the person approved without changing the design.

## User stories

- As a PM running `/omni:ultra-yolo` on a PRD that spans a front-end and a back-end, I see each
  target's preflight run green locally, without installing anything by hand.
- As the lead engineer of a target, I choose whether the kit may install in my repository, by
  committing `commands.setup` or leaving it out.
- As someone running `omni init` on a repository with a lockfile, I find a `setup` already proposed
  in the config I review.

## Scope

In:

- `commands.setup` in the config schema (`kit/lib/config.ts`) and its read through `omni config`.
- Its detection in `kit/lib/init/detect.ts` and its line in the config `omni init` writes
  (`kit/lib/init/config-text.ts`, `InitCommands`).
- Its question and flag in `omni init` (`kit/bin/commands/init.ts`).
- The words of `/omni:do-work` (**Under `--target <name>`**), `/omni:ultra-wave`, `/omni:ultra-yolo`,
  `/omni:ultra-yolo-fix`, `/omni:mega-bug-fix`, `/omni:mega-pr-care` and `/omni:mega-drive`, the
  guards in `kit/test/plugin.test.ts` that read them, `omni help`'s entries and
  `docs/guide/several-repositories.md`.
- `kit/dist/` rebuilt once on the feature branch.

Out:

- Any own-repository flow (`/omni:wave`, `/omni:yolo`, `/omni:bug-fix`, `/omni:do-work` without
  `--target`).
- Running a setup when a target has no preflight.
- Caching installs between worktrees.
- This repository's own `.omni-loop/config.yml`: it is not a target and needs no setup.

## Test seams

Following `omni kb show testing`: vitest, no network, no GitHub.

- **Config:** a config with `commands.setup` reads it back; one without it reads `null`; a non-text
  value is refused (`kit/lib/config.test.ts`).
- **Detection:** `detectCommands` on a temporary folder with each lockfile returns the command in the
  table, the first wins when several exist, and none returns `null` (`kit/lib/init/detect.test.ts`); `omni init`'s written config
  carries the `setup` line.
- **Skill words:** `kit/test/plugin.test.ts`'s guards on the multi-repository skills (the ones that
  read "other than its own committed preflight") now require the setup-then-preflight rule, setup
  before preflight in each skill's text, and still refuse any other command in a target.
- **Bundle:** `kit/test/dist.test.ts` stays green after the rebuild.

## Risks

- **What it publishes:** a new config key and new skill words, released by the `release` workflow
  after the merge (`omni kb show releasing`). Repositories that update the kit get the key; nothing
  runs a setup until a target commits one.
- **An install runs the target's lifecycle scripts** on the machine running the loop. Mitigated: it
  runs only when the target's team committed it, read from its default branch.
- **Rollback:** revert the feature PR's merge. A target that committed `commands.setup` meanwhile is
  refused by nothing (the key is just unread by an older kit), so no target needs to change back.

## Acceptance criteria

- `omni config commands.setup` prints the committed command, or `null` when the key is absent.
- `omni init` in a repository holding `pnpm-lock.yaml` writes `setup: pnpm install --frozen-lockfile`
  under `commands`; in one with no lockfile it writes `setup: null` (or no line).
- `/omni:do-work`'s **Under `--target <name>`** says the target's committed setup runs, when it has
  one, in the slice's worktree before its committed preflight, read from the target's default branch.
- `/omni:ultra-wave`, `/omni:ultra-yolo`, `/omni:ultra-yolo-fix`, `/omni:mega-bug-fix` and
  `/omni:mega-pr-care` say the same wherever they run a target's preflight, and their guardrails still forbid any other command
  in a target.
- Each of those skills says a red setup holds its slice or target as stuck, quoting the failing line,
  counting toward no attempt, and never edits the target to make it pass.
- A target without a preflight still runs nothing, and one without a setup runs its preflight alone.
- `pnpm test`, `pnpm lint` and `pnpm typecheck` are green.
