---
name: validate-e2e
description: Beta. Turns a PRD's filmable acceptance criteria into e2e tests that stay — one test per criterion, tagged prd-<n>, written from the spec alone, run once to record and once with --strict-cache to replay, checked with omni e2e status and omni e2e heals, then opened as a sub-PR into the feature branch holding the tests, their committed recordings and a criterion, test and verdict table. Stops with one line when e2e.enabled is false, e2e.url is null or Node is older than 24.8. Merges nothing and marks nothing ready. A person runs it on a ready PRD. Triggers on "validate this PRD with e2e", "write e2e tests for the criteria", "/omni:validate-e2e 1233".
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
  Otherwise `e2e.url` is the fixed URL itself.
- **The bypass.** When `e2e.bypassEnv` names an environment variable, every request sends its value
  as the `x-vercel-protection-bypass` header. Never print the value, and never write it to a file.
- **Signed in.** When `e2e.setup` is set, run that command once from the repository's root, with
  `PROOF_STORAGE_STATE=<run dir>/storage-state.json` and `PROOF_URL=<the URL>` in its environment.
  A setup that fails stops the run with `e2e setup failed: <its last line>`.
- **Reachable, or stop.** Fetch the URL once. A 401, a 403, a 5xx or a timeout of 30 seconds stops
  the run: `preview not reachable: <status>` (`timeout` for a timeout).

## 3. The criteria, from the spec alone

Read the spec's **Acceptance criteria** (`omni prd <n>` names the spec), and nothing of the code:
never the diff of the feature branch, and no source file to learn what the change does. Class each
criterion:

- **filmable**: a screen can show it. It gets one test.
- **not filmable**: a config value, a log line, a command's exit code. Say why in one line; it stays
  an ordinary unit or integration test and has no e2e test.

## 4. One test per filmable criterion

Under `e2e.dir`, one test per filmable criterion, tagged `prd-<n>`.

- Navigate with `agent.act`; pin every outcome with an exact `expect()`.
- Use `agent.assert` only where nothing exact exists, with a comment line saying
  why nothing exact exists: it calls the model on every run, replayed or not.
- Every read of the screen begins with an `expect` that waits for it to be drawn, and every record a
  test creates carries a name unique to the run.
- Remove the framework's `.gitignore` line for `.e2e/cache/` in `e2e.dir`, so the recordings can be
  committed.

## 5. A first run that records

Run the tests on the target with `E2E_TELEMETRY_DISABLED=1` set and `e2e.model` as the goal steps'
model (through OpenRouter, with the `OPENROUTER_API_KEY` the kit already reads; write no key in any
file): `npx e2e run --tag prd-<n>`.

A red test is a ✗ on its criterion; the assertion is never weakened to make it green. Only a mistake
in the test (an ambiguous locator, a read before the page is drawn) is corrected, at most
`limits.attempts` times.

## 6. A second run with `--strict-cache`

Run `npx e2e run --strict-cache --tag prd-<n>` with `E2E_TELEMETRY_DISABLED=1`. It must be green.
When it is not, the test is unstable: say so, name the test, and open no green sub-PR.

## 7. The kit's checks

Run `node .omni-loop/bin/omni.mjs e2e status <n>`; a non-zero exit (a test with no recording) stops
the run before any sub-PR. Then run `node .omni-loop/bin/omni.mjs e2e heals <n>`. On a first pass
every step is new. On a later pass each healed step becomes an outbox item with its before and after
(`node .omni-loop/bin/omni.mjs item new --prd <n> --slice e2e --file <file> --json`, the JSON in a
scratch file outside the repository): none is taken as accepted until a person confirms it. Say in
the sub-PR that the recordings, a healed one included, are committed from the start and count as
accepted only when it is merged, and that an item carries the action before and after, no screenshots.

## 8. The sub-PR

Branch from `<remote>/<feature branch>`, commit the tests and `e2e.dir`'s recordings (nothing else,
and no secret), push, and open a sub-PR into the feature branch through `/omni:pr` with the
`labels.sub` label and `prLinks.sub` (`Part of #<n>`). Its body holds a table, then the healed
steps, then the footer line:

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
- Never run without `E2E_TELEMETRY_DISABLED=1`.
