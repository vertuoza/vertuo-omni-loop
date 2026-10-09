---
name: validate-e2e
description: Beta. Turns a PRD's filmable acceptance criteria into e2e tests that stay — one test per criterion, tagged prd-<n>, written from the spec alone, set up as a declared workspace on its first run, run once to record (last, after every install) and once with --strict-cache to replay, checked with omni e2e status and omni e2e heals --head, healed recordings held back with omni e2e hold, then opened as a sub-PR into the feature branch holding the tests, their unchanged and new recordings and a criterion, test and verdict table. Stops with one line when e2e.enabled is false, e2e.url is null, Node is older than 24.8 or the local package manager is newer than CI's. Merges nothing and marks nothing ready. A person runs it on a ready PRD. Triggers on "validate this PRD with e2e", "write e2e tests for the criteria", "/omni:validate-e2e 1233".
---

# Validate e2e (beta): keep what a PRD's criteria check

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

A person runs it on PRD n once its feature PR is ready. It is never run by default: each run costs a
model session and a few minutes. It never edits the code under test, never reads the code's diff, and
never merges.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line. The sub-PR's body ends with the
line `omni sign footer` prints, as a paragraph of its own just above your session's own attribution
lines. Comments are never signed. A command that prints nothing means signing is off: add nothing.

## Input

A PRD number, `<n>`. With no number, say that this skill takes one, and stop.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON;
`<remote>` is `repo.remote`, `<worktrees>` is `worktrees`, and `<feature branch>` is
`branches.feature` with `{topic}` filled by the PRD folder's topic (`node .omni-loop/bin/omni.mjs prd <n>`
names `<nnnn>-<topic>`).

## 1. Configured, or stop

Run `node .omni-loop/bin/omni.mjs config e2e`. When its `enabled` is false or its `url` is `null`,
print this one line and stop; the run writes nothing and posts nothing:

```text
e2e is not configured here: set e2e.enabled and e2e.url in .omni-loop/config.yml
```

Then run `node -v`. Below 24.8, print this one line and stop, with the same guarantee:

```text
e2e needs Node 24.8 or newer: this is <the version node -v printed>
```

Then find the feature PR: `gh pr list --head <feature branch> --state open --json number,url,headRefOid,isDraft`.
None open: say `PRD <n> has no open feature PR`, and stop. A draft goes on, with one line saying it is
not ready yet.

## 2. The target

As `/omni:prove` reaches it, with the `e2e` block in place of `proof`:

- **The URL.** With `e2e.url: github-deployment`, the preview of the feature PR's head commit:
  `gh api repos/<repo.slug>/deployments?sha=<headRefOid>`, then the newest deployment's statuses, whose
  `success` status carries `environment_url`. When `e2e.deployment` is set, only the deployments whose
  `environment` is exactly that count. Wait up to **10 minutes**, looking again every 20 seconds.
  Otherwise `e2e.url` is the fixed URL itself: a local or hosted demo, for a preview that has no data
  to draw. Keep the reason in one line (the preview has no database, say), for step 9: the target was
  not the preview.
- **The bypass.** When `e2e.bypassEnv` names an environment variable, every request sends its value
  as the `x-vercel-protection-bypass` header. Never print the value, and never write it to a file.
- **Signed in.** When `e2e.setup` is set, run that command once from the repository's root, with
  `PROOF_STORAGE_STATE=<run dir>/storage-state.json` and `PROOF_URL=<the URL>` in its environment.
  A setup that fails stops the run with `e2e setup failed: <its last line>`.
- **Reachable, or stop.** Fetch the URL once. A 401, a 403, a 5xx or a timeout of 30 seconds stops
  the run: `preview not reachable: <status>` (`timeout` for a timeout).

- **In a plan repository** (its config has a `plan` section), the target is the environment the plan
  repository builds from the target PRs together, not one target repository's preview. `e2e.url` and
  `e2e.setup` are read from config, never guessed, and name that environment.
- **The session.** Here and elsewhere, the run signs in from the saved session `e2e.setup` writes
  (`storage-state.json` in the run dir, outside `e2e.dir`), as `/omni:prove` does. The skill never prints, logs or commits a credential and never shows one to the model: the
  tests load the session file, and no password, token or key is typed, echoed or written anywhere.

## 3. The criteria, from the spec alone

Read the spec's **Acceptance criteria** (`omni prd <n>` names the spec), and nothing of the code:
never the diff of the feature branch, and no source file to learn what the change does. Class each
criterion:

- **filmable**: a screen can show it. It gets one test.
- **not filmable**: a config value, a log line, a command's exit code. Say why in one line; it stays
  an ordinary unit or integration test and has no e2e test.

## 4. The e2e project, once

Check what `e2e.dir` holds before any install. When it has no `package.json`, create the project now,
and it is committed in the sub-PR:

- **Declare it a workspace** of the repository's package manager (a `packages` entry for `e2e.dir` in
  `pnpm-workspace.yaml`, or `workspaces` in the root `package.json`), so the repository's dependency
  gate accepts the folder. Give it its own `package.json` with the e2e framework's dependencies. A
  repository that wants another layout declares it before the run.
- **Check the package manager against CI first.** Read the version CI uses (the root `packageManager`
  field, else the version the workflows pin). When the local one (`pnpm -v`, `npm -v`) is newer than
  that, print one line that names both versions and stop before it installs; the run changes no file:

```text
e2e package manager is newer than CI's: local <local version>, CI <CI version>
```

- **Then install the dependencies,** with the local package manager at CI's version. Only the new
  workspace's lines may enter the lockfile: a lockfile rewritten whole means the versions differ, so
  stop with the line above.

**In a plan repository** (its config has a `plan` section), the e2e project, the tests and the
recordings are all in the plan repository's `e2e.dir`, and the sub-PR is opened there. The skill never
writes a target repository: no test, recording, workspace entry or lockfile line goes into one.
Outside a plan repository the skill runs exactly as before.

## 5. One test per filmable criterion

Under `e2e.dir`, one test per filmable criterion, tagged `prd-<n>`.

- Navigate with `agent.act`; pin every outcome with an exact `expect()`.
- Use `agent.assert` only where nothing exact exists, with a comment line saying
  why nothing exact exists: it calls the model on every run, replayed or not.
- Every read of the screen begins with an `expect` that waits for it to be drawn.
- Every record a test creates carries a name unique to the run, built from a value that is new on every run (a
  timestamp or a random suffix), in a plan repository and outside one, unless the spec's answer says otherwise.
- Remove the framework's `.gitignore` line for `.e2e/cache/` in `e2e.dir`, so the recordings can be
  committed.

## 6. A first run that records, last

Record last: run after every install is settled, so a recording is never made before the dependencies.
Run the tests on the target with `E2E_TELEMETRY_DISABLED=1` set and `e2e.model` as the goal steps'
model (through OpenRouter, with the `OPENROUTER_API_KEY` the kit already reads; write no key in any
file): `npx e2e run --tag prd-<n>`.

A red test is a ✗ on its criterion; the assertion is never weakened to make it green. Only a mistake
in the test (an ambiguous locator, a read before the page is drawn) is corrected, at most
`limits.attempts` times.

## 7. A second run with `--strict-cache`

Run `npx e2e run --strict-cache --tag prd-<n>` with `E2E_TELEMETRY_DISABLED=1`. It must be green.
When it is not, the test is unstable: say so, name the test, and open no green sub-PR.

A dependency installed or changed after the first run (the lockfile or the e2e `package.json` moved)
stales the recordings: record again with step 6 before this strict replay, then replay.

## 8. The kit's checks

Run `node .omni-loop/bin/omni.mjs e2e status <n>`; a non-zero exit (a test with no recording) stops
the run before any sub-PR. Then run `node .omni-loop/bin/omni.mjs e2e heals <n> --head <sub-PR branch>`, the branch step 9 pushes: it
compares the feature branch's steps with that branch's, so on a first pass every step is new. On a later pass each healed step becomes an outbox item
(`node .omni-loop/bin/omni.mjs item new --prd <n> --slice e2e --file <file> --json`, the JSON in a
scratch file outside the repository) holding the action before and after and the before and after
screenshots `heals` lists for it. When `heals` says none was kept, the item says so and says why, in
the reason `heals` gives. None is taken as accepted until a person confirms it.

Then run `node .omni-loop/bin/omni.mjs e2e hold <n>`: it takes each healed recording out of the
branch, so a commit of `e2e.dir` holds only unchanged or new recordings. A held recording waits there
until `node .omni-loop/bin/omni.mjs e2e confirm <n>` commits it, or
`node .omni-loop/bin/omni.mjs e2e reject <n>` drops it, leaves the committed one and keeps the test
red. Name both commands in each healed step's item. This skill runs neither, and does not say who
confirms.

Then run `node .omni-loop/bin/omni.mjs e2e guard <n>` before anything is committed: a non-zero exit stops the
run, and no commit or sub-PR follows. Fix the file it names (`file:line`, never the value) and run it again.

## 9. The sub-PR

Branch from `<remote>/<feature branch>`, commit the e2e project, the tests and only unchanged and new recordings of `e2e.dir` (the workspace entry and its lockfile lines included, nothing else,
and no secret): a healed recording is not committed, it waits held until a person confirms it, so the sub-PR holds no healed recording. Push, and open a sub-PR into the feature branch through `/omni:pr` with the
`labels.sub` label and `prLinks.sub` (`Part of #<n>`). When `e2e.url` was a fixed URL, its body opens with one line saying the target was not the preview, and
why (the reason kept in step 2). The body holds that line, a line stating which QA flow and which account the run used (the account
by label, never the secret), a table, then the healed steps, then the
footer line:

```markdown
| criterion | test | verdict |
| --- | --- | --- |
| <criterion text> | <test file and name> | ✓ |
| <criterion text> | <test file and name> | ✗ <first line of the error> |
| <criterion text> | — | not filmable: <why> |
```

Each verdict is ✓, ✗ or "not filmable". It changes no state, label or check of the feature PR.
Print the sub-PR's link and the ✓/✗/not filmable counts.

## Never

- Never merge, and never mark any pull request ready.
- Never read the code's diff, and never edit the code under test.
- Never weaken an assertion to turn a test green, and never use `agent.assert` without its line.
- Never print, log or save the bypass secret or the model key.
- Never print, log, save or show a credential to the model.
- Never run without `E2E_TELEMETRY_DISABLED=1`.
