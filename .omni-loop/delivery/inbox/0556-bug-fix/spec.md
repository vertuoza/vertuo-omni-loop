---
prd: 556
title: /omni:bug-fix, a fast lane from a bug report to one PR
blocked-by: none
spec: file
---

## Problem

A reported bug has two routes today, and neither fits. `/omni:brainstorm` gives it a spec, a plan, a
phase-0 PR and waves: four pull requests and a review gate for what is almost always one slice.
Fixing it by hand skips what makes a bug fix trustworthy: a reproduction seen failing before the
fix, a triage that says how bad it is and whether something broke it, and a guard so it does not
come back.

vertuo-ai-domain already has this discipline as `vertuo-fix-bug`, but it is tied to that
repository's browser harness, QA target and Stryker script. The kit already holds the pieces a port
needs: the `bug-fixing` playbook form (`omni kb show bug-fixing`, kit default steps), the config key
`branches.fix`, and the fast-lane pattern `/omni:visual-fix` set in PRD 541: its own issue, one fix
branch, a committed record under `paths.delivery`, a proof verb and one PR a person merges.

## Solution

A new skill, `/omni:bug-fix`, the second fast lane beside the loop. A bug goes from one line, or an
existing issue, to one pull request into the default branch that a person merges. There is no PRD,
dossier, inbox folder, spec, plan, phase-0 PR, feature branch, wave or outbox.

### The flow

`/omni:bug-fix '<one line>'`, or `/omni:bug-fix <n>` for an existing issue.

0. **Start.** `omni config`, then `omni kb show briefing` (its rules bind every step), `omni kb
   show bug-fixing` and `omni kb show testing`. The `bug-fixing` form adds to the skill's steps; it
   never overrides them.
1. **Issue.** With a line: open an issue titled `Bug: <line>`, labelled `labels.bug`, signed. With a
   number: read it (`gh issue view <n> --comments`, and every CI run it links), use it as it is,
   and add `labels.bug` when it does not carry it. Labels follow `/omni:pr`'s **Labels** rules: a
   missing label is created only when `labels.autoCreate` is true, and a label that cannot be added
   is said in the triage comment, never a reason to stop.
2. **Classify.** A bug is something a user, a browser or an API caller can observe. A flaky test, a
   CI timeout or a slow job is tooling: the skill posts the triage comment with
   `**Kind:** tooling — not a behaviour bug` and one sentence why, and stops.
3. **Triage.** One comment on the issue, found by its marker `<!-- omni-bug:triage -->` and edited
   in place on a rerun (comments are never signed):

   ```markdown
   <!-- omni-bug:triage -->

   ## Triage

   - **Kind:** behaviour bug
   - **Domain:** <the knowledge area or code area that owns the behaviour>
   - **Risk:** <critical | high | medium | low> — <who is hurt, how, workaround or not>
   - **Regression:** yes — <culprit PR or commit | green run → red run | the report's "last worked">
     | new bug — no evidence this ever worked
   - **Reproduction:** `<path of the test or scenario>`
   - **Branch:** `<fix branch>`
   ```

   The risk levels and the regression evidence are the ones `omni kb show bug-fixing` defines. The
   issue gets the risk's label (`labels.riskCritical`, `labels.riskHigh`, `labels.riskMedium` or
   `labels.riskLow`) and, for a regression only, `labels.regression`.
4. **Boundary** (below). Checked here, and at every later step.
5. **Branch.** A worktree on `branches.fix` with `{topic}` = `<n>-<slug>`, cut from
   `<remote>/<repo.defaultBranch>`. It never commits on the default branch.
6. **Words first.** Every term the reproduction needs is in `paths.glossary` when it is set; a
   missing term is added in the same commit as the reproduction. With no glossary, the words come
   from `paths.knowledge` and `paths.context`. A term that cannot be defined without inventing
   product behaviour stops the skill with a question to the person, naming the term.
7. **Prove red.** Write the reproduction, in the domain's words:
   - an acceptance scenario under `acceptance.dir` when `acceptance.enabled` is true and the
     harness (`acceptance.run`) can observe the bug;
   - otherwise an ordinary test, at the level `omni kb show testing` picks.

   Run it before any fix. **It fails:** keep the failing line verbatim, it is the red evidence.
   **It passes:** stop, and comment on the issue with the reproduction and the two readings (it
   misses the bug, or the bug is already gone); a person decides. **It cannot run in this
   session** (a harness or a service the session lacks): the evidence is the sentence
   `Red not proven here — <why>; CI is the proof`, and the skill carries on.
8. **Fix.** Test-first, the smallest change that turns the reproduction green, in the repository's
   own patterns (`omni kb show conventions`). **Never edit the reproduction to make it pass.** Then
   run `commands.preflight` until it is green; when it is null, say so.
9. **Guard.** Which cheap check would have caught this before it shipped? When one is guard-sized (a
   check script, a lint rule, a unit test), add it with its own test. Otherwise the line is
   `Guard: none — <reason>`.
10. **Mutation.** When `commands.mutation` is set: commit first, run it, and read what survives
    inside the lines the fix changed. Survivors there: strengthen the test once and rerun once. Its
    last line is the mutation evidence. When `commands.mutation` is null, the line is
    `Mutation: not set here`. When it cannot run at all, `Mutation: not run — <its last error
    line>`, without a retry.
11. **Record.** Write `<paths.delivery>/bugs/<nnnn>-<slug>/bug.md` (below).
12. **Ship.** Commit as `fix(<scope>): <what the user gets back> (#<n>)`, with the session's
    co-author trailer, then the `omni sign trailer` line. Run `omni bug <n>` until it prints `ok`.
    Push, then open the PR through `/omni:pr`: base the default branch, label `labels.bug`, a body
    starting `Closes #<n>`, then **What was wrong**, **Bug** (below), **Verified**, **Risk and
    rollback**, and the `omni sign footer` line. `/omni:pr` watches it until it is green or stuck.
13. **Hand off.** The issue, the PR, what was proven and what was not, then: review the PR and merge
    it if it is right. **A person merges.** The skill never merges.

The PR's **Bug** section:

```markdown
## Bug

- **Issue:** #<n>
- **Triage:** <domain> · <risk> · <regression — <evidence> | new bug — no evidence it ever worked>
- **Red proven:** <the failing line | Red not proven here — <why>; CI is the proof>
- **Guard:** <what it is and what it catches | none — <reason>>
- **Mutation:** <the last line | not set here | not run — <why>>
- **Record:** `<paths.delivery>/bugs/<nnnn>-<slug>/bug.md`
```

### The boundary

A bug fix restores behaviour the product already meant to have. The skill stops and hands over the
`/omni:brainstorm` line when:

- **the right behaviour is not already settled**: no spec, knowledge register, doc or plain intent
  says what should happen, so fixing it needs a product decision;
- **the fix touches a path in `risk.storedShape` or `risk.sharedContract`**: a stored shape or an
  interface others depend on;
- **the fix needs a new screen, route or API.**

Size alone is not the test: a fix across several files is still a bug fix when none of the three
holds. Crossing the line comments on the issue with what crossed it, in plain words, and
`/omni:brainstorm <the issue's line>`, then stops: no pull request, nothing pushed. A worktree
already cut stays, unpushed, and the hand-off names its path and branch.

### Stop rules

Written verbatim in the skill, so they are never argued away:

1. Not a behaviour bug: triage comment `Kind: tooling`, stop.
2. A term cannot be defined without inventing behaviour: stop and ask.
3. The reproduction passes before the fix: stop, comment on the issue.
4. The boundary is crossed: stop, comment with the `/omni:brainstorm` line.
5. `limits.attempts` red attempts at the fix, or at CI on the PR: the PR stays draft, labelled
   `labels.needsFix`, with a comment saying what is stuck, and the issue gets a comment linking it.

### The record

`<paths.delivery>/bugs/<nnnn>-<slug>/bug.md`, the only file in that folder, where `<nnnn>` is the
issue number zero-padded to four digits. It is what the future Bugs view reads.

```markdown
# Bug <n>: <the line>

## Triage

- **Domain:** <…>
- **Risk:** <level> — <sentence>
- **Regression:** <yes — evidence | new bug — no evidence this ever worked>

## Reproduction

- **File:** `<repository path of the test or scenario>`
- **Red:** <the failing line, verbatim | Red not proven here — <why>; CI is the proof>

## Fix

<What was wrong and what changed, in two or three sentences.>

## Guard

<What it is and what it catches | none — <reason>>

## Mutation

<The last line | not set here | not run — <why>>
```

### The kit pieces

| Piece | What it is |
|---|---|
| `kit/plugin/skills/bug-fix/SKILL.md` | The skill: the flow, the boundary and the stop rules above. It names every label, branch, path and command through `omni config`. |
| Labels | New config keys `labels.bug` (`omni:bug`), `labels.regression` (`omni:regression`), `labels.riskCritical` (`omni:risk-critical`), `labels.riskHigh` (`omni:risk-high`), `labels.riskMedium` (`omni:risk-medium`), `labels.riskLow` (`omni:risk-low`). `omni init` creates each, with a colour and a description, like `labels.visual` (`kit/lib/init/labels.mjs`). |
| `commands.mutation` | A new optional config key, `null` by default: the command that runs mutation testing on the changed lines. |
| Branch | The existing `branches.fix`. No new key. |
| Folder | `<paths.delivery>/bugs/<nnnn>-<slug>/`, holding `bug.md` only. The delivery README gains one paragraph about it, beside the `visual/` one. |
| `omni bug <n>` | The proof step, shaped like `omni visual <n>` (`[--base <ref>]`, default `<repo.remote>/<repo.defaultBranch>`), run on the fix branch. `ok`, or `not ok` with one line per failed check. |
| `/omni:help`, `/docs` | A help entry for the verb and one for the skill in `kit/lib/help/entries.mjs`, and a row plus a short section in `docs/guide/use-cases.md`. |

`omni bug <n>` checks that:

- exactly one folder `<paths.delivery>/bugs/<nnnn>-*` exists for `<n>`, and it holds `bug.md`;
- `bug.md` has the five sections **Triage**, **Reproduction**, **Fix**, **Guard** and **Mutation**,
  none of them empty;
- **Triage** names a risk that is one of `critical`, `high`, `medium`, `low`;
- **Reproduction** has a **File:** line naming a path that exists on the branch and that the range
  `<base>..HEAD` changes, and a non-empty **Red:** line;
- every commit of the range carries the `omni sign trailer` line, as `omni visual` checks, unless the
  config says `signature: null`.

It runs no test: the reproduction going green is CI's job. It exits `0` on `ok`, `1` on `not ok`, and
`2` when the kit is not installed, its config does not read, or `--base` does not resolve.

## Decisions

- **A fast lane beside the loop, like visual-fix.** No PRD, dossier, inbox folder, plan or outbox:
  a bug fix is one slice, and the red reproduction is its spec.
- **It opens its own issue** from one line, so every bug has an issue the PR closes and the future
  Bugs view has something to list.
- **Six new labels, all created by `omni init`:** `labels.bug`, `labels.regression` and four risk
  labels. They are config keys, named by `omni config`, never created by the skill when
  `labels.autoCreate` is false. The source skill's `risk:<level>` names were not kept: every loop
  label lives under `omni:`.
- **A committed record, `bugs/<nnnn>-<slug>/bug.md`,** with Triage, Reproduction, Fix, Guard and
  Mutation, checked by `omni bug <n>` for shape, a real reproduction file changed on the branch, and
  signed commits. **It runs no test:** rerunning the reproduction on the default branch was
  considered and not chosen, because it needs a per-file test command and is slow and flaky across
  repositories; CI proves green, and the red line records what was seen.
- **Red at the test level that fits.** An acceptance scenario when the repository has a harness that
  can observe the bug, otherwise an ordinary test. A reproduction that cannot run in the session
  says so, and CI is the proof; requiring a local run was considered and not chosen, because it
  would block repositories whose tests need services a session lacks.
- **Mutation is optional per repository,** through `commands.mutation`, `null` by default.
- **The boundary is a product decision, a risky shape, or a new surface,** not a size. A size cap
  was considered and not chosen.
- **No release note and no retro** for a bug fix, as for a visual fix. The kit's version still moves
  on every merge.

## User stories

- As a person who found a bug, I type one line and get back an issue with a triage (how bad, whether
  something broke it) and, soon after, one PR that fixes it, with no spec, plan or phase-0 PR to
  merge first.
- As the reviewer of that PR, I read its Bug section: the reproduction that failed before the fix,
  the guard, and the mutation line, and I merge.
- As anyone in the team, I find every bug as an issue labelled `omni:bug`, with its risk as a label
  and `omni:regression` when a change broke it, closed by its PR.
- As a person whose "bug" is really a missing feature or a stored-shape change, I am told so on the
  issue and handed the `/omni:brainstorm` line, rather than getting a PR that hides a decision.
- As a person whose report is a flaky test, I am told it is tooling, not a bug, and nothing is built.

## Scope

**In:** the skill, the six labels and their creation by `omni init`, `commands.mutation`, the
`omni bug` verb and its tests, the delivery README paragraph, the help entries and the use-cases
page.

**Out:**

- The Bugs and Visual views in the Omni menu, which read what this lane and visual-fix leave behind:
  their own PRD, next. That PRD also fixes the Omni app's outbox check, which stays "in progress" on
  a PR with no PRD, such as #550.
- Any change to the Omni app's merge handling: a bug PR closes an issue that is not labelled
  `labels.prd`, and the retro, knowledge harvest and release note run only for a PRD's feature PR.
- A mutation-testing setup for this repository: `commands.mutation` stays `null` here.
- Batching several bugs into one PR.

## Test seams

Read with `omni kb show testing`. Kit tests are vitest, next to the code they cover, and use the
fixtures in `kit/test/` for a repository on disk. No test calls GitHub or the network.

- **Config** (`kit/lib/config.test.mjs`): each new label key has its default and can be overridden;
  `commands.mutation` defaults to `null` and accepts a string.
- **Labels** (`kit/lib/init/labels.test.mjs`): `omni init`'s label list holds the six new labels,
  each with a colour and a description.
- **`omni bug <n>`** (`kit/bin/bug.test.mjs`, shaped like `kit/bin/visual.test.mjs`), on a fixture
  repository with a fix branch:
  - `ok` for signed commits carrying a complete `bug.md` whose reproduction file the branch adds;
  - `not ok` naming each failure alone: no folder for `<n>`, two folders for `<n>`, no `bug.md`, a
    missing or empty section, a risk outside the four levels, no **File:** line, a file that does
    not exist, a file the branch does not change, an empty **Red:** line, an unsigned commit;
  - `Guard: none — <reason>` and `Mutation: not set here` pass;
  - exit `2` outside an installed repository, and for a `--base` that does not resolve.
- **The skill** passes the plugin's existing guards: `kit/test/plugin.test.mjs` and
  `kit/test/no-literals.test.mjs` (it names no label, branch or path literally).
- **Help** (`kit/lib/help/entries.test.mjs`): the entries hold `bug` (`omni bug <n> [--base <ref>]`)
  and `bug-fix` (`/omni:bug-fix <line or n>`).

The skill's conversation (classify, triage, prove red, the fix) has no automated test. It is proven
by one live run on this repository, recorded in the feature PR.

## Risks

Read with `omni kb show releasing`. Merging publishes a new kit release, `v0.0.N`, and a new plugin
version. Repositories take the skill with `omni update`. Nothing changes for a repository that never
runs `/omni:bug-fix`, apart from six more labels that `omni init` creates.

- **A bug PR that hides a product decision.** The boundary is judged by the model. The reviewer is
  the last guard: the Bug section names the triage and the reproduction, and the diff is one slice.
- **A reproduction that does not reproduce.** Red is run before the fix and its failing line kept;
  a reproduction green before the fix stops the skill. One that could not run says so in the PR.
- **Label noise.** Six more labels in every repository `omni init` runs in; each has a description
  that says what sets it.
- **Rollback:** revert the feature PR. `omni:bug` issues, their labels and `delivery/bugs/` folders
  already created stay; they are plain issues and docs, and nothing reads them yet.

## Acceptance criteria

Acceptance scenarios are off in this repository (`acceptance.enabled` is false); every criterion
becomes ordinary tests or the live run.

1. `omni config` shows `labels.bug`, `labels.regression`, `labels.riskCritical`, `labels.riskHigh`,
   `labels.riskMedium` and `labels.riskLow` with their `omni:` defaults, and `commands.mutation` as
   `null`; `omni init` creates the six labels.
2. `omni bug <n>` prints `ok` and exits `0` on a fix branch whose one
   `<paths.delivery>/bugs/<nnnn>-<slug>/` folder holds a complete `bug.md`, whose reproduction file
   exists and is changed on the branch, and whose commits are all signed.
3. `omni bug <n>` prints `not ok` and exits `1`, naming the failure, for each of: no folder, two
   folders, no `bug.md`, a missing or empty section, a risk outside the four levels, no **File:**
   line, a reproduction file that does not exist or that the branch does not change, an empty
   **Red:** line, an unsigned commit.
4. `kit/plugin/skills/bug-fix/SKILL.md` exists and passes the plugin's guards and the no-literals
   guard.
5. `/omni:help` lists `/omni:bug-fix` and `omni bug`, and the use-cases page's table has a row for
   the skill, linked to its own section.
6. **Live run:** `/omni:bug-fix` on one real bug in this repository opens an `omni:bug` issue with the
   triage comment and its risk label, proves a reproduction red, and opens one PR labelled
   `omni:bug` that closes the issue, carries its `bug.md`, has a filled Bug section, and has
   `omni bug <n>` printing `ok`. The feature PR links that PR.
7. **Live stop:** `/omni:bug-fix` on a report of a flaky check posts the `Kind: tooling` triage
   comment and opens no PR.
