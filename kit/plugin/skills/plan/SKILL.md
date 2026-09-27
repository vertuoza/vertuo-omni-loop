---
name: plan
description: Turns one PRD in the inbox into a plan of thin tracer-bullet slices, each with a territory, a blocker list and a wave, written as plan.md beside its spec and graded by omni plan check — then commits it on the PRD's feature branch and opens the draft feature PR. Writes no code, files no issues, merges nothing. /omni:yolo follows it when a PRD has no plan yet; a person may run it alone. Triggers on "plan PRD 7", "slice this PRD", "tracer bullets", "/omni:plan".
---

<!-- Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-plan/SKILL.md — adaptations in kit/porting/plugin--plan.md -->

# Plan: one PRD into slices

One PRD in; out come `plan.md` beside its spec, on the PRD's feature branch, and a **draft feature
PR** into the default branch. This skill writes no code, files no issues, and merges nothing.

`omni` below is `node .omni-loop/bin/omni.mjs`. Never import the kit, and never name a path, label,
branch shape or command you can read with `omni config <key>`.

**Signing.** Every commit this skill makes ends with the co-author trailer your session requires,
then the line `omni sign trailer` prints as the message's last line, with no blank line between
them. Every pull request or issue it opens ends its body with the line `omni sign footer` prints, as
a paragraph of its own just above your session's own attribution lines, and a body it rewrites keeps
that line. Comments are never signed. A command that prints nothing means signing is off here: add
nothing.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the repository
is not installed. Keep the JSON; later steps read `repo.*`, `branches.feature`, `worktrees`,
`paths.*`, `labels.*`, `prLinks.feature` and `acceptance.*` from it.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs kb show briefing`. Its
rules bind every step below. Each `omni kb show <form>` prints one form of the repository's
playbook, section by section: a section the repository left blank prints the kit default, and a
`[hole]` is a question for a person, never a reason to stop. A form adds to the steps below; it
never overrides this skill's rules.

## 1. Read the PRD

The input is a PRD number. It is also the PRD's issue number, which `{prd}` in a link line means.

1. `node .omni-loop/bin/omni.mjs prd <n>`. The PRD must be in state `inbox`, and its files must
   include a `spec.md`. Otherwise stop and say which is missing. The folder `dir` names is
   `<n>-<topic>` (the number zero-padded). Its `<topic>` fills `{topic}` in `branches.feature`.
2. The spec, in full. Then every file in `paths.context`, the glossary at `paths.glossary` when it
   is set, and each ADR the spec cites under `paths.adr`.
3. `gh issue view <n> --json body,comments`: the issue and any answer a person already gave on it.
   (Piped, `--comments` alone prints nothing when there are no comments; read the JSON.)

**Stop with `needs clarification`** when the spec's acceptance criteria are missing, ambiguous, or
contradict the spec itself or an ADR it cites. The criteria are the spec's acceptance section, or,
when it has none, its scope and test seams. The test is whether you can write every slice's
"done when" as a condition someone can observe. If you cannot, post the question with
`gh issue comment <n> --body-file <file>`, one numbered question per gap, and return
`needs clarification`. A plan is never written on a guess.

## 2. The feature branch

The branch is `branches.feature` with `{topic}` filled. Work in a worktree under `worktrees`:

```bash
git fetch <repo.remote>
git ls-remote --heads <repo.remote> <feature branch>        # prints a line when the branch exists
git worktree add <worktrees>/<topic> <feature branch>        # when it exists on the remote
git worktree add -b <feature branch> <worktrees>/<topic> <repo.remote>/<repo.defaultBranch>   # when it does not
git merge <repo.remote>/<repo.defaultBranch>                 # inside the worktree: start from today's default branch
```

Never commit on the default branch.

## 3. The slices

For each slice, decide:

| Field | Rule |
|---|---|
| **id** | `s1`, `s2`, … in build order |
| **slice** | what it makes true, in the spec's own words |
| **territory** | the path prefixes it owns, each backticked (below) |
| **blocked by** | the ids whose work it needs, comma-separated; `—` for none |
| **wave** | `1` with no blockers, else one more than its highest blocker's wave; raised further when territories collide |

- **Thin and vertical.** Each slice is one narrow path through every layer it needs, verifiable on
  its own. A slice that is "the schema" or "the UI" cannot be verified alone: no slice per layer.
- **Every slice becomes a sub-PR** into the feature branch, through `/omni:do-work` and `/omni:pr`.
  Never an issue, never a PR into the default branch, and never a slice built on the feature branch
  itself, even when there is only one.
- When `acceptance.enabled` is true, each scenario the spec names is turned green by a slice. Name
  it in that slice's "done when"; a slice may leave one pending, the last wave may not.

**Territory.** Read `omni kb show architecture` first: its layout and boundaries say where code
may go and what may depend on what, and every territory follows them. A slice owns a list of
repo-relative path prefixes. A prefix covers a path when the path starts with it. Write a
directory with its trailing slash, and a family of files as a prefix and a star. There is no glob
language. `/omni:wave` grades each sub-PR's diff against its territory.

**Waves are computed, not asserted.** Two slices whose territories intersect may never share a wave,
because siblings in a wave merge one after another and shared ground turns the second into a
conflict. `omni plan check` computes the pairs (step 5). Two things it cannot see, and you must:

- Two slices that will both create files in a directory **neither names yet**. Name that directory
  in both territories, so the check separates them.
- A file several slices each add one line to (a registry, an index, a manifest). That is shared
  ground: declare it in each, and say so in the plan's shared-ground note.

## 4. Write `plan.md`

Write it as `plan.md` beside `spec.md`, in the PRD folder `omni prd` names as `dir`. If a plan is
already there (a phase-0 PR may have landed one), keep it, and change only what steps 3 and 5
require. These four parts are the whole shape:

1. A title, then one header paragraph: the PRD (`#<n>`), the spec beside the plan, the feature
   branch into `repo.defaultBranch` with `prLinks.feature`, and the sub-PRs from `branches.slice`
   into the feature branch with `prLinks.sub`.
2. `## Slices`, the table the kit parses. The header row is exactly:

   ```markdown
   | id | slice | territory | blocked by | wave |
   | --- | --- | --- | --- | --- |
   | s1 | <what it makes true> | `<dir>/` `<file prefix>*` | — | 1 |
   ```

3. Under the table, the **shared-ground note**: each prefix more than one slice declares, which
   slices, and how the waves keep them apart.
4. `## Per slice: done when`: for each slice (or group of like slices), the observable conditions,
   as a bullet list.

## 5. Check until green

```bash
node .omni-loop/bin/omni.mjs plan check <n>
```

It prints the waves and the collision matrix, then every violation: a duplicate id, a blocker that
names no slice or sits in the same or a later wave, and two slices sharing ground in one wave. Fix
the plan and rerun until it exits `0`. A same-wave collision is resolved by moving one slice to a
later wave (and every slice it blocks with it), or by narrowing a territory so the two no longer
meet. Merging the two into one slice is also allowed. **Never** leave the check red, and never
change the check.

## 6. Commit, and open the draft feature PR

1. Commit the plan in the worktree as `docs(plan): <topic>`, ending with the co-author trailer your
   session requires, then the `omni sign trailer` line, and run
   `git push -u <repo.remote> <feature branch>`. Then follow `/omni:dossier-push <n>` from the
   worktree: `plan.md` goes up to the PRD's dossier, as a new version only when it changed.
   Whatever it prints, carry on.
2. Open the feature PR as a **draft**, because CI skips drafts, so the slices merging into it cost
   no CI run. Follow `/omni:pr`'s **feature** kind: base
   `repo.defaultBranch`, head the feature branch, a Conventional Commits title naming the PRD, and
   the labels and status comment `/omni:pr` sets out (its **Labels** rules decide what happens to a
   missing label). The body starts with `prLinks.feature` filled, then the **Slices** checklist with
   every slice unticked (`- [ ] <slice title> — not started`), then the **Acceptance** checklist when
   `acceptance.enabled` is true, then the remaining sections filled as far as the spec allows, and
   last the `omni sign footer` line.
   `gh pr list --head <feature branch> --base <repo.defaultBranch> --state open --json number,url,isDraft`
   finds a feature PR already open for the branch: update its body, footer line included, instead
   of opening another.
3. The status comment's state is `claimed`, with `slices: 0 / <total> merged`. Do not enter
   `/omni:pr`'s check loop, and never mark the PR ready: `/omni:yolo` carries it from here.
4. Comment on the PRD issue: `Plan: <plan path> · Feature PR: #<pr>`.
5. No agent is on the PR once this skill stops, so remove the label:
   `gh pr edit <pr> --remove-label "<labels.inProgress>"`. `/omni:yolo` puts it back when it picks
   the PR up.

## 7. Hand off

Print the slice table and the waves `omni plan check` reported. Followed by `/omni:yolo`: return to
it. Run alone: end with the line `/omni:yolo <n>`.

## Guardrails

- One PRD, one feature branch, one feature PR. Related small asks belong in one PRD when it is
  written, not in one plan afterwards.
- Slices live in the plan, never in issues.
- Every slice declares a territory, and the waves come from `omni plan check`, never from a
  sentence saying the slices look independent.
- The feature PR stays draft.
- Never write code, never file an issue, never merge.
