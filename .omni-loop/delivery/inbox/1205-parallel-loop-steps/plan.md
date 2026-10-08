# Plan: parallel loop steps

PRD #1205, specified in `spec.md` beside this plan. The feature branch `feat/parallel-loop-steps`
goes into `main` through one feature PR (`Closes #1205`); each slice is a sub-PR from
`feat/parallel-loop-steps--<slice>` into the feature branch (`Part of #1205`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni next --json` lists `steps`, `running` and `held`: up to `limits.parallelSteps` (default 3) steps, each passing the four-rule collision check against every running and offered step | `kit/lib/next/follow.ts` `kit/lib/next/follow.test.ts` `kit/lib/next/format.ts` `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/schema/config.ts` `kit/lib/schema/config.test.ts` `kit/bin/commands/next.ts` `kit/bin/next.test.ts` | — | 1 |
| s2 | A tick of `/omni:drive` and `/omni:mega-drive` launches one background agent per entry of `steps`, each in its own worktree (drive) or with its own `<worktrees>/targets/<name>@<prd>` clones (mega-drive), records a tick per step with its running and held lines, and stops only when nothing runs | `kit/plugin/skills/drive/` `kit/plugin/skills/mega-drive/` `kit/plugin/skills/ultra-wave/` `kit/plugin/skills/ultra-yolo/` `kit/plugin/skills/ultra-yolo-fix/` `kit/plugin/skills/mega-pr-care/` `kit/plugin/skills/do-work/` `kit/plugin/skills/pr/` `kit/test/plugin.test.ts` | s1 | 2 |
| s3 | `omni help next` and the guide's loop pages tell the pool, the collision check and `limits.parallelSteps` | `kit/lib/help/` `kit/bin/help.test.ts` `docs/guide/loop.md` `docs/guide/drive.md` | s1 | 2 |

**Shared ground.** No prefix is declared by more than one slice. `kit/test/plugin.test.ts` (it reads
the skill files) belongs to s2 alone, and the help tests to s3 alone, so s2 and s3 share wave 2
without meeting. `kit/dist/` is generated from `kit/lib/` and `kit/bin/`: no slice lists it, and the
wave rebuilds it once after merging.

## Per slice: done when

**s1**
- `limits.parallelSteps` defaults to 3; `omni config` refuses 0, 7 and 2.5 (spec criterion 10).
- Three driven PRDs whose current waves share no ground: `steps` has three entries, each of a
  different PRD (criterion 1).
- Two PRDs sharing a path in one repository: `steps` has the first; `held` names the second with the
  path and the step it waits on (criterion 2). The same path in two repositories: both in `steps`
  (criterion 3). Generated paths never collide.
- A PRD whose `blocked-by` has not merged is never in `steps` (criterion 4).
- One step running (a live claim, or `omni:in-progress` with a fresh status comment): `steps` has at
  most `parallelSteps - 1` entries and never a second step of that PRD; a stale claim does not count
  (criterion 5).
- A finish step's ground is the union of its PRD's slices.
- With `parallelSteps: 1`, `step`, `verdict`, `waiting` and `prds` are byte-identical to today's over
  every existing `follow.test.ts` and `next.test.ts` case (criterion 6).
- The plain output of `omni next` prints one line per step to launch, per running step and per held
  step.

**s2**
- `/omni:drive`'s tick launches one background agent per entry of `steps` in one message, each with
  `isolation: "worktree"`, running that step's one skill (criterion 7).
- `/omni:mega-drive`'s tick does the same, each PRD's target clones at
  `<worktrees>/targets/<name>@<prd>`, and every ultra skill, `/omni:mega-pr-care`, `/omni:do-work
  --target` and `/omni:pr` read the clone from that path (criterion 7).
- Each tick records one `omni loop push tick` per step launched and per step finished, its result
  line listing the running steps by repository and every held line (criterion 8).
- Only the loop session writes the loop record and the roadmap; the loop stops itself only when
  nothing runs and every PRD is parked or done (criterion 9).
- `kit/test/plugin.test.ts` passes, and checks that both drive skills name `steps`, the background
  launch and the per-PRD clone path.

**s3**
- `omni help next` names `steps`, `running`, `held` and `limits.parallelSteps`.
- `docs/guide/loop.md` and `docs/guide/drive.md` explain the pool, the four rules and how
  `limits.parallelSteps: 1` restores one step per tick.
