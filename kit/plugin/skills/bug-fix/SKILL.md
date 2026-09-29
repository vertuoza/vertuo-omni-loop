---
name: bug-fix
description: Takes a bug from one line, or an existing issue, to one pull request a person merges — opens (or reads) its issue, classifies it, posts a triage (domain, risk, regression), proves a reproduction red before any fix, fixes it test-first on a fix branch, adds the guard that would have caught it, runs mutation testing when the repository has it, records the fix, proves it with omni bug and opens the PR into the default branch. No PRD, spec, plan, phase-0 PR, feature branch, wave or outbox. Stops on a flaky check (tooling, not a bug), on a reproduction that passes before the fix, and hands over the /omni:brainstorm line when the fix needs a product decision, a stored shape, a shared contract or a new screen, route or API. Never merges. Triggers on "fix this bug", "fix #612", "this is broken", "bug fix", "/omni:bug-fix".
---

<!-- Ported from vertuo-ai-domain@47a1a194a:.claude/skills/vertuo-fix-bug/SKILL.md — changes in kit/porting/plugin--bug-fix.md -->

# Bug fix: one bug to one pull request

A fast lane beside the loop, not inside it. A bug something a user, a browser or an API caller can
observe gets an issue, a triage, a reproduction seen failing before the fix, one fix branch and one
pull request. There is no PRD, dossier, inbox folder, spec, plan, phase-0 PR, feature branch, wave
or outbox: the red reproduction is the spec. No release note and no retro follow a bug fix. It ends
at a review gate: **a person merges.**

In order: **start** (step 0); open or read the **issue** (1); **classify** (2); **triage** (3);
check the **boundary** (4, and at every step after); cut the **branch** (5); **words first** (6);
**prove red** (7); **fix** (8); **guard** (9); **mutation** (10); **record** (11); **ship** (12);
**hand off** (13). Announce each step in one line as you start it. Every step leaves something on
disk or on GitHub, so a `/clear` or a crash loses nothing. **Nothing is reported as proven that was
not run.**

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

## Input

| input | example | what it is |
|---|---|---|
| a description | `/omni:bug-fix 'saving twice duplicates the row'` | the bug, in the person's words; the skill opens its issue |
| an issue | `/omni:bug-fix 612`, `/omni:bug-fix #612`, or `/omni:bug-fix https://github.com/<owner>/<repo>/issues/612` | an issue that already reports the bug; the skill uses it as it is |

The three issue forms are all read as its number, `<n>`. An issue URL must name `repo.slug`: a URL
of another repository stops the skill with one line saying which repository it belongs to, since
the fix branch and the PR live here. With no input, say that this skill takes a description of the
bug or an issue, and stop.

## Step 0

**Start.** Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the
Omni Loop kit is not installed in this repository. Keep the JSON; later steps read `repo.*`,
`branches.fix`, `worktrees`, `paths.delivery`, `paths.glossary`, `paths.knowledge`,
`paths.context`, `labels.bug`, `labels.regression`, `labels.riskCritical`, `labels.riskHigh`,
`labels.riskMedium`, `labels.riskLow`, `labels.needsFix`, `labels.autoCreate`, `risk.storedShape`,
`risk.sharedContract`, `acceptance.*`, `commands.preflight`, `commands.mutation` and
`limits.attempts` from it. `<remote>` below is `repo.remote`.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs kb show briefing`.
Its rules bind every step below. Then read `node .omni-loop/bin/omni.mjs kb show bug-fixing` (the
risk levels, the regression evidence and the guard question steps 3 and 9 use) and
`node .omni-loop/bin/omni.mjs kb show testing` (the level a reproduction is written at, step 7).
Each `omni kb show <form>` prints one form of the repository's playbook, section by section: a
section the repository left blank prints the kit default, and a `[hole]` is a question for a person,
never a reason to stop. The `bug-fixing` form adds to the steps below; it never overrides them.

## 1. Issue

Labels follow `/omni:pr`'s **Labels** rules: a missing label is created only when
`labels.autoCreate` is true, and a label that cannot be added is said in the triage comment (step 3),
never a reason to stop.

- **With a description:** open the issue, labelled `labels.bug`, signed (**Signing**):

  ```bash
  gh issue create --title "Bug: <line>" --label "<labels.bug>" --body-file <file>
  ```

  ```markdown
  <the line, as the person wrote it>

  A bug fix: `/omni:bug-fix` triages it, proves a reproduction red, fixes it, and opens one pull
  request that closes this issue.

  <the line `omni sign footer` prints>
  ```

- **With an issue** (`<n>`, `#<n>` or its URL): read it with `gh issue view <n> --comments`, and
  follow every CI run it links (`gh run view <id> --log-failed`). Use it as it is. When it does not
  carry `labels.bug`, add it (`gh issue edit <n> --add-label "<labels.bug>"`).

`<n>` below is the issue's number, `<nnnn>` is `<n>` zero-padded to four digits, and `<slug>` is a
short kebab-case name of the bug.

## 2. Classify

A bug is something a user, a browser or an API caller can observe. A flaky test, a CI timeout or a
slow job is **tooling**, not a bug: post the triage comment (step 3) with only
`- **Kind:** tooling — not a behaviour bug` and one sentence why, and stop (stop rule 1).

## 3. Triage

Establish, with evidence you can cite, the risk levels and the regression evidence being the ones
`omni kb show bug-fixing` defines:

- **Domain:** the knowledge area or code area that owns the behaviour.
- **Risk:** `critical`, `high`, `medium` or `low`, and one sentence: who is hurt, how, workaround or
  not.
- **Regression:** `yes` only with evidence: the culprit PR or commit (`git log <green>..<red>` on
  `<remote>/<repo.defaultBranch>`, then read the suspect diff), a green run followed by a red one, or
  the report saying when it last worked. Otherwise: new bug — no evidence this ever worked.

Post **one** comment on the issue (a comment is never signed), found by its marker and edited in
place on a rerun:

```bash
gh api repos/<repo.slug>/issues/<n>/comments --paginate \
  -q '.[] | select(.body | startswith("<!-- omni-bug:triage -->")) | .id'
gh issue comment <n> --body-file <file>                                          # no id: a new comment
gh api -X PATCH repos/<repo.slug>/issues/comments/<id> -F body=@<file>           # an id: edit it
```

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

Then label the issue with the risk's label (`labels.riskCritical`, `labels.riskHigh`,
`labels.riskMedium` or `labels.riskLow`) and, for a regression only, `labels.regression`:
`gh issue edit <n> --add-label "<risk label>[,<labels.regression>]"`. A label that could not be
added is one more line in the comment.

## 4. The boundary

Checked here, and at every step after. A bug fix restores behaviour the product already meant to
have. It crosses the line when:

- **the right behaviour is not already settled**: no spec, knowledge register, doc or plain intent
  says what should happen, so fixing it needs a product decision;
- **the fix touches a path in `risk.storedShape` or `risk.sharedContract`**: a stored shape or an
  interface others depend on;
- **the fix needs a new screen, route or API.**

Size alone is not the test: a fix across several files is still a bug fix when none of the three
holds.

**The stop.** Crossing the line, here or at any later step, stops the skill (stop rule 4). Comment on
the issue with what crossed it, in plain words, and the command to run instead:

```bash
gh issue comment <n> --body-file <file>
```

```markdown
This is more than a bug fix: <what crossed the line, in one or two sentences>.

Run this instead, to design it first:

`/omni:brainstorm <the issue's line>`
```

Then stop. Open no pull request and push nothing. A worktree step 5 had already cut stays where it
is, unpushed, and the hand-off names its path and its branch.

## 5. Branch

Cut a worktree on `branches.fix`, with `{topic}` = `<n>-<slug>`, from the default branch:

```bash
git fetch <remote>
git worktree add -b <fix branch> <worktrees>/<n>-<slug> <remote>/<repo.defaultBranch>
```

Every change below is made in this worktree. Never commit on `repo.defaultBranch`.

## 6. Words first

List the nouns and verbs the reproduction needs. When `paths.glossary` is set, each is in it; a
missing term is added there, in the section that owns it, in the same commit as the reproduction.
With no glossary, the words come from `paths.knowledge` and `paths.context`. A term that cannot be
defined without inventing product behaviour stops the skill with a question to the person, naming
the term (stop rule 2).

## 7. Prove red

Write the reproduction, in the domain's words:

- an acceptance scenario under `acceptance.dir` when `acceptance.enabled` is true and the harness
  (`acceptance.run`) can observe the bug;
- otherwise an ordinary test, at the level `omni kb show testing` picks.

Run it **before any fix**:

- **It fails:** keep the failing line verbatim; it is the red evidence.
- **It passes:** stop (stop rule 3). Comment on the issue with the reproduction and the two readings
  (it misses the bug, or the bug is already gone); a person decides.
- **It cannot run in this session** (a harness or a service the session lacks): the evidence is the
  sentence `Red not proven here — <why>; CI is the proof`, and the skill carries on.

## 8. Fix

Test-first, the smallest change that turns the reproduction green, in the repository's own patterns
(`node .omni-loop/bin/omni.mjs kb show conventions`). Where the cause is unit-testable, write the
failing unit test first, watch it fail, then make it pass. **Never edit the reproduction to make it
pass.** Then run `commands.preflight` until it is green; when it is null, say so, and name it in the
PR's **Verified** section. Each red run of the fix counts as an attempt (stop rule 5).

## 9. Guard

Answer in one sentence: which cheap check would have caught this before it shipped? When one is
guard-sized (a check script, a lint rule, a unit test), add it with its own test, and confirm it
fails on the default branch's version of the offending code and passes on the fix branch. Otherwise
the guard line is `Guard: none — <reason>`.

## 10. Mutation

- **`commands.mutation` set:** commit first (it reads committed changes), run it, and read what
  survives inside the lines the fix changed. Survivors there: strengthen the test once and rerun
  once. Its last line is the mutation evidence.
- **`commands.mutation` null:** the line is `Mutation: not set here`.
- **It cannot run at all:** the line is `Mutation: not run — <its last error line>`, without a
  retry.

## 11. Record

Write `<paths.delivery>/bugs/<nnnn>-<slug>/bug.md`, the only file in that folder. It is what the
future Bugs view reads:

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

## 12. Ship

1. **Commit** on the fix branch as `fix(<scope>): <what the user gets back> (#<n>)`, with the
   session's co-author trailer, then the `omni sign trailer` line (**Signing**). The scope follows
   `omni kb show conventions`.
2. **Prove it:** `node .omni-loop/bin/omni.mjs bug <n>`. Run it until it prints `ok`:

   | exit | what you do |
   |---|---|
   | `0` | `ok`: carry on. |
   | `1` | `not ok`, one line per failed check: fix each (a second folder, a missing or empty section, a risk outside the four levels, a reproduction the branch does not change, an empty red line, an unsigned commit), commit, and rerun. |
   | `2` | The kit is not installed here, its config does not read, or `--base` does not resolve: say so and stop. |

3. **Push** the fix branch: `git push -u <remote> <fix branch>`.
4. **Open the PR through `/omni:pr`**, as a standalone PR: base `repo.defaultBranch`, label
   `labels.bug` (subject to its **Labels** rules), title the commit's subject, and this body, signed
   (**Signing**):

   ```markdown
   Closes #<n>

   ## What was wrong

   <what the user saw, and why, in plain words; the files touched>

   ## Bug

   - **Issue:** #<n>
   - **Triage:** <domain> · <risk> · <regression — <evidence> | new bug — no evidence it ever worked>
   - **Red proven:** <the failing line | Red not proven here — <why>; CI is the proof>
   - **Guard:** <what it is and what it catches | none — <reason>>
   - **Mutation:** <the last line | not set here | not run — <why>>
   - **Record:** `<paths.delivery>/bugs/<nnnn>-<slug>/bug.md`

   ## Verified

   - <commands.preflight>: <green, or "none set here">
   - `omni bug <n>`: ok
   - <what was run and seen green, and what was not>

   ## Risk and rollback

   <what else shares the changed code>; roll back by reverting this PR.

   <the line `omni sign footer` prints>
   ```

   The record line is a repository path, never a URL. `/omni:pr` watches it until it is green or
   stuck. A red CI run is one more attempt at the fix: back to step 8.

## 13. Hand off

Print, in a few lines: the issue, the PR, what was proven and what was not (the red line, the
preflight, the `omni bug` line, the guard, the mutation line), then:

> Review the PR and merge it if it is right.

**A person merges.** After a stop, the hand-off is the issue, the comment the stop posted (and the
`/omni:brainstorm` line, after **The stop**), and the worktree left behind, when there is one.

## Stop rules

Written verbatim, so they are never argued away:

1. Not a behaviour bug: triage comment `Kind: tooling`, stop.
2. A term cannot be defined without inventing behaviour: stop and ask.
3. The reproduction passes before the fix: stop, comment on the issue.
4. The boundary is crossed: stop, comment with the `/omni:brainstorm` line.
5. `limits.attempts` red attempts at the fix, or at CI on the PR: the PR stays draft, labelled
   `labels.needsFix`, with a comment saying what is stuck, and the issue gets a comment linking it.

For rule 5 with a PR already open: `gh pr ready <pr> --undo`, add `labels.needsFix`
(`gh pr edit <pr> --add-label "<labels.needsFix>"`), comment on the PR with what is stuck, and
comment on the issue with the PR's link.

## Never

- **Never merge.** A person merges the PR; the skill stops at the hand-off.
- **Never fix before red.** The reproduction runs, and fails, before any fix, or says it could not
  run.
- **Never edit the reproduction to make it pass.**
- **Never cross the boundary** to finish a fix: stop, and hand over the `/omni:brainstorm` line.
- Never commit on `repo.defaultBranch`.
- Never report anything as proven that was not run.
- Never open a PRD, a dossier, an inbox folder, a plan or an outbox item for a bug fix, and never
  batch several bugs into one PR.
