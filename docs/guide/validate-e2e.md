---
title: Validate with e2e (beta)
description: The e2e block, the two commands that check a PRD's recordings, the strict replay by hand, and how to read the sub-PR that /omni:validate-e2e opens.
---

`/omni:prove` films each acceptance criterion of a PRD against its preview, then throws the scripts
away. `/omni:validate-e2e` keeps them: one end-to-end test per criterion a screen can show, and the
recording of each, committed in a sub-PR so the next PRD that breaks the same screen is caught by a
test, not by a person.

This is a **beta**. The block is **off by default**, a repository that does not turn it on sees no
change, and **nothing runs after a merge**: the skill is run by a person, or by `/omni:yolo` when the spec asks (below), once a feature pull request
is ready, and the replay after a merge is a command someone types (below).

## Ask for it in the spec

Add `e2e: validate` to a spec's front matter, as `proof: video` asks for the proof:

```yaml file=spec.md
---
prd: 1275
e2e: validate
---
```

`/omni:brainstorm` asks the question when the repository has `e2e.enabled`, and writes the field on a
yes. With the field set and e2e enabled, `/omni:yolo` follows `/omni:validate-e2e` by itself **after
the feature PR is ready**, before it reports. A spec without the field, or a repository with e2e off,
sees no e2e step. `validate` is the only value: `omni check inbox` refuses any other and names the PRD.

**It never blocks.** A ✗ verdict, a stop line or a failed run is reported, and never changes the
feature PR's draft or ready state, its labels or its checks. You find the verdict table as a sub-PR on
the feature PR. Each automatic run costs a model session and a few minutes.

## How it keeps a check

The tests use the open-source e2e framework by tester.army. A goal step (`agent.act`) is driven by a
model the first time and its actions are recorded; later runs replay the recording with no model
call. That is also the danger: when a screen changes, the model can click the new thing, the test
stays green and the recording is silently overwritten. A suite that heals itself past a changed
screen protects nothing. So the recordings are **committed**, they are the reference, and a change to
one is something a person reads. A **healed** recording is the exception: it waits outside the
branch until someone confirms it (below).

## The `e2e:` block

In `.omni-loop/config.yml`. `omni config e2e` prints it, and refuses an invalid one.

```yaml file=.omni-loop/config.yml
e2e:
  enabled: false
  url: null
  deployment: null
  setup: null
  bypassEnv: null
  dir: e2e
  model: anthropic/claude-sonnet-5.5
```

- **`enabled`**: `false` by default. While it is false, or `url` is `null`, the skill prints one line
  and stops, having written and posted nothing.
- **`url`**: where the tests run. A fixed address, or `github-deployment` for the preview of the
  feature pull request's head commit, as `proof.url` does. See **A fixed address** below when the
  preview has no data.
- **`deployment`**: which deployment, when a commit has several previews.
- **`setup`**: a command that signs the browser in, run once, as `proof.setup`.
- **`bypassEnv`**: the name of the environment variable that holds the preview-protection bypass
  secret. It is sent as a header and never printed. The name must be a valid variable name.
- **`dir`**: the folder, in this repository, where the tests and their recordings live. It may not be
  empty.
- **`model`**: the model that drives the goal steps, as an OpenRouter id. It may not be empty. The
  call uses the `OPENROUTER_API_KEY` the kit already reads; no key is written in any file.

A repository that already configured `proof` copies its `url`, `deployment`, `setup` and `bypassEnv`
and reaches the same target. In a plan repository, `url` points at the environment the plan
repository builds from the target pull requests.

## Requirements

Node 24.8 or newer. Under an older Node the skill prints one line naming the version it needs and
stops. The framework sends anonymous telemetry; the skill sets `E2E_TELEMETRY_DISABLED=1`, and you
should set it too when you run a test by hand.

## The e2e project, set up on the first run

The first run in a repository sets the e2e project up, and commits it in the sub-PR. You do not edit
workspace files by hand.

- **The scaffold.** `e2e.dir` becomes a declared workspace of the repository's package manager, with
  its own `package.json` and the framework's dependencies. Declaring it matters: a repository's
  dependency gate (fallow, for one) refuses a folder with its own `package.json` that is not a
  workspace, so the gate passes on the sub-PR's commit. A repository that wants another layout
  declares it first, and the skill leaves it alone.
- **The version check.** The workspace is pinned to the package-manager version the repository's CI
  uses. Before it installs, the skill compares that version with the one on your machine. When yours
  is newer, it stops with one line naming both versions, having installed nothing: installing with a
  newer manager would rewrite the whole lockfile. Switch to CI's version and run it again.
- **Record last.** The install comes first, then the recording, then the strict replay. Change an
  installed dependency after recording and the recordings are stale (`REPLAY_STALE`), so the skill
  records again before the strict replay.

## A fixed address

A preview without a database draws nothing, so a criterion cannot be filmed there. Set `e2e.url` to a
fixed address, a local or hosted demo that has data, instead of `github-deployment`. The run then
targets that address, and the sub-PR body says the target was **not the preview**, and why. A reader
of the sub-PR sees that the tests were not run against the pull request's own build.

## In a plan repository

When the repository is a plan repository (its config has a `plan` section) and the product spans
several repositories, the skill works differently in four ways.

- **Where it lands.** The e2e project, the tests and the recordings are written in the **plan
  repository's** `e2e.dir`, and the sub-PR is opened there. A target repository is never written.
- **What the tests run against.** The target is the environment the plan repository builds from the
  target pull requests together, not one repository's preview. `e2e.url` and `e2e.setup` name that
  environment, and the skill reads them from config; it never guesses them.
- **A name unique to the run.** Every record a test creates carries a name built from a value that is
  new on every run (a timestamp or a random suffix), so two runs on the shared QA tenant do not
  collide. This holds outside a plan repository too, unless the PRD's answer says otherwise.
- **A saved session.** Google refuses to sign in a browser an automated tool drives, so the run does
  not type a password. `e2e.setup` writes a saved session (`storage-state.json`) in the run's own
  folder, outside `e2e.dir`, as `/omni:prove` does, and the tests load that file. The skill never
  prints, logs or commits a credential and never shows one to the model.

### The guard

```bash terminal
node .omni-loop/bin/omni.mjs e2e guard 1276
```

Before anything is committed, the skill runs the guard. It exits non-zero and names `file:line` and
the kind of shape (a password, a token, a key, a session state), **never the value**, when a file of
`e2e.dir` (other than the recording cache) holds one. A `storage-state.json` found under `e2e.dir` is
refused by name. A non-zero exit stops the run: no commit and no sub-PR follow, until the file it
names is fixed. With `e2e.enabled` false it says so in one line and exits non-zero.

### QA chooses the flows and the account

The kit does not choose what to test or who signs in. **QA chooses the flows** to cover first and **the
test account** the runs use, and keeps its credentials out of the code (in the environment that runs
`e2e.setup`). The sub-PR states which QA flow and which account the run used, the account **by
label**, never the secret. The first real run is done by QA in the plan repository.

## Run it

```text agent
/omni:validate-e2e 1233
```

The skill reads the spec's acceptance criteria and **never the diff of the code**, so a test checks
what was asked, not what was built. It classes each criterion as filmable (a screen can show it) or
not (a config value, a log line); the latter stays an ordinary unit or integration test. It writes
one test per filmable criterion under `e2e.dir`, tagged `prd-<n>`, and runs them twice: a first run
that records, then a strict replay. Then it checks the recordings with the two commands below and
opens a sub-PR into the feature branch.

The tests pin every outcome with an exact `expect()`. `agent.assert` is allowed only where nothing
exact exists, with a line saying why, because it calls the model on every run, replayed or not.
Every read of the screen waits for it to be drawn, and every record a test creates carries a name
unique to the run.

A red test is a ✗ on its criterion. The assertion is never weakened to turn it green. The skill never
edits the code under test, merges nothing and marks nothing ready.

## `omni e2e status <n>`

```bash terminal
node .omni-loop/bin/omni.mjs e2e status 1233
```

Lists, as JSON, the tests tagged `prd-<n>` under `e2e.dir`, each with `recording` true or false, and
exits non-zero when one has none. It is the gate that a missing recording must not pass as a green
run. A recording that is not valid JSON, or whose `schemaVersion` is not `trace-1`, fails the command
and names the file: a framework upgrade never passes in silence. With `e2e.enabled` false it says so
in one line and exits non-zero, reading no file. It runs no test, reaches no network and calls no
model.

## `omni e2e heals <n>`

```bash terminal
node .omni-loop/bin/omni.mjs e2e heals 1233
node .omni-loop/bin/omni.mjs e2e heals 1233 --head feat/my-topic--s9
```

Reads the recordings (`.e2e/cache/*.json`) at the merge-base of the trunk and the head, and pairs their steps by `recordedFor.testId`, `recordedFor.callIndex` and `recordedFor.instructionDigest` (two steps of one test can share a call index), never by file name.
Each step is:

- **healed**: on both sides with a different action (`name` and `target`). The output gives the old
  action, the new action and the recording's `summary`.
- **new**: only at the head.
- **removed**: only at the merge-base. A test that disappeared can hide a criterion that was lost.

**`--head <ref>`** names the head. Without it the head is the PRD's feature branch, so existing use
does not change. The skill passes the sub-PR's own branch, so the recordings it just made are
compared with the merge-base and, on a first pass, every step is listed as **new**. An unknown `<ref>`
fails with a usage error naming it.

An identical step is not listed. The same refusals as `status` hold for both sides.

Each healed step also carries its **screenshots**, a before (at the merge-base) and an after (at the
head), paired by the same keys. The framework keeps no screenshot per step, so today each side says
`kept: false` and gives the reason; when a framework keeps one, the path or reference is listed
instead.

## `omni e2e hold <n>`, `confirm <n>` and `reject <n>`

```bash terminal
node .omni-loop/bin/omni.mjs e2e hold 1233
node .omni-loop/bin/omni.mjs e2e confirm 1233
node .omni-loop/bin/omni.mjs e2e reject 1233
```

A healed recording is not committed with the rest. Three commands decide where it goes:

- **`hold`** lists the healed recordings of the working tree and moves each out of the branch, into a
  folder inside the git directory that no commit holds. The committed recording is put back, so a
  commit of `e2e.dir` holds only recordings that are unchanged or new.
- **`confirm`** commits the held recordings and notes them in `e2e.dir/.e2e/confirmed.json`. It is
  the follow-up step: the change was wanted. A later run with no screen change then lists no healed
  step in `omni e2e heals`.
- **`reject`** drops the held recordings, leaves the committed ones as they were, and exits non-zero,
  so the test stays red: the product broke, or the change was not wanted.

**Who confirms is a separate decision.** These commands say what happens on each answer, not who
gives it: that is asked of QA in the PRD that wires this into `/omni:yolo`.

## The strict replay, by hand

Nothing replays the suite after a merge in this beta. To check that the committed recordings still
match the product, run:

```bash terminal
E2E_TELEMETRY_DISABLED=1 npx e2e run --strict-cache --tag prd-1233
```

With `--strict-cache` a stale recording **fails** (`REPLAY_STALE`) instead of being re-recorded by a
model. The skill runs this itself as its second run, and the second run must be green: when it is
not, the test is unstable, the skill says so, and it opens no green sub-PR. A change in a page's data
can make an unrelated step stale; under a strict replay that is a failure to triage, and it may be
noisy on pages driven by data.

## Why the recordings are committed

A recording is the reference that makes a mismatch a failure. Ignored by git (the framework's
default), it would be rewritten by every run and a changed screen would never show. So the skill
removes the framework's `.gitignore` line for `.e2e/cache/` in `e2e.dir`, and the sub-PR carries the
recordings. Their diff is the only signal the framework gives that a step changed: nothing in a run's
summary says "healed", only `missed` or `handed off`.

## What you read in the sub-PR

The sub-PR goes into the feature branch (`Part of #<n>`). It holds the tests, the recordings, and a
table of criterion, test and verdict: **✓**, **✗**, or "not filmable".

- On a first pass every step is **new**.
- On a later pass, each **healed** step becomes an outbox item with its action before and after and
  its before and after screenshots, or a line saying that none was kept and why. It means the product
  changed under a test and a model found its way to the new screen. The healed recording is **not in
  the sub-PR**: it waits, held outside the branch, until a person runs `omni e2e confirm` (the change
  was wanted: the recording is committed) or `omni e2e reject` (the product broke: the committed
  recording stays and the test stays red).
- A **removed** step is worth a look: ask where its criterion went.
- The sub-PR holds only recordings that are unchanged or new, so merging it accepts no healed step.

Read the tests too. The same agent may have seen the code, so reading the spec alone is a rule of the
skill, not a guarantee; a person reading the tests in the sub-PR is the check.

[Next → Use cases](/docs/use-cases)
