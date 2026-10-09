# Plan: validate a PRD with e2e (beta)

PRD #1233, specified in `spec.md` beside this plan. The feature branch `feat/validate-e2e` goes into
`main` through one feature PR (`Closes #1233`); each slice is a sub-PR from
`feat/validate-e2e--<slice>` into the feature branch (`Part of #1233`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | An `e2e:` block in the config, off by default (`enabled`, `url`, `deployment`, `setup`, `bypassEnv`, `dir`, `model`), that `omni config e2e` prints and refuses when it is invalid | `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/schema/` | — | 1 |
| s2 | `omni e2e status <n>` lists the tests tagged `prd-<n>` under `e2e.dir` with whether each has a recording, as JSON, and exits non-zero when one has none; a recording that does not read, or whose `schemaVersion` is not `trace-1`, fails naming the file | `kit/lib/e2e/` `kit/bin/commands/e2e.ts` `kit/bin/commands/e2e.test.ts` `kit/bin/commands/index.ts` `kit/lib/help/` | s1 | 2 |
| s3 | `omni e2e heals <n>` pairs the recordings' steps at the merge-base and at the head by test id and call index, and lists each as healed (old and new action), new or removed | `kit/lib/e2e/` `kit/bin/commands/e2e.ts` `kit/bin/commands/e2e.test.ts` `kit/lib/help/` | s2 | 3 |
| s4 | `/omni:validate-e2e <n>`: the skill, from "configured, or stop" to the sub-PR with its criterion, test and verdict table | `kit/plugin/skills/validate-e2e/` `kit/test/plugin.test.ts` | s3 | 4 |
| s5 | The guide page on the beta: the `e2e:` block, the commands, the strict replay by hand, and what a person reads in the sub-PR | `docs/guide/` | s3 | 4 |

**Shared ground.** `kit/lib/e2e/`, `kit/bin/commands/e2e.ts`, `kit/bin/commands/e2e.test.ts` and
`kit/lib/help/` are declared by s2 and s3: s3 extends what s2 starts (the command, its help entry),
so s3 is blocked by s2 and the two never share a wave. s4 and s5 share wave 4 without meeting: the
skill and the plugin's guard test belong to s4 alone, the guide to s5 alone. s4 follows s3 because
`kit/test/plugin.test.ts` refuses a skill that names a command the CLI does not have. `kit/dist/` is
generated from `kit/lib/` and `kit/bin/`: no slice lists it, and the wave rebuilds it once after
merging.

## Per slice: done when

**s1**
- `omni config e2e` prints `enabled: false`, `url: null`, `deployment: null`, `setup: null`,
  `bypassEnv: null`, `dir: e2e` and a `model` (`anthropic/claude-sonnet-5.5`) on a repository that
  set nothing (spec criterion 1, the default).
- `url` accepts a fixed address or `github-deployment`, as `proof.url` does; `dir` and `model` refuse
  an empty value; `bypassEnv` refuses a name that is not an environment variable's.
- The config's tests cover the defaults and each refusal.

**s2**
- `omni e2e status <n>` prints JSON: the tests tagged `prd-<n>` under `e2e.dir`, each with `recording`
  true or false, and exits non-zero when one has none (criterion 3).
- A recording file whose `schemaVersion` is not `trace-1`, or that is not valid JSON, makes the
  command fail with a message that names the file (criterion 5).
- With `e2e.enabled` false the command says so in one line and exits non-zero; it reads no file.
- `omni help e2e` names `status`; the command is in the table that `kit/test/plugin.test.ts`
  checks; its tests use small `trace-1` fixtures and never reach the network, a browser or a model.

**s3**
- `omni e2e heals <n>` pairs steps by `recordedFor.testId` and `recordedFor.callIndex`, never by file
  name, between the feature branch's merge-base and its head (criterion 4).
- A step on both sides with different actions (`name` and `target`) is **healed**, listed with the old
  action, the new action and the recording's `summary`; one only at the head is **new**; one only at
  the merge-base is **removed**; an identical one is not listed.
- The same `schemaVersion` and unreadable-file refusals as s2 hold for both sides (criterion 5).
- `omni help e2e` names `heals`.

**s4**
- With `e2e.enabled` false or `e2e.url` null, the skill's first step prints one line and stops, having
  written and posted nothing (criterion 1); under a Node older than 24.8 it prints one line naming
  the version it needs and stops (criterion 2).
- The skill names every step of spec section 4: the target as `/omni:prove` reaches it, the criteria
  read from the spec alone and never the code's diff, one test per filmable criterion tagged
  `prd-<n>`, the first run that records, the second run with `--strict-cache`, `omni e2e status` and
  `omni e2e heals`, and the sub-PR (criteria 6 to 10).
- It says that `agent.assert` needs a line saying why nothing exact exists, that a red test is a ✗
  and never a weakened assertion, that every read waits for the page, that records carry a name
  unique to the run, that `E2E_TELEMETRY_DISABLED=1` is set, and that it merges nothing and marks
  nothing ready.
- `kit/test/plugin.test.ts` passes: the skill parses, signs the loop's work, and names only commands
  the CLI has.

**s5**
- The guide page explains the `e2e:` block field by field, `omni e2e status` and `heals`, the strict
  replay as `npx e2e run --strict-cache --tag prd-<n>`, why the recordings are committed, and what a
  healed step in the sub-PR means.
- It says the block is off by default and that nothing runs after a merge in this beta.
