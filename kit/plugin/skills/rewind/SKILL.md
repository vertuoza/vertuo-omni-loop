---
name: rewind
description: Walks a PRD that broke main back from the break to its spec, to find where the break started — reads the breaks with omni rewind facts, starts from the break itself, then runs seven checks in order (the reviews, the CI, the pull request bodies against the pull-requests form, the waves, the plan, the spec and its answers, the knowledge), writes the premise every earlier fix assumed and tests it before naming the one cause, and writes each finding with its check, where it started (repository, omni-setup or knowledge), its evidence links and its fix, a repository fix at the strongest level that would have stopped the break (architecture, types, a lint, a test, docs last). Sends the findings to the PRD's Main tab with omni rewind push, as proposals a member approves or rejects. Refuses, in one line and writing nothing, a PRD that did not break main. Writes nothing to the repository, opens nothing, never merges. A runner runs it, queued by the Omni app on a PRD's first break; a person may run it in a terminal. Triggers on "why did this PRD break main", "rewind PRD 2410", "/omni:rewind 2410".
---

# Rewind: from the break back to the spec

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

The main watch marks a shipped PRD **broke** when its merge commit went red on main, one of its pull
requests was reverted, or a regression was traced to it. This skill finds why. It reads; it never
repairs. Every finding it writes is a **proposal**: a member of the workspace approves or rejects it on
the PRD's page, and only that Approve starts any work.

## Never

- **It writes nothing to the repository.** The checkout is read, never changed: no file written or
  edited in it, no commit, no branch, nothing pushed. Every file this skill writes (the findings, the
  notes it keeps while it reads) goes in a scratch folder outside the repository, made with
  `mktemp -d`.
- **It never merges,** opens no pull request or issue, posts no comment, and changes no label: the one
  thing it sends is its findings, through `omni rewind push`.
- **It reads only the PRD's own repositories,** the ones `omni rewind facts` lists, never another.
- **It speaks in no person's name.** Every finding is signed as an agent's (step 4), and no finding
  says what a person thought, meant or should have done: it names pull requests, checks and rules,
  never people.
- **It asks nothing under `OMNI_UNATTENDED`** (a runner). A point it cannot settle from the evidence
  is left out of the findings and named in its report; nobody is asked. In a terminal it asks nothing
  either: everything it needs is on GitHub and in the repository.
- **A finding holds no secret.** It quotes no key, token, password or personal data, and at most a
  few lines of a log, none of them holding one; it links the job instead.

## Input

`<n>`: the number of a PRD that broke main. With none, say that this skill takes one, and stop. The
Omni app queues `/omni:rewind <n>` for a runner on the PRD's first break, sent by the app, and the
PRD's Main tab shows the same line, so a person may run it by hand. Running it again is safe: a
finding already proposed is never proposed twice.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the JSON;
`<remote>` is `repo.remote`, and `branches.feature` and `branches.slice` give the PRD's branch names.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs session start`. Its
rules bind every step below. Each `omni kb show <form>` prints one form of the repository's
playbook, section by section: a section left blank prints the kit default, and a `[hole]` is a
question for a person, never a reason to stop.

Then make the scratch folder (`mktemp -d`), outside the repository: every file below goes there.

## 1. The break

Run `node .omni-loop/bin/omni.mjs rewind facts <n> --json`. It prints the PRD's watch per repository
(`watches`: each one's status, merge commit and what it could not read), each break (`breaks`: its
kind, its link, and beside a red on main the parent commit's result) and the findings already on its
page (`findings`).

- It exits 1 (signed out, refused, unreachable): print its line as is and stop.
- **No repository reads `broke`** (no watch, or every one `watching` or `clean`): print this one line,
  write nothing, push nothing and stop:

  ```text
  rewind: PRD <n> did not break main: nothing to rewind.
  ```

Then run `node .omni-loop/bin/omni.mjs prd <n>`: the PRD's folder, with its `spec.md`, its `plan.md`
and its outbox (the settled answers among them).

**Start from the break.** For each break, read what it is before anything else: the red job's log
(`gh run view <run> --log-failed`), with the parent commit's result beside it (a parent already red
says main was red before the merge); the revert's commit and what it took out; the regression issue
and its triage. Write, in the scratch folder, what broke, in one plain sentence per break, with its
link. The findings of the break itself take the check `main`.

Then find the PRD's pull requests, in each repository the facts list (`--repo <owner/name>` for one
that is not this checkout's): the feature PR, merged into the default branch with `Closes #<n>`, and
its sub-PRs, merged into its feature branch (`gh pr list --state all --base <feature branch> --json
number,title,url,headRefName,createdAt,mergedAt,body`). These are what the seven checks read.

## 2. The seven checks, in this order

Walk back from the break to the spec, one check at a time. Each check asks one question: **could the
break have been stopped here, and why was it not?** Keep, in the scratch folder, what each check found,
with its links. A check that found nothing says so in one line, and the next one runs.

### 1. The reviews

Every review and comment on the feature PR and its sub-PRs (`gh pr view <pr> --json reviews,comments`,
and the line comments with `gh api repos/<owner>/<name>/pulls/<pr>/comments`): what each raised, why,
and what came of it. A thread that named the cause and was resolved without a fix is a finding of the
check `reviews`.

### 2. The CI

Every red run on the slices' branches, the feature branch and the feature PR
(`gh run list --branch <branch> --json databaseId,conclusion,headSha,url,workflowName`), then the
main break's own log. A red that was re-run green, skipped or marked flaky before the merge, on the
same job that broke main, is a finding of the check `ci`.

### 3. The pull request bodies

Each body against the repository's `pull-requests` form (`omni kb show pull-requests`) and its pull
request template, when it has one: a validation that skipped the command which would have gone red,
a risk or a rollback left empty, a placeholder left in. A finding of the check `bodies`.

### 4. The waves

The order the slices were claimed and merged (each sub-PR's `createdAt` and `mergedAt`), against the
waves and blockers of `plan.md`: a slice merged before one it was blocked by, two slices of one wave
that changed the same ground, a wave checked before its last merge. A finding of the check `waves`.

### 5. The plan

Each slice's "done when" and territory in `plan.md`, against its merged diff
(`gh pr diff <sub-PR> --name-only`, then the diff itself where it matters): a "done when" no test
proves, a file changed outside the territory, a slice whose ground the break sits on. A finding of the
check `plan`.

### 6. The spec and its answers

Each acceptance criterion of `spec.md`, and each settled answer of the PRD's outbox, marked
**kept**, **drifted** or **broken** by what shipped. One that drifted or broke where the break is, or
a case the spec never named, is a finding of the check `spec`.

### 7. The knowledge

The rules the changed files fall under: `omni kb laws --paths <file>…` on every file the PRD changed,
the glossary's words (`omni kb glossary`), and the conventions (`omni kb show conventions`). A law or
a rule the change broke, or one nobody wrote down that would have stopped the break, is a finding of
the check `knowledge`.

## 3. The premise, then the one cause

**The premise.** Before naming a cause, write the premise every earlier fix assumed: each re-run, each
fix commit on a red slice, the revert or the hot fix after the break, each assumed something about why
it broke ("the test is flaky", "main was already red", "it is the other slice's change"). For each one,
write the premise as one sentence in the scratch folder, then test it against the evidence: the logs,
the parent commit's result, the diffs, the order of the merges. A premise the evidence does not hold
is named as false, with its link.

**The cause.** Only then name the one cause the evidence points to: one sentence, with the links it
stands on. When the evidence points to two, name the one that came first, and say the other in its
finding. When it points to none, say so: the findings are then only what the checks proved, and the
report says no cause was found.

## 4. The findings

Each finding answers five things, the five fields `omni rewind push` takes:

| field | what it holds |
|---|---|
| `check` | where it was found: `main` (the break itself), `reviews`, `ci`, `bodies`, `waves`, `plan`, `spec` or `knowledge` |
| `origin` | where the break started (below) |
| `happened` | what happened, in plain words, at most a few sentences |
| `evidence` | the https links it stands on, at least one: a pull request, a run, a job, a commit, a review comment, an issue |
| `fix` | the one change that would have stopped it (below), ending with the agent's line |

**Where it started** is one of three:

- `repository`: the code, its tests or its CI;
- `omni-setup`: the loop's setup, its config, a skill or the kit itself;
- `knowledge`: a rule, a law or a word nobody wrote down, or one written that nobody read.

**The fix.** A `repository` fix names the strongest level that would have stopped the break, in this
order: architecture, then types, then a lint, then a test, and docs last. Name the first level that
would have worked, and why a stronger one would not. A `knowledge` fix names where the rule would be
written: a glossary term, a Legal entry, a playbook form and its slot, or a register. An `omni-setup`
fix names the skill, the command or the config key, and what it would do instead; its whole text names
no repository, no code of the workspace and no person, since a member's Approve sends it, word for
word, to the kit's own repository.

**The agent's line.** Every finding's `fix` ends with this line, so the card says who wrote it:

```text
Written by an agent (/omni:rewind), not by a person.
```

A finding needs its evidence: one the links cannot show is not written. One already among the facts'
`findings` (the same check, origin and evidence) is not written again.

## 5. Push them

Write the findings as a JSON array to `<scratch>/findings.json`, outside the repository, and run:

```bash
node .omni-loop/bin/omni.mjs rewind push <n> --file <findings file>
```

- Exit 0: it says how many it sent, proposed for a member to approve or reject.
- Exit 1, a finding refused (no evidence link, an origin or a check it does not take, one already
  proposed): fix that finding, or drop it when it was already proposed, and run it again.
- Exit 1, signed out or unreachable: print its line as is; the findings stay in the scratch folder,
  named in the report.

Run `git status --porcelain` in the checkout: it prints nothing, since the rewind writes nothing to the
repository. Then remove the scratch folder.

## 6. Report

Report in a few lines: the PRD with its page (`node .omni-loop/bin/omni.mjs dossier link <n>`; when it
prints `none`, the PRD's issue, `https://github.com/<repo.slug>/issues/<n>`), each break with its link,
the premises found false, the one cause (or that none was found), each finding as one line
(`<check> · <origin>: <what happened>`), and what the push said. It never merges, never repairs what it
found, and never decides a finding: a member does, on the PRD's Main tab.
