# Plan: Repository flow — rules, areas and hooks that tailor the loop per repository

PRD #1089, spec beside this plan (`spec.md`). The feature branch `feat/repo-flow` is stacked on
#1086's branch `claude/omni-landings-impl-aaef5f` (spec, Decisions): its feature PR's base is that
branch until #1086 merges, then `main`, and its body opens with `Closes #1089`. Each slice is a sub-PR
from `feat/repo-flow--<slice>` into `feat/repo-flow`, its body opening with `Part of #1089`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A repository declares `flow` (rules, areas, hooks) in its config, #1086's `landings.alone` and `pr.openWith` read as its aliases, paths resolve to areas, and `omni check config` refuses a broken flow naming the key | `kit/lib/flow/schema` `kit/lib/flow/points` `kit/lib/flow/resolve` `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/types.ts` `kit/bin/commands/check.ts` `kit/bin/check-config` `kit/dist/omni.mjs` | — | 1 |
| s2 | A feature PR may be stacked on another branch: `/omni:yolo` and `/omni:pr` find it by its head, meet its base instead of the default branch, and never mark it ready while the PR of its base is open | `kit/plugin/skills/yolo/` `kit/plugin/skills/pr/` | — | 1 |
| s3 | `omni plan check` grades each slice against the rules of the areas its territory touches (`slice.alone`, `slice.maxFiles`, `wave: first`, `blocks: all`, `landing: alone`, conflicting `merge` or `replace`), naming the slice, the area and the rule | `kit/lib/flow/plan-rules` `kit/lib/inbox/plan-grade.ts` `kit/lib/inbox/plan-grade.test.ts` `kit/lib/landings/` `kit/bin/commands/plan.ts` `kit/bin/plan.test.ts` `kit/dist/omni.mjs` | s1 | 2 |
| s4 | `omni flow show` prints a point's resolved hooks (text, inputs, verdict line, `kitStep`), a path's area with its rules and hooks, or the repository's differences from the kit's defaults, and `omni flow verdict` reads a hook's verdict line | `kit/lib/flow/show` `kit/lib/flow/verdict` `kit/bin/commands/flow` `kit/bin/flow` `kit/bin/commands/index.ts` `kit/lib/help/entries` `kit/dist/omni.mjs` | s1 | 3 |
| s5 | `omni flow check merge --pr <n>` applies `rules.subPr` (merge method, required checks, a person's approval, territory block, open sub-PRs) and prints `ok` with the merge command or `not ok` with the reason | `kit/lib/flow/merge-gate` `kit/bin/commands/flow` `kit/bin/flow` `kit/bin/github.ts` `kit/bin/github.test.ts` `kit/dist/omni.mjs` | s4 | 4 |
| s6 | Across repositories: mega-invade's copy of a target carries its `flow` and hook files, `omni flow show --repo` reads it, `omni plan check` grades each `repo` row against its target's flow, and a target whose flow changed since `read at` is reported as moved | `kit/lib/knowledge/copies` `kit/lib/plan-repo/` `kit/lib/flow/show` `kit/lib/flow/plan-rules` `kit/lib/inbox/plan-grade.ts` `kit/lib/inbox/plan-grade.test.ts` `kit/bin/commands/targets.ts` `kit/bin/commands/targets.test.ts` `kit/dist/omni.mjs` | s3, s4 | 5 |
| s7 | Every skill the catalog lists follows its points through `omni flow show` and `omni flow verdict`, `/omni:wave` and `/omni:ultra-wave` merge only through `omni flow check merge`, and a test keeps each point called by each skill it lists | `kit/plugin/skills/plan/` `kit/plugin/skills/do-work/` `kit/plugin/skills/pr/` `kit/plugin/skills/wave/` `kit/plugin/skills/yolo/` `kit/plugin/skills/ultra-wave/` `kit/plugin/skills/ultra-yolo/` `kit/plugin/skills/mega-brainstorm/` `kit/plugin/skills/mega-invade/` `kit/test/flow-points.test.ts` `kit/lib/flow/points` | s2, s5, s6 | 6 |
| s8 | The flow is documented and proposed: a new ADR scopes "replace the act, never the guard" beside ADR-0025, `docs/guide/flow.md` walks the kernel and migrations example, the kit README lists `flow`, and `/omni:invade` proposes a flow from what the repository proves | `.omni-loop/knowledge/adr/0060-` `.omni-loop/knowledge/adr/README.md` `docs/guide/flow.md` `docs/guide/meta.json` `apps/galaxy/src/docs/` `kit/README.md` `kit/plugin/skills/invade/` | s7 | 7 |

**Shared ground.**

- `kit/dist/omni.mjs`, the bundle `pnpm kit:build` writes and `kit/test/dist.test.ts` checks, changes
  with every CLI slice: s1, s3, s4, s5 and s6 each declare it, and so sit in waves 1, 2, 3, 4 and 5,
  one after another.
- `kit/lib/flow/plan-rules`, `kit/lib/inbox/plan-grade.ts` and its test: s3 writes the grading of one
  repository's flow, s6 extends it to each target's (waves 2 and 5).
- `kit/lib/flow/show`: s4 writes it, s6 adds `--repo` (waves 3 and 5).
- `kit/bin/commands/flow` and `kit/bin/flow`: s4 adds `show` and `verdict`, s5 adds `check merge`
  (waves 3 and 4).
- `kit/lib/flow/points`: s1 writes the catalog, s7 lists each point's skills against it (waves 1 and 6).
- `kit/plugin/skills/yolo/` and `kit/plugin/skills/pr/`: s2 makes them stack-aware, s7 adds their
  points (waves 1 and 6).
- `kit/test/plugin.test.ts` reads every skill; no slice changes it. s7's conformance test is its own
  file.

## Per slice: done when

**s1**
- A config with no `flow` key loads as today, and the whole existing suite passes unchanged.
- The `flow` example in the spec's Solution loads; `resolve` maps `src/kernel/Bus/Dispatcher.php` to
  `kernel`, `database/migrations/x.sql` to `migrations`, `src/Invoice.php` to the default area, and
  a slice's territory to every area it touches, with the strictest limit, the union of
  `requireChecks`, and `inherit: false` honoured. Table-driven tests in `kit/lib/flow/`.
- `landings.alone: [<re>]` resolves as an area with `landing: alone`, and `pr.openWith: /create-pr`
  as `pr.open.replace` marked `alias: claude`, each with a test showing the same result as the
  `flow` form.
- `kit/lib/flow/points` lists the nine points of the spec, each with its skills, its modes, its
  inputs and a `replace`'s outputs.
- `omni check config` exits 1 naming the key for: a regex that does not compile, an unknown point,
  `replace` on `plan.slice`, a hook path that is absolute, holds `..`, is a URL, does not exist, or
  sits under `.claude/` without `alias: claude`, a hook file over `limits.hookMaxBytes` (20480 by
  default), and any `flow.on`. It exits 0 on the spec's example.

**s2**
- `/omni:yolo` finds the feature PR by `--head <feature branch>` whatever its base; when the base is
  not `repo.defaultBranch`, it meets that base where it would meet the default branch, stops with one
  line when the base's head is not an ancestor of the feature branch, and leaves the PR draft while
  the PR whose head is that base is open.
- `/omni:pr`'s feature kind says the same for a stacked base, and its default-branch guard still
  refuses any merge into `repo.defaultBranch`.
- `kit/test/plugin.test.ts` stays green.

**s3**
- Spec acceptance 2: a slice touching `database/migrations/x.sql` and `src/Invoice.php` under the
  `migrations` area is refused, naming the slice, the area and `slice alone`.
- Spec acceptance 3: a kernel slice in wave 2 behind a non-kernel slice in wave 1 is refused
  (`wave: first`); moved to wave 1, the plan is green.
- `blocks: all`, `maxFiles`, two `merge` methods on one slice and two `replace` hooks on one slice
  each have a refusal test and a green counterpart.
- Spec acceptance 10, for landings: `landings.alone` and `landing: alone` refuse the same plans with
  the same slices named; every existing `plan-grade` and landings test passes unchanged.

**s4**
- Spec acceptance 1: with no `flow`, `omni flow show do-work.test` prints no hook and
  `kitStep: run`.
- Spec acceptance 4, 5 and 6, as JSON snapshots: `--path src/kernel/Bus/Dispatcher.php`, no
  argument (the differences from the defaults, area by area), and `do-work.test --prd <n> --slice
  <id> --json` returning the kernel's `replace` hook with its text, territory and verdict line and
  `kitStep: replaced`.
- Spec acceptance 7: `omni flow verdict` prints `ok` for a pass, `not ok` for a fail, and
  `not ok … no verdict` for output without the line, exit 0 or 1.
- No `flow show` JSON carries `.claude/`, a slash command or a Claude tool name, except a hook marked
  `alias: claude`, checked by a test.
- `omni help flow` describes the verb.

**s5**
- Spec acceptance 8: on a kernel sub-PR with no approval, `not ok` names `kernel: approval person`;
  with `merge: rebase` and the required checks green, `ok` and a `gh pr merge <n> --rebase
  --delete-branch` command. GitHub facts come from a faked client at `kit/bin/github.ts`.
- With no `flow`, the command is `gh pr merge <n> --squash --delete-branch`, today's.
- `territory: block` refuses a diff outside the slice's territory; `report` lets it through and
  names the paths; `maxOpen` refuses past the count.

**s6**
- Spec acceptance 12: in a plan repository fixture, a `repo: back` row is graded against the back
  end's imported flow and a `repo: web` row against the web's; the same path in the two repositories
  meets different rules.
- The imported copy holds the target's `flow` section and its hook files under
  `<paths.knowledge>/repos/<name>/flow/`; `omni flow show --repo back <point>` reads it.
- A target whose committed `flow` differs from the copy at its `read at` is reported as moved by
  `omni targets`, naming the flow.

**s7**
- Spec acceptance 11: `kit/test/flow-points.test.ts` fails when a skill the catalog lists does not
  call `omni flow show <point>`, and passes with every skill wired, `ultra-wave`, `ultra-yolo` and
  `mega-brainstorm` included.
- `/omni:wave` and `/omni:ultra-wave` hold no `gh pr merge --squash`: they merge with the command
  `omni flow check merge` prints, and leave a `not ok` sub-PR open with its reason, carrying on.
- Each point's paragraph says: follow every `before`, then the kit's step or the `replace` hook, then
  every `after`; pass each hook's output to `omni flow verdict`; a `not ok` stops the point as a
  failing kit step would. A target's hooks are followed only in its worktree.

**s8**
- The ADR states "a hook may replace the act at a point the catalog allows, never a guard", cites
  ADR-0025, and the ADR index lists it.
- Spec acceptance 13: `docs/guide/flow.md` walks the kernel and migrations example end to end
  (config, `plan check` refusing then green, `flow show`, a hook file, `check merge`), and the guide's
  tests in `apps/galaxy/src/docs/` pass with the new page in `meta.json`.
- The kit README documents `flow` and the aliases.
- `/omni:invade` proposes a `migrations` area with `slice.alone` and `landing: alone` when it finds a
  migrations folder, as proposed config a person merges.
