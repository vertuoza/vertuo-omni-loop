# Plan: healed e2e steps are safe to accept

PRD #1274, specified in `spec.md` beside this plan. The feature branch `feat/e2e-healed-steps-safe`
goes into `main` through one feature PR (`Closes #1274`); each slice is a sub-PR from
`feat/e2e-healed-steps-safe--<slice>` into the feature branch (`Part of #1274`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni e2e heals <n>` pairs each healed step with its before and after screenshots from the framework's own artifacts, or says that none was kept and why (the slice first checks whether the framework keeps one per step) | `kit/lib/e2e/` `kit/bin/commands/e2e.ts` `kit/bin/commands/e2e.test.ts` `kit/lib/help/` | — | 1 |
| s2 | `omni e2e hold <n>` takes the healed recordings out of the branch's commit set, and `omni e2e confirm <n>` commits them while `omni e2e reject <n>` leaves the committed one and keeps the test red; a later run with no screen change lists no healed step | `kit/lib/e2e/` `kit/bin/commands/e2e.ts` `kit/bin/commands/e2e.test.ts` `kit/lib/help/` | s1 | 2 |
| s3 | `/omni:validate-e2e` puts the screenshots in each healed step's outbox item, commits only unchanged or new recordings in the sub-PR, and guards that the sub-PR holds no healed recording | `kit/plugin/skills/validate-e2e/` `kit/test/plugin.test.ts` | s2 | 3 |
| s4 | The guide page says what a healed step shows, where a held recording waits, and how to confirm or reject it | `docs/guide/validate-e2e.md` | s2 | 3 |

**Shared ground.** `kit/lib/e2e/`, `kit/bin/commands/e2e.ts`, `kit/bin/commands/e2e.test.ts` and
`kit/lib/help/` are declared by s1 and s2: s2 extends the command s1 changes (new subcommands, help
entries, shared pairing code), so s2 is blocked by s1 and the two never share a wave. s3 and s4 share
wave 3 without meeting: the skill and the plugin guard belong to s3 alone, the guide to s4 alone. s3
follows s2 because `kit/test/plugin.test.ts` refuses a skill that names a command the CLI does not
have. `kit/dist/` is generated from `kit/lib/` and `kit/bin/`: no slice lists it, and the wave
rebuilds it once after merging.

## Per slice: done when

**s1**
- The slice states, in its sub-PR, whether the framework keeps a screenshot per step and where (the
  decision "from the framework's artifacts").
- `omni e2e heals <n>` lists, for each healed step, its before screenshot (at the merge-base) and
  after screenshot, as paths or references; when none was kept it says so with the reason
  (criterion 1).
- Pairing is by test id and call index, never by file name; tests use small fixtures with and
  without screenshots and never reach a network, a browser or a model.
- `omni help e2e` still names `heals`.

**s2**
- `omni e2e hold <n>` lists the healed recordings and moves each outside the branch, so a commit of
  `e2e.dir` holds only unchanged or new recordings (criterion 2).
- `omni e2e confirm <n>` commits a healed recording; `omni e2e reject <n>` leaves the committed
  recording as it was and exits non-zero so the test stays red (criterion 3).
- On a fixture repository whose changed recording is held, then confirmed, then run again with no
  screen change, `omni e2e heals <n>` lists no healed step (criterion 4).
- `omni help e2e` names `hold`, `confirm` and `reject`.

**s3**
- Step 7 of the skill puts the before and after screenshots, or the "none kept" reason, in each
  healed step's outbox item (criterion 1).
- Step 8 commits only unchanged and new recordings; the skill no longer says a healed one counts as
  accepted at merge; a guard in `kit/test/plugin.test.ts` fails when the skill's sub-PR step commits
  a healed recording (criterion 2).
- The skill names `confirm` and `reject` for a healed step and does not say who confirms.
- `kit/test/plugin.test.ts` passes: the skill parses, signs the loop's work, and names only commands
  the CLI has.

**s4**
- The guide page explains the screenshots in a healed step's item, where a held recording waits,
  and `omni e2e confirm` and `reject`, and that who confirms is a separate decision.
- It no longer says a healed recording is committed from the start.
