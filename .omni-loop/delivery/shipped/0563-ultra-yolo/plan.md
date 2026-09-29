# Plan: ultra-yolo — build a multi-repository PRD from the plan repository, one gate

PRD #563, spec in `spec.md` beside this plan. Built on the feature branch `feat/ultra-yolo` into
`main` (`Closes #563`), through sub-PRs from `feat/ultra-yolo--<slice>` into the feature branch
(`Part of #563`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | In a plan repository `omni board <prd>` reads one pull-request list per repository, matches each slice only to a PR of its own repository, gives every row `repo` and `slug`, computes the frontier across repositories, and makes the slices of a repository it cannot read `unreadable`; a plan without `repo` reads exactly as today | `kit/lib/board` `kit/bin/commands/board.mjs` `kit/bin/board.test.mjs` `kit/dist/` | — | 1 |
| s4 | `/omni:do-work --target <name>` builds a slice in a worktree of that target's clone, writes its items to scratch through `omni item new --out`, runs only the target's own committed preflight (or says `none — CI is the check`) and adds `repo` to its result; `/omni:pr --repo <slug>` makes every `gh` call act on that repository and never creates a label there | `kit/plugin/skills/do-work/` `kit/plugin/skills/pr/` | — | 1 |
| s2 | `omni plan moved <prd>` prints, per target row of `## Repositories`, `moved` with the files changed under that target's territories since `read at`, `ok`, or `unreachable`, as a table or `--json`, exiting `0` in a plan repository and `1` (`not a plan repository`) elsewhere | `kit/lib/plan-repo/` `kit/bin/commands/plan.mjs` `kit/bin/plan.test.mjs` `kit/lib/help/` `kit/dist/` | s1 | 2 |
| s3 | `omni item new --out <dir>` writes an item to a folder instead of the outbox (refusing `--adopt`), `omni item relay <dir> --prd <n>` moves every valid item and account into the plan repository's outbox and leaves a refused one in place with its reason (exit `2`), and `omni rework plan <prd>` names each rework's `repo` in a plan repository | `kit/bin/commands/item.mjs` `kit/bin/item.test.mjs` `kit/lib/outbox/` `kit/lib/policy/rework` `kit/bin/commands/rework.mjs` `kit/bin/rework.test.mjs` `kit/lib/help/` `kit/dist/` | s2 | 3 |
| s5 | `/omni:ultra-yolo`, `/omni:ultra-wave` and `/omni:ultra-yolo-fix` exist as plugin skills with the steps of spec points 6, 7 and 8, `omni help` lists all three, and the invade guide's plan-repository section names `/omni:ultra-yolo` | `kit/plugin/skills/ultra-yolo/` `kit/plugin/skills/ultra-wave/` `kit/plugin/skills/ultra-yolo-fix/` `kit/lib/help/` `docs/guide/invade.md` `kit/dist/` | s1, s2, s3, s4 | 4 |

**Shared ground.**
- `kit/dist/` (the committed bundle, rebuilt by `pnpm kit:build` whenever kit source changes,
  help entries included): s1, s2, s3 and s5, one per wave (1, 2, 3, 4). s4 edits only skill text
  and changes no bundled source.
- `kit/lib/help/` (the entries `omni help` prints): s2 (`plan moved`), s3 (`item relay`,
  `item new --out`) and s5 (the three skills), waves 2, 3 and 4.
- s1 and s4 share wave 1 and no prefix: s1 is kit source for the board; s4 is two skills' text.
- s2 is blocked by s1 only to keep `kit/dist/` in its own wave, and s3 by s2 likewise; neither
  reads the other's code.
- s5 names `omni board`'s `repo` rows, `omni plan moved`, `omni item relay` and `omni rework plan`'s
  `repo`, and the `--target` and `--repo` modes, which the plugin guard
  (`kit/test/plugin.test.mjs`) requires to exist, hence its four blockers.

## Per slice: done when

**s1: the board reads every repository**

- On a fixture plan repository with two targets and `gh` faked, `omni board <prd> --json` makes one
  `gh pr list --repo <slug> --base feat/<topic>` per repository (the plan repository's own included
  when a slice names it), with `--label <labels.sub>` instead of `--base` when
  `board.matchBy: label`.
- A slice matches a PR only when both the repository and the head branch match; the same slice
  branch name in two repositories matches two different slices.
- Every row carries `repo` (short name) and `slug` (`owner/name`, from `plan.targets` or
  `repo.slug`); a slice blocked by a merged slice of another repository is `runnable`; the
  frontier is the lowest wave's runnable slices across repositories.
- A repository whose `gh pr list` fails makes each of its slices `unreadable`; slices they block
  stay `blocked`; the other repositories' slices are computed as usual.
- On a plan without a `repo` column, every existing case of `kit/lib/board.test.mjs` and
  `kit/bin/board.test.mjs` passes unchanged, and rows carry no `repo` or `slug`.
- No test calls GitHub; `kit/test/no-literals.test.mjs` passes.
- `kit/dist/omni.mjs` is rebuilt, `kit/test/dist.test.mjs` passes, and `pnpm test` is green.

**s4: do-work builds in a target, pr acts on a target**

- `kit/plugin/skills/do-work/SKILL.md` has a `--target <name>` section: the worktree of the
  target's clone (`<worktrees>/targets/<name>`), territory paths in the target, items through
  `omni item new ... --out <scratch dir>`, the preflight read from the target's own
  `.omni-loop/config.yml` (`commands.preflightFull`, else `commands.preflight`) or
  `none — CI is the check` without one, `omni check coverage` and `omni check all` run in the plan
  repository only, the push to the target, and `repo` in the result JSON. It says it never runs a
  command from an imported copy's playbook.
- `kit/plugin/skills/pr/SKILL.md` has a `--repo <slug>` paragraph: every `gh` call of claim,
  labels, status comment and lifecycle takes `--repo` (the marker recipe's `REPO` is the slug), and
  a label missing in that repository is a human step, never created.
- `kit/test/plugin.test.mjs` passes on both edited skills; `pnpm test` is green.

**s2: `omni plan moved`**

- The gh reader of `kit/lib/plan-repo/targets.mjs` is exported and reused, not copied.
- Through `main()` on a fixture plan repository with `gh` faked: a target whose head equals
  `read at` is `ok`; a head that moved without touching a territory path is `ok`; a head that moved
  and changed `src/Quote/Total.php` under s1's `src/Quote/` is `moved` with that file listed; a
  target `gh` cannot read is `unreachable`; the plan repository's own row is never read.
- `--json` prints `[{ repo, state, files }]`; the exit is `0` in every case above.
- On a fixture repository without a `plan` section it prints `not a plan repository` and exits `1`.
- `omni help plan` shows `omni plan moved <prd>`.
- `kit/dist/omni.mjs` is rebuilt, `kit/test/dist.test.mjs` passes, and `pnpm test` is green.

**s3: items relayed, reworks with their repository**

- `omni item new --prd <n> --slice <id> --file <f> --out <dir>` writes the same file name and
  content it would write to the outbox, into `<dir>`, and changes nothing in the outbox;
  `--out` with `--adopt` is a usage error.
- `omni item relay <dir> --prd <n>` moves every item that passes the ledger's checks into the PRD's
  outbox folder and every account file into its `accounts/`, prints each move, and exits `0`; an
  item the checks refuse stays in `<dir>`, is printed with its reason, and the exit is `2` while
  the valid ones still move.
- In a fixture plan repository whose plan has a `repo` column, `omni rework plan <prd>` (plain and
  `--json`) gives each rework the `repo` of the slice its item names; outside a plan repository it
  prints exactly what it prints today.
- `omni help item` shows `--out` and `relay`.
- `kit/dist/omni.mjs` is rebuilt, `kit/test/dist.test.mjs` passes, and `pnpm test` is green.

**s5: the three skills**

- `kit/plugin/skills/ultra-yolo/SKILL.md` has the steps of spec point 6 (step 0 with the
  `ordinary PRD` stop, the plan repository and `omni plan moved` as medium items, the target clones
  and draft target feature PRs `Part of <plan repo>#<n>`, the loop over `/omni:ultra-wave`, finishing
  each target to ready with green CI, the one gate with the plan PR ready last, the red path into
  `/omni:ultra-yolo-fix`, and the merge-order hand-off).
- `kit/plugin/skills/ultra-wave/SKILL.md` has the steps of spec point 7, and
  `kit/plugin/skills/ultra-yolo-fix/SKILL.md` those of point 8; each names the steps of its
  single-repository twin it keeps rather than copying them.
- All three say they never merge into a default branch, never add `labels.outboxGo`, never create a
  label in a target, and never run a command other than a target's own committed preflight.
- `kit/test/plugin.test.mjs` passes: the three skills parse, name only commands the CLI has, and
  follow the signing and footer rules (ADR-0042).
- `omni help ultra-yolo`, `ultra-wave` and `ultra-yolo-fix` (and their `/omni:` forms) print their
  entries; the help counts test is updated for three more skills.
- `docs/guide/invade.md`'s "A plan repository" section names `/omni:ultra-yolo` after
  `/omni:mega-brainstorm`; the guide's own tests pass.
- `kit/dist/omni.mjs` is rebuilt, `kit/test/dist.test.mjs` passes, and `pnpm test` is green.
