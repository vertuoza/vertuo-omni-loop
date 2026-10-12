---
prd: 1233
title: Validate a PRD's acceptance criteria with e2e tests that stay (beta)
blocked-by: none
spec: file
---

# Validate a PRD with e2e (beta)

**Date:** 2026-10-08 · **PRD:** #1233 · **Touches:** a new `kit/lib/e2e/` (and its tests),
`kit/bin/commands/e2e.ts` (and its test) with its registration in `kit/bin/commands/index.ts`,
`kit/lib/config.ts` and `kit/lib/schema/config.ts` (the `e2e:` block), a new skill
`kit/plugin/skills/validate-e2e/SKILL.md`, `omni help`, `docs/guide/` (a page on the beta).
**Out of scope:** a CI job that replays the suite after a merge, any wiring into `/omni:yolo`, the
seeded QA tenant and its test account, quarantine and retirement of tests, mobile, merging this skill
with `/omni:prove` or with the acceptance scenarios, and any call to the e2e framework or to a model
from `omni e2e`.

## Problem

`/omni:prove` films each acceptance criterion of a PRD with Playwright against the PR's preview, and
then throws the scripts away: the run is a record, not a protection. Nothing of what was checked
joins a regression suite, so the next PRD that breaks the same screen is caught by a person, if by
anyone.

The e2e framework by tester.army (open source, Apache-2.0) can keep what it checks. A goal step
(`agent.act`) is driven by a model once, and its actions are recorded; later runs replay the
recording with no model call. A spike on PRD 1017 (People ranking, 8 criteria) showed it works: 80
runs green, the replay of a step takes about 3 seconds against about 20 seconds and $0.11 the first
time, and exact `expect()` reads caught a deliberate rank regression whatever the model did.

The same spike showed the danger. When a header was renamed, the model clicked the new name, the test
stayed green, and the recording was **overwritten**: the run's summary said only `Cache 1 missed`. A
regression suite that heals itself past a changed screen protects nothing. Run with `--strict-cache`,
the same stale recording fails (`REPLAY_STALE`): a committed recording is the reference that makes a
mismatch a failure. Today nothing in the loop commits recordings, tells a changed one from a new one,
or fails a missing one: a missing recording is only `missed`, and even in strict mode the model runs.

## Solution

A beta skill, **`/omni:validate-e2e <n>`**, behind an **`e2e:` config block that is off by default**,
and two small, tested commands, **`omni e2e status <n>`** and **`omni e2e heals <n>`**, that do the
part no model should judge. A person runs the skill on PRD `n` once its feature PR is ready, as with
`/omni:prove`; it is never run by default (each run costs a model session and a few minutes).

### 1. The `e2e:` block

```yaml
e2e:
  enabled: false                       # off by default: the skill stops with one line
  url: null                            # a fixed URL, or github-deployment (the feature PR's preview), as proof.url
  deployment: null                     # which deployment, when a commit has several previews
  setup: null                          # a command that signs the browser in, as proof.setup
  bypassEnv: null                      # the variable holding the preview-protection bypass secret
  dir: e2e                             # where the tests and their recordings live in this repository
  model: anthropic/claude-sonnet-5.5   # the model of the goal steps, an OpenRouter id
```

`url`, `deployment`, `setup` and `bypassEnv` mean what they mean under `proof`; a repository that
already configured `proof` copies its values and reaches the same target. The model is called through
OpenRouter with the `OPENROUTER_API_KEY` the kit already reads; no key is written in any file. In a
plan repository, `url` points at the environment the plan repository builds from the target PRs.
Nothing in the kit names a product.

### 2. `omni e2e status <n>`

Lists the tests tagged `prd-<n>` under `e2e.dir` and, for each, whether a recording exists. It prints
JSON and exits non-zero when one is missing: the gate that a missing recording must not pass as a
green run.

### 3. `omni e2e heals <n>`

Reads the recordings (`.e2e/cache/*.json`, schema `trace-1`) at the merge-base of the PRD's feature
branch and at its head, and pairs steps by `recordedFor.testId` and `recordedFor.callIndex`, never by
file name (a file's name is a hash the spike did not show to be stable). A step is:

- **healed** when it exists on both sides with different actions (`name` and `target`); the output
  gives the old and the new action and the recording's `summary`;
- **new** when it exists only at the head;
- **removed** when it exists only at the merge-base: a test deleted can hide a lost criterion.

A `schemaVersion` other than `trace-1`, or a file that does not read, fails the command naming the
file: a framework upgrade never passes in silence.

### 4. The skill, step by step

1. **Configured, or stop.** `omni config e2e`: when `enabled` is false or `url` is `null`, print one
   line and stop; the run writes nothing and posts nothing. When `node -v` is below 24.8, print one
   line naming the version required and stop.
2. **The target.** As `/omni:prove` does: the fixed URL, or the preview of the feature PR's head
   commit (waiting up to 10 minutes), the bypass sent as a header and never printed, `setup` run once.
3. **The criteria, from the spec alone.** Read the spec's acceptance criteria and never the diff of
   the code. Class each as **filmable** (a screen can show it) or **not filmable** (a config value, a
   log line), the latter staying an ordinary unit or integration test.
4. **One test per filmable criterion** under `e2e.dir`, tagged `prd-<n>`. Navigation with
   `agent.act`; every outcome pinned by an exact `expect()`; `agent.assert` only where nothing exact
   exists, with a line saying why (it calls the model on every run, replayed or not). Every read of
   the screen begins with an `expect` that waits for it to be drawn, and every record a test creates
   carries a name unique to the run. The framework's `.gitignore` line for `.e2e/cache/` is removed
   in `e2e.dir`, so the recordings can be committed.
5. **A first run that records,** on the target. A red test is a ✗ on that criterion; the assertion is
   never weakened to make it green. Only a mistake in the test (an ambiguous locator, a read before
   the page is drawn) is corrected, at most `limits.attempts` times.
6. **A second run with `--strict-cache`** (`npx e2e run --strict-cache --tag prd-<n>`): it must be
   green. When it is not, the test is unstable: say so, and open no green sub-PR.
7. **The kit's checks:** `omni e2e status <n>`, then `omni e2e heals <n>`. On a first pass every step
   is new; on a later pass each healed step becomes an outbox item with its before and after, which a
   person confirms or rejects.
8. **A sub-PR into the feature branch** (`labels.sub`, `Part of #<n>`) holding the tests, `e2e.dir`'s
   recordings and a table criterion → test → verdict (✓, ✗, or "not filmable"), with the healed
   steps listed. It changes no state, label or check of the feature PR, merges nothing and marks
   nothing ready.

The skill never edits the code under test, never reads its diff, and never merges.

## Decisions

- **A manual skill, no CI job in this PRD** (asked): replaying the suite after a merge needs a runner
  with Node 24 and access to the target; it is the next PRD, once the beta has earned trust. Until
  then the strict replay is a documented command.
- **Tests are written after ready, from the spec alone** (asked): the skill is told not to read the
  diff. The same session may have seen the code, so this is a rule of the skill, and a person reads
  the tests in the sub-PR.
- **The tests arrive in a sub-PR into the feature branch** (asked): the person reads the tests and
  the recordings' diff in one place, merges them into the feature, and they reach `main` with the
  PRD, without reopening the feature PR.
- **The kit does the deterministic part** (asked, approach 2 of 3): `omni e2e status` and `heals` are
  tested code; the skill orchestrates and writes. A skill alone would leave "healed, or not" to a
  model's reading, which is the risk the spike found. A wrapper around the framework was refused:
  it would depend on the internals of a v0.18 tool, where this depends only on a file format whose
  schema is checked.
- **The recording's diff is the "healed step" signal** (taken here, the only one the framework
  gives): nothing in a run's summary says healed, only `missed` or `handed off`.
- **Exact `expect()` over `agent.assert`** (spike, F4 and F10).
- **It sits beside `/omni:prove` and the acceptance scenarios** (the idea's own choice): they describe
  the same criteria, and are merged only if this proves itself.
- **No persona objected:** this computer has no Omni sign-in (`no-sign-in`), so the business read
  listed no persona; no `voice.json` is written and no dossier page was opened.
- The evidence for every figure above is in the spike's notes, on branch
  `spike/e2e-validate-prd-1017` (commit `d14489ea`): the plan, the dated results and the findings log.

## User stories

1. As a person who ships a PRD, I run `/omni:validate-e2e 1017` and get a sub-PR with one test per
   criterion a screen can show, their recordings, and a table saying which criterion passed.
2. As a reviewer, I open the sub-PR and see, for each recording that changed since the last pass, the
   action before and after, so I can tell a healed step from a new one.
3. As a maintainer, I run `omni e2e status 1017` and learn at once whether a recording is missing.
4. As a repository that did not opt in, I see no change at all: the block is off and the skill stops
   in one line.

## Scope

- In: the `e2e:` block and its schema, `omni e2e status` and `omni e2e heals`, the skill, `omni help`,
  a guide page, and their tests.
- Out: a post-merge CI job, `/omni:yolo` wiring, the QA tenant and test account, quarantine and
  retirement, mobile, merging with `/omni:prove`, and anything that runs the framework or a model from
  inside `omni e2e`.

## Test seams

The repository's tests sit beside the code (`*.test.ts` under `kit/`), run by `pnpm test`, and never
reach the network, a browser or a model.

- **`kit/lib/e2e/` (pure):** reading a recording and normalising its actions; the comparison of two
  sets of recordings (healed, new, removed, unchanged); `status` over a list of tests and a list of
  recordings; a `schemaVersion` other than `trace-1`; a file that does not read. Small `trace-1`
  fixtures, copied from the spike's recordings.
- **`kit/bin/commands/e2e.test.ts`:** the commands' contract: the JSON, the exit codes, and the
  behaviour when `e2e` is off or incomplete.
- **`kit/lib/config.test.ts` and `kit/lib/schema/config.test.ts`:** the defaults (`enabled: false`),
  a valid `url`, a non-empty `model`.
- **Not in CI:** the skill (prose) and the framework. The proof that it works is the spike on PRD
  1017, cited above; a first run of the skill on a real PRD is the next check.

## Risks

Merging this PRD publishes kit code: a command, a config block and a skill, with no migration and no
change of stored data. The block is off by default, so a repository that enables nothing sees no
change. Roll back by reverting the feature PR.

- **A healed step passes for a pass.** Answered by committing the recordings and reading their diff
  in the sub-PR; the strict replay is the check after a merge, and until a CI job runs it, it is a
  command someone must run.
- **A young tool.** The framework is v0.18. The kit depends on one file format and checks its schema
  version; the model and the framework version are pinned where the tests live.
- **The same agent writes the code and the test.** The skill reads the spec alone, and a person reads
  the tests in the sub-PR; the risk is reduced, not removed.
- **A change in a page's data makes an unrelated step stale** (seen once in the spike, cause not
  explained): under `--strict-cache` that is a failure to triage, and may be noisy on pages driven by
  data.
- **The framework's anonymous telemetry** (`E2E_TELEMETRY_DISABLED=1` opts out): the skill sets it,
  and the guide says so.

## Acceptance criteria

1. With `e2e.enabled` false or `e2e.url` null, `/omni:validate-e2e <n>` prints one line and stops,
   having written and posted nothing.
2. Under a Node older than 24.8, the skill prints one line naming the version it needs, and stops.
3. `omni e2e status <n>` prints, as JSON, the tests tagged `prd-<n>` under `e2e.dir` with whether each
   has a recording, and exits non-zero when one has none.
4. `omni e2e heals <n>` pairs steps by `recordedFor.testId` and `recordedFor.callIndex` between the
   merge-base and the head, and lists each as healed, new or removed; for a healed step it gives the
   old and the new action.
5. A `schemaVersion` other than `trace-1`, or a recording that does not read, makes `omni e2e` fail
   with a message that names the file.
6. Each filmable criterion of the spec has one test tagged `prd-<n>`; each criterion that is not
   filmable is listed as such and has no e2e test.
7. No test uses `agent.assert` without a line saying why nothing exact exists, and the skill reads no
   part of the code's diff.
8. A test that fails on the target is reported ✗ for its criterion, with its assertion unchanged.
9. The skill opens a sub-PR into the feature branch (`Part of #<n>`) holding the tests, the
   recordings and a criterion → test → verdict table; it merges nothing and marks nothing ready.
10. On a later pass, each healed step becomes an outbox item with its before and after, and none is
    taken as accepted until a person confirms it.
