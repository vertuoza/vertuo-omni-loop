# Plan: First e2e use on a Vertuoza product

PRD #1276, spec beside this plan (`spec.md`). The feature branch `feat/e2e-first-product-use` goes into
`main` with `Closes #1276`; each slice is a sub-PR from `feat/e2e-first-product-use--<slice>` into the
feature branch with `Part of #1276`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | In a plan repository, `/omni:validate-e2e` writes the tests and recordings in the plan repository's `e2e.dir`, against the environment it builds, never in a target repository | `kit/plugin/skills/validate-e2e/` `kit/test/plugin.test.ts` | — | 1 |
| s2 | `omni e2e guard` refuses a credential in `e2e.dir` and in the sub-PR's files, naming the file and line but never the value | `kit/lib/e2e/guard*` `kit/bin/commands/e2e*` `kit/lib/help/entries*` | — | 1 |
| s3 | The skill gives every created record a name unique to the run, signs in from a saved session, runs the guard before committing, and states the flow and the account in its sub-PR | `kit/plugin/skills/validate-e2e/` `kit/test/plugin.test.ts` | s1, s2 | 2 |
| s4 | The guide page explains the plan-repository path, the unique-name rule, the saved session and the account's custody | `docs/guide/` | s3 | 3 |

Shared ground: `kit/plugin/skills/validate-e2e/` and `kit/test/plugin.test.ts` are declared by s1 and
s3, kept apart by s3 being blocked by s1 (wave 2). `kit/lib/help/entries*` is declared by s2 only
(the skill's own help entry text is touched only there, in s2's guard line). The generated
`kit/dist/` is rebuilt by the wave, not listed.

## Per slice: done when

### s1
- In a plan repository (config has a `plan` section) the skill's steps name the plan repository as the
  place of `e2e.dir`, the tests and the recordings, and say a target repository is never written.
- The target is the environment the plan repository builds from the target PRs together (`e2e.url` /
  `e2e.setup`), read from config, never guessed.
- Outside a plan repository the skill runs exactly as before.
- `kit/test/plugin.test.ts` pins each of these sentences.

### s2
- `omni e2e guard <prd>` exits 1 and names `file:line` (never the matched value) when a file of
  `e2e.dir`, other than the ignored cache, holds a password, token, key or session-state shape.
- It exits 0 on a clean folder and reads no file when `e2e.enabled` is false (one line, exit 1, like
  its siblings).
- The saved-session file (`storage-state.json`) is refused when found under `e2e.dir`.
- Command and library tests with a fixture plan repository; `omni help` lists it.

### s3
- Step 4 requires every record a test creates to carry a name built from a per-run value, in a
  plan-repository run and elsewhere, unless the spec's answer says otherwise.
- The run signs in from the saved session `e2e.setup` writes; the skill never prints, logs or commits a
  credential and never shows one to the model.
- `omni e2e guard <n>` runs before the commit and a non-zero exit stops the run.
- The sub-PR body states which QA flow and which account (by label, never the secret) the run used.
- `kit/test/plugin.test.ts` pins each.

### s4
- `docs/guide/validate-e2e.md` has a section for the plan-repository path, the unique-name rule, the
  saved session and the guard, and says QA chooses the flows and the account.
