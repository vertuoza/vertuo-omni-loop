---
name: mega-roadmap
description: The roadmap of a plan repository — turns a milestone plan whose items span several target repositories into a roadmap in one sitting. Surveys the targets through omni targets and reads each one the roadmap touches from a shallow read-only clone in the scratch folder (nothing runs in it), shows one map of its PRDs (the repositories of each, every blocker with its why, each wave, every read-only target and consumer order the check would refuse) and takes every answer in one message; then writes every PRD as /omni:mega-brainstorm writes one (issue, inbox folder, spec with its Repositories section and its blocked-by, before/after grouped by repository) with no plan, opens the roadmap issue, writes roadmap.md with its repos column, runs omni roadmap check and omni check inbox until green, opens one phase-0 PR, pushes it to the roadmap's page with omni roadmap push, checks its prerequisites (each naming the targets it concerns) once with omni roadmap prereqs --fix in the plan repository, and hands off the /loop /omni:mega-drive --roadmap line. Outside a plan repository it prints the /omni:roadmap line. Writes nothing in any target, merges nothing. Triggers on "mega-roadmap", "a roadmap across repositories", "turn the crew plan into PRDs across the repositories", "/omni:mega-roadmap".
---

# Mega-roadmap: a milestone into PRDs across repositories

A **plan repository** (its config has a `plan` section) holds no product code; its **target
repositories** do. This skill turns a milestone plan whose items touch several of them (crew,
ai-domain, the ERP) into a roadmap: one PRD per item, each naming the repositories it lands in, all
written in the plan repository and reviewed in **one phase-0 PR**. Then `/omni:mega-drive` builds the
roadmap across every repository.

It follows `/omni:roadmap` **step for step**: the same one map, the same one answer, the same specs
up front with no plan, the same checks, the same phase-0 PR and the same push. It never copies those
steps: each step below says "as `/omni:roadmap` step N" and adds only what differs. Read
`/omni:roadmap` alongside it, and `/omni:mega-brainstorm` for how one PRD of a plan repository is
written; where they say the same thing, their words are the rule.

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

**Only here, never there.** Everything this skill writes lands in the plan repository: the issues,
the branch, the files, the pull request. It writes nothing in any target repository: no branch, no
commit, no pull request, no issue, no comment. Those come later, from the loop.

**Nothing runs in a clone.** A target's clone is read, never executed: no install, no build, no
test, no script, no hook, no command from its README or its package manifest. Only `git` reads it
(`ls-files`, `rev-parse`, `log`, `show`) and the file tools, as in `/omni:mega-brainstorm`.

## Input

As `/omni:roadmap`: a page link, a file of the plan repository, or pasted text, the plan whose items
name the repositories they touch (`/omni:mega-roadmap https://example.com/crew-plan`). `<n>` is the
roadmap's number, `<prd>` one PRD's.

## Step 0

1. Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the
   repository is not installed. Keep the JSON: everything `/omni:roadmap` step 0 keeps, plus `plan`.
2. **A plan repository only.** When the JSON has no `plan` section (its `plan.targets`), this is a
   repository of its own: stop in exactly one line, the source carried over, writing nothing:

   ```text
   not a plan repository: /omni:roadmap <source>
   ```

3. Then the briefing, `node .omni-loop/bin/omni.mjs kb show briefing`, as `/omni:roadmap` step 0.
4. **The scratch folder:** `mktemp -d`, outside the plan repository and outside its worktrees. Every
   clone of step 1 goes there, and the folder is deleted when the skill ends, whatever the outcome.

## 1. Read the source

As `/omni:roadmap` step 1, and first the targets, as `/omni:mega-brainstorm` steps 1 and 3 read them:

1. Run `node .omni-loop/bin/omni.mjs targets --json` and print its rows as a table
   (`repo · role · knowledge · loop · state`); its exit `1` means a row is not `ok`, not a failure.
   Read the page `plan.guide` names, when it is set, then each reachable target's knowledge where its
   `knowledge` says it lives. A `stale` or `drifted` target is warned about in one line, with
   `/omni:mega-invade --sync` suggested, never run; an `unreachable` one can hold no row.
2. Read the source as `/omni:roadmap` step 1 does, and give each row its **repos**: the short name of
   each target it touches (the part of `repo` after the `/`), from the repositories the source tags
   the item with. A row the plan repository alone carries (a docs change) names the plan repository.
3. For each target a row names, one at a time:
   `gh repo clone <repo> <scratch>/<name> -- --depth 1 --single-branch`, a shallow clone of its
   default branch. **Nothing runs in it.** Read the paths the rows touch (`git -C <scratch>/<name> ls-files`,
   then the files) and an `own` target's knowledge base, so each spec names what is really there. A
   clone that fails leaves that target out: its rows are shown on the map as unreadable. The clones
   are deleted once step 3 has written the specs.

## 2. The map: one checkpoint

As `/omni:roadmap` step 2: **one map**, one numbered list, every answer in **one message**, and
**Nothing is written before that answer.** The PRD table gains a `repos` column:

```text
id     title                              repos       blocked by   why                                  wave
P1.1   Crew API and worker skeleton       crew        –            –                                    1
P3.4   Stateless think endpoint           ai-domain   P1.1         the endpoint is called by the worker 2
```

Which repository a row lands in is part of what the person answers: each `repos` cell is a default
from the source's tags, never assumed from a role's name. Besides `/omni:roadmap`'s list, the map
names every row the check would refuse in a plan repository, with the fix applied:

- a repo that is no target of `plan.targets`, or one marked `readOnly`: no row may name it (it may
  still be read);
- a row in a target that `consumes` another, blocked by a row changing that provider, in a wave not
  after the provider row's (`omni help roadmap`): the consumer installs what the provider publishes
  from its default branch, so it waits for the provider's merge.

The prerequisites are shown grouped by category as `/omni:roadmap` shows them, each with the
repositories it concerns when it concerns a target rather than the plan repository (a private
package a target installs, a secret a target's preview needs): read from the clones, never by running
anything in one.

## 3. Write every PRD

As `/omni:roadmap` step 3 (the one phase-0 worktree, the issues first in wave order, each folder,
`blocked-by` from the table, no plan), each PRD written as `/omni:mega-brainstorm` writes one, so the
spec and the page say what lands where:

- **The spec** adds `## Repositories` after `## Solution`: one paragraph per repository of its row,
  its role, what changes there, and which knowledge it was read from (its own, the imported copy, or
  the guide alone). Its **Risks** name every stale or drifted copy the row relied on, and what a merge
  publishes in each target, as `/omni:mega-brainstorm` step 5 says.
- **The before/after page** is grouped by repository, as `/omni:mega-brainstorm` step 6 draws it.

No plan is written: `/omni:mega-drive` plans each PRD through `/omni:ultra-yolo` when the loop
reaches it, against the targets as they are then.

## 4. The roadmap issue, roadmap.md and the checks

As `/omni:roadmap` step 4, the PRDs table with its `repos` column, required on every row of a plan
repository's roadmap:

```markdown
| id | PRD | title | repos | blocked by | why | wave |
|---|---|---|---|---|---|---|
| P1.1 | #1201 | Crew API and worker skeleton | crew | – | – | 1 |
| P3.4 | #1213 | Stateless think endpoint | ai-domain | P1.1 | the endpoint is called by the worker | 2 |
```

A row in several repositories lists them comma-separated.

`## Prerequisites` is `/omni:roadmap`'s, rows and cards alike, with a `repos` column naming the
targets each row concerns, or `–` for a row of the plan repository and the machine (the base rows):

```markdown
| id | category | need | check | fix | blocks | who | repos |
|---|---|---|---|---|---|---|---|
| p1 | permissions | gh is signed in, with the right to change the repository | `base:gh-auth` | | all | check | – |
| p6 | access | the private `@acme/ui` package installs | `npm view @acme/ui version` | | P3.4 | check | crew |
```

A row that concerns a target is checked by a command that only reads (asking a registry, `gh api`),
never by one that installs, builds or runs the target's code: no `base:install` on a target row, and
no `agent` row names a target.

Commit, then run, fixing until both are green, in the plan repository:

```bash
node .omni-loop/bin/omni.mjs roadmap check <n>
node .omni-loop/bin/omni.mjs check inbox
```

## 5. One phase-0 PR, then the roadmap's page

As `/omni:roadmap` step 5, in the plan repository: `node .omni-loop/bin/omni.mjs phase0 <prd>` for
every PRD (its one expected fault `missing: plan`), the push and `/omni:dossier-push <prd>` for each,
**one phase-0 PR**, then `node .omni-loop/bin/omni.mjs roadmap push <n>`, then the prerequisites
checked once, as `/omni:roadmap` step 5 checks them:

```bash
node .omni-loop/bin/omni.mjs roadmap prereqs <n> --fix
```

It runs in the plan repository's worktree, never in a clone: the clones are gone by now, and nothing
runs in one. There is **no phase-0 PR in any target.**

Its body adds, after Summary, a **What lands where** table, so each team finds its part:

```markdown
## What lands where

| repo | role | PRDs | waves |
| --- | --- | --- | --- |
| <name> | <role> | P1.1 #1201, P3.4 #1213 | 1, 2 |
```

One row per target a PRD names, in `plan.targets` order: the PRDs that touch it and the waves they sit
in.

## 6. Hand off

As `/omni:roadmap` step 6, the open prerequisites first among their lines, each naming its
repositories, adding the targets' table from step 1 and every warning it printed. The
command on the reply's last line drives the roadmap across the repositories:

```markdown
**What is next?**

1. Review the roadmap: https://github.com/<owner>/<repo>/pull/<phase-0 PR>
   (where each PRD stands: <the roadmap's page, or the roadmap issue's link>)
2. Merge that PR. → every PRD of the roadmap moves into the inbox.
3. Once it's merged, type /clear (or open a new terminal), then run:

/loop /omni:mega-drive --roadmap <n>
```

## Guardrails

- Runs only in a plan repository, and writes only there:
  never a branch, a commit, a pull request, an issue or a comment in a target.
- Nothing runs in a clone; every clone lives in the scratch folder and is deleted.
- Which repository each PRD lands in is answered on the map, never assumed; no row names a target
  that is `readOnly` or not a target.
- One map, one answer, specs up front with no plan, one phase-0 PR, all in the plan repository.
- Never merge, never add `labels.outboxGo`, never create a label unless `labels.autoCreate` is true.
