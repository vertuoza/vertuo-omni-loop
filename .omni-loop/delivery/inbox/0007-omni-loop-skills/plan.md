# Omni Loop skills — plan

**PRD:** #7 · **Spec:** `spec.md`, beside this plan · **Feature branch:** `feat/omni-loop-skills` →
`main` (`Closes #7`) · **Sub-PRs:** `feat/omni-loop-skills--<slice>` → the feature branch
(`Part of #7`).

Waves 1–5 are built by the loop run by hand. Wave 6 is built by `/omni:yolo 7`: that is the cut-over.
Every slice ships through `omni status 7` (there is no CI gate yet). Any decision taken without asking
is an outbox item in `.omni-loop/delivery/outbox/0007-omni-loop-skills/`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | Marketplace, plugin skeleton, repo shim and settings, plugin test | `.claude-plugin/` `kit/plugin/.claude-plugin/` `.claude/settings.json` `.omni-loop/bin/` `kit/test/plugin.test.mjs` `kit/test/no-literals.test.mjs` | — | 1 |
| s2 | `omni item new` and `omni plan check` | `kit/bin/commands/item.mjs` `kit/bin/commands/plan.mjs` `kit/bin/commands/index.mjs` `kit/bin/item.test.mjs` `kit/bin/plan.test.mjs` | — | 1 |
| s3 | `kit/lib/board.mjs` and `omni board` | `kit/lib/board.mjs` `kit/lib/board.test.mjs` `kit/bin/commands/board.mjs` `kit/bin/commands/index.mjs` `kit/bin/board.test.mjs` | s2 | 2 |
| s4 | skill `pr`: the three PR kinds, marker-upserted status comment, three attempts then needs-fix | `kit/plugin/skills/pr/` | s1 | 2 |
| s5 | skill `do-work`: one slice, test-first, decisions through `omni item new` | `kit/plugin/skills/do-work/` | s1, s2 | 2 |
| s6 | `omni rework plan/close` and `omni phase0` | `kit/bin/commands/rework.mjs` `kit/bin/commands/phase0.mjs` `kit/bin/commands/index.mjs` `kit/bin/rework.test.mjs` `kit/bin/phase0.test.mjs` | s3 | 3 |
| s7 | skill `plan`: the slice table, `omni plan check`, the draft feature PR | `kit/plugin/skills/plan/` | s2, s4 | 3 |
| s8 | skill `wave`: the board, claim first, one worktree subagent per slice, merge one at a time | `kit/plugin/skills/wave/` | s3, s4, s5 | 4 |
| s9 | skill `yolo`: every wave, the gate, ship before ready (the last hand-built slice) | `kit/plugin/skills/yolo/` | s7, s8 | 5 |
| s10 | skill `yolo-fix`: replies, settle PR, rework slices, ship (built by `/omni:yolo 7`) | `kit/plugin/skills/yolo-fix/` | s6, s8, s9 | 6 |
| s11 | skill `brainstorm`: idea → PRD, spec, plan, page, phase-0 PR (built by `/omni:yolo 7`) | `kit/plugin/skills/brainstorm/` | s6, s7, s9 | 6 |

`kit/bin/commands/index.mjs` is shared ground. s2, s3 and s6 each register one command there, so they
run in separate waves.

## Per slice: done when

- **s1:**
  - `claude plugin validate kit/plugin` passes.
  - A session in this repository lists `/omni:*` skills.
  - `node .omni-loop/bin/omni.mjs config` works through the shim.
  - The plugin test is green.
  - The shapes of the marketplace and `extraKnownMarketplaces` entries are raised as an outbox item.
- **s2, s3, s6:**
  - Each command is tested through `main()`, with a fake `exec` wherever `gh` is involved.
  - `pnpm test` is green.
  - The no-literals guard passes.
- **s4, s5, s7–s11:**
  - The SKILL.md parses.
  - Every `omni <command>` it names exists.
  - No repository literal appears in it.
  - It is faithful to the upstream skill named in the spec (§2), adapted to config: each adaptation is
    listed in `kit/porting/plugin--<skill>.md`.
- **Whole PRD:** `omni status 7` is green or red only for items a person must answer, and `omni ship 7`
  has run on the feature branch before the feature PR is marked ready.
