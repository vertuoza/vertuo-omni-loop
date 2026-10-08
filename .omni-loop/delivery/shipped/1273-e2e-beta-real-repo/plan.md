# Plan: the e2e beta works in a real repository

PRD #1273, specified in `spec.md` beside this plan. The feature branch `feat/e2e-beta-real-repo` goes
into `main` through one feature PR (`Closes #1273`); each slice is a sub-PR from
`feat/e2e-beta-real-repo--<slice>` into the feature branch (`Part of #1273`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni e2e heals <n> --head <ref>` pairs the steps at the merge-base with those at `<ref>` (the feature branch when absent), so a first pass lists every step as new | `kit/lib/e2e/` `kit/bin/commands/e2e.ts` `kit/bin/commands/e2e.test.ts` `kit/lib/help/` | — | 1 |
| s2 | `/omni:validate-e2e` sets the e2e project up on its first run (workspace declared, package-manager version checked against CI, one-line stop naming both versions), allows a fixed `e2e.url` with a stated reason in the sub-PR body, passes `--head` with the sub-PR's branch, and records last, again after any dependency change | `kit/plugin/skills/validate-e2e/` `kit/test/plugin.test.ts` | s1 | 2 |
| s3 | The guide page says the same: the scaffold, the version check, the fixed-URL path, `--head`, and record-last | `docs/guide/validate-e2e.md` | s1 | 2 |

**Shared ground.** None between slices of one wave: s2 owns the skill and the plugin guard test, s3
owns the guide page alone. s2 and s3 follow s1 because `kit/test/plugin.test.ts` refuses a skill that
names a command option the CLI does not have. `kit/dist/` is generated from `kit/lib/` and `kit/bin/`:
no slice lists it, and the wave rebuilds it once after merging.

## Per slice: done when

**s1**
- `omni e2e heals <n> --head <ref>` pairs the steps at the merge-base of the trunk and `<ref>` with
  those at `<ref>`; without `--head` it behaves as before (criterion 4).
- On a fixture repository with no recordings at the merge-base, every step at `<ref>` is listed as
  new.
- An unknown `<ref>` fails with a usage error naming it; `omni help e2e` names `--head`.

**s2**
- The skill names, in order: the project scaffold (declared workspace at the package-manager version
  CI uses, committed in the sub-PR), the version check, the install, the recording, the strict replay
  (criteria 1, 5).
- When the local package manager is newer than CI's, the skill stops with one line naming both
  versions before it installs (criterion 2).
- With `e2e.url` a fixed address, the sub-PR body says the target was not the preview and why
  (criterion 3).
- The skill runs `omni e2e heals <n> --head <sub-PR branch>`; changing an installed dependency after
  recording sends it back to record before the strict replay. `kit/test/plugin.test.ts` guards each
  step's order.

**s3**
- The guide page describes the scaffold, the version check, the fixed-URL path with its stated
  reason, `--head`, and record-last, and its existing guide tests stay green.
