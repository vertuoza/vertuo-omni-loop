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

**Flow points.** A repository may hook the loop at named points (the `flow` of its config). At each
point this skill names, run `node .omni-loop/bin/omni.mjs flow show <point>` and follow what it
prints: every `before` hook, then the kit's step (or, when it prints `kitStep: replaced`, the
`replace` hook in its place), then every `after` hook. A hook is Markdown to follow; an input it
leaves as `{name}` is filled from this step. Following a hook ends on its verdict line
(`omni-hook <point>: pass`, or `omni-hook <point>: fail <why>`): write what it produced, that line
last, to a scratch file and run `node .omni-loop/bin/omni.mjs flow verdict <point> --from <file>`.
`ok` carries on; `not ok` stops the point as a failing kit step would, and so does `flow show`
exiting 1 (a hook file missing). A hook never loosens a guard: `omni plan check` runs whatever a hook
says. With no `flow`, `flow show` prints `hooks none` and `kitStep: run`: the step runs as written.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, stop and say so in one line: the repository
is not installed. Keep the JSON; later steps read `repo.*`, `branches.feature`, `branches.landing`, `worktrees`,
`paths.*`, `labels.*`, `prLinks.feature` and `acceptance.*` from it.

Then read the design flag: `node .omni-loop/bin/omni.mjs config design.enabled`, and, when it
prints `true`, `node .omni-loop/bin/omni.mjs config design.paths`. Keep both. Anything but `true`
(or a failure) means design craft is off here: step 4 marks no slice `ui: yes`, and nothing else in
this skill changes.

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
   It always exits 0: gate on its `state:` line, never on the exit code. A PRD born on the server
   (◆) also prints `birthplace: server` and its `approval:` lines; its `state:` reads `inbox` only
   once a member approved it on its page. For a ◆ PRD:

   | `state:` | the plan |
   |---|---|
   | `inbox` | runs as written |
   | `prd` (`approval: PRD <n> waits for approval: <link>`) | runs too: the plan is part of what the page approves, so `/omni:brainstorm` plans it before anyone approves |
   | `drifted` (`approval: ≠ <file> · … · ✗ refuse · restore it, or approve again: <link>`) | stops, printing its `approval:` lines as they are |
   | `unreachable` (`approval: server unreachable · held, not failed`) | stops with that line: held, not failed; run it again once the server answers |
   | `refused` (`approval: approver <login> is not a workspace member`, or `refused (<status>)`) | stops, printing its line |

   A ◇ PRD (no `birthplace:` line) never reads any of the four: it is `inbox` or not, as always.
2. The spec, in full. Then every file in `paths.context`, the glossary at `paths.glossary` when it
   is set, and each ADR the spec cites under `paths.adr`.
3. `gh issue view <n> --json body,comments`: the issue and any answer a person already gave on it.
   (Piped, `--comments` alone prints nothing when there are no comments; read the JSON.)
4. `node .omni-loop/bin/omni.mjs flow show`: what this repository changes from the kit's defaults,
   area by area (its `rules.plan`, which step 5 grades, and its hooks). An area that names a
   `knowledge` domain sends you to that folder under `paths.knowledge` for every slice touching it.

**Stop with `needs clarification`** when the spec's acceptance criteria are missing, ambiguous, or
contradict the spec itself or an ADR it cites. The criteria are the spec's acceptance section, or,
when it has none, its scope and test seams. The test is whether you can write every slice's
"done when" as a condition someone can observe. If you cannot, post the question with
`gh issue comment <n> --body-file <file>`: the file's first line is exactly
`<!-- omni-needs-clarification -->` (how `omni roadmap push` finds it, as human work of the PRD's
roadmap), then one numbered question per gap, the most important first. Return
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

A plan of more than one landing (step 4) has one branch per landing instead, cut once the plan is
green (step 6). Start in the feature branch's worktree all the same: the plan is written there, and
step 6 moves it onto landing 1's branch.

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

**Generated paths are never listed.** A file the repository builds rather than writes is a
`generated` entry of its config: `node .omni-loop/bin/omni.mjs config generated` prints each one's
`path`, the sources it is built `from` and its `build`. Never list a generated path in a territory or
in the shared-ground note, even for a slice that changes its sources: a slice rebuilds it only to
test and commits none, the wave rebuilds it once after merging, and the kit leaves it out of every
breach and every collision. List the sources the slice changes, as for any slice.

**Point `plan.slice`.** Once a slice's row is drafted in `plan.md` (step 4), run
`node .omni-loop/bin/omni.mjs flow show plan.slice --prd <n> --slice <id>` and follow it (**Flow
points**): its kit step is cutting that slice as this step says, and its hooks may reshape the row
(its territory, its blockers, its wave) before step 5 grades it. Each slice of the plan meets the
point once; a slice rewritten after a `fail` meets it again.

**Waves are computed, not asserted.** Two slices whose territories intersect may never share a wave,
because siblings in a wave merge one after another and shared ground turns the second into a
conflict. `omni plan check` computes the pairs (step 5). Two things it cannot see, and you must:

- Two slices that will both create files in a directory **neither names yet**. Name that directory
  in both territories, so the check separates them.
- A file several slices each add one line to (a registry, an index, a manifest). That is shared
  ground: declare it in each, and say so in the plan's shared-ground note.
- A test that checks what several slices change: a page's or a layout's test, a shared component's
  render test, a golden file. Before you write the territories, list the existing tests that import
  or read the files each slice will change (`git grep -l <module name>` over the test files). A test
  two slices' changes will both touch is shared ground: declare it in each of those slices and name
  it in the shared-ground note. Otherwise the second slice edits it outside its territory, and the
  same lines get rewritten wave after wave.

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
   slices, and how the waves keep them apart. A generated path is never in it.
4. `## Per slice: done when`: for each slice (or group of like slices), the observable conditions,
   as a bullet list.

**UI slices.** Only when step 0 read the design flag as `true` and `design.paths` lists globs: a
slice whose territory meets `design.paths` (a territory prefix holds a path one glob matches, or a
glob reaches into the prefix) is marked `ui: yes` on its done-when heading, after its id, so
`/omni:do-work` starts its design review on it without asking:

```markdown
**s3** (`ui: yes`)
- <its observable conditions>
```

A slice no glob meets is not marked. With the flag off, or `design.paths` empty, mark nothing:
`/omni:do-work` then reads `omni design touched` on the built diff and judges for itself. The mark
never changes a slice's territory, blockers or wave, and `omni plan check` does not read it.

**Landings.** A PRD reaches the default branch in one pull request unless something in it must be
deployed apart from the rest: a database migration the code needs in place first, or a contract
step that drops what the old code still reads. Then the plan cuts it into **landings**, built and
merged in order, each one its own pull request into the default branch. Give the slice table a
`landing` column, a whole number from 1, and, after the table, a `## Landings` table naming each
landing and what must be true before it is merged:

```markdown
| id | slice | territory | blocked by | wave | landing |
| --- | --- | --- | --- | --- | --- |
| s1 | <the column exists> | `<migrations dir>/` | — | 1 | 1 |
| s2 | <the code reads it> | `<dir>/` | — | 1 | 2 |

## Landings

| landing | name | merge when |
| --- | --- | --- |
| 1 | expand | — |
| 2 | code | landing 1 is deployed |
```

- Landing numbers run from 1 with no gap. A plan with no `landing` column, or with every value at
  1, has one landing and is built exactly as a plan always was: write no column then.
- A `name` is one kebab-case word or a few (it goes into the branch and the title); without the
  table each landing is named `landing-<n>`. When the table is there, it names exactly the landings
  the slice table uses.
- **Waves are counted within a landing.** A slice's wave is `1` with no blockers, else one more than
  its highest blocker's wave, and every blocker sits in the **same** landing: a landing waits for
  the one before it by its order alone, never by a `blocked by`. Two slices of different landings
  never share a wave, so their territories never collide.

**The repository's own rules.** The `flow` areas `omni flow show` printed (step 1) add to the
check: `slice.alone`, `slice.maxFiles`, `wave: first`, `blocks: all` and `landing: alone`, each for
the slices whose territory touches that area. `omni flow show --path <p>` names a path's area and its
rules when a territory is in doubt.

**Paths that land alone.** When `landings.alone` in the config lists patterns (or an area says
`landing: alone`), `omni plan check` enforces the repository's own rule: a slice whose territory touches a path one pattern matches
touches nothing else, and a landing holding such a slice holds only such slices. Put the migrations
in their own landing before the code that reads them (an expand landing), and what drops the old
shape in a landing after it (a contract landing). Read `omni kb show releasing` for how this
repository advises cutting them. A PRD whose every slice lands alone needs only one landing.

**In a plan repository** (the config has a `plan` section; `/omni:mega-brainstorm` runs this skill
there), a slice lands in one repository, so the slice table gains a `repo` column, and a
`## Repositories` table comes before `## Slices`. Anywhere else, never write either: `omni plan
check` refuses a `repo` column outside a plan repository.

- The header row is exactly:

  ```markdown
  | id | repo | slice | territory | blocked by | wave |
  | --- | --- | --- | --- | --- | --- |
  | s1 | <name> | <what it makes true> | `<dir>/` | — | 1 |
  ```

  `repo` is a repository's **short name**, the part after the `/`: a target's from `plan.targets`,
  or the plan repository's own (from `repo.slug`) for a docs change the feature needs there. The
  slice's territory is a path in that repository.
- `## Repositories` has one row per repository a slice names, and no other:

  ```markdown
  | repo | role | read at | knowledge |
  | --- | --- | --- | --- |
  | <name> | <the target's role> | <40-character commit> | own |
  | <plan repository's name> | plan | — | own |
  ```

  `role` is the target's role, or `plan` for the plan repository. `read at` is the full
  40-character head of the clone the territories were read from
  (`git -C <clone> rev-parse HEAD`), or `—` on the plan repository's row. `knowledge` is `own`,
  `imported`, `imported (stale)` or `none`, as `omni targets` read it.
- Waves are one numbering across every repository, and `blocked by` names slices of any
  repository. Two slices collide only when they share a repository and their territories meet: the
  same path in two repositories shares no ground, so the shared-ground note is written per
  repository.

## 5. Check until green

```bash
node .omni-loop/bin/omni.mjs plan check <n>
```

It prints the waves and the collision matrix (and, for more than one landing, a line per landing),
then every violation: a duplicate id, a blocker that names no slice, sits in another landing, or sits
in the same or a later wave, two slices sharing ground in one wave of one landing, landing numbers
with a gap, a `## Landings` table that does not match the slice table, and, with `landings.alone`
set, a land-alone path sharing a slice or a landing with anything else. Fix
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
   `gh pr list --head <feature branch> --state open --json number,url,isDraft,baseRefName` finds a
   feature PR already open for the branch, whatever its base (it may be stacked on another PR's
   branch, as `/omni:pr` says): update its body, footer line included, instead of opening another.
3. The status comment's state is `claimed`, with `slices: 0 / <total> merged`. Do not enter
   `/omni:pr`'s check loop, and never mark the PR ready: `/omni:yolo` carries it from here.
4. Comment on the PRD issue: `Plan: <plan path> · Feature PR: #<pr>`.
5. No agent is on the PR once this skill stops, so remove the label:
   `gh pr edit <pr> --remove-label "<labels.inProgress>"`. `/omni:yolo` puts it back when it picks
   the PR up.

**A plan of more than one landing** opens one draft PR per landing, stacked, instead of the one
feature PR above. The chain is computed, never worked out by hand:

```bash
node .omni-loop/bin/omni.mjs plan landings <n> --json
```

It prints, per landing in order, its `branch` (`branches.landing` filled), its `base` (the default
branch for landing 1, landing n-1's branch for landing n), its `titleSuffix` (` (n/N)`), its
`mergeAfterLine` (`null` for landing 1) and its `slices`. Then:

1. **Branches.** Landing 1's branch is cut from `<repo.remote>/<repo.defaultBranch>`, landing n's
   from landing n-1's branch, each pushed with `git push -u <repo.remote> <branch>`. When a branch
   already exists on the remote, keep it. In the worktree, rename the feature branch to landing 1's
   (`git branch -m <feature branch> <landing 1 branch>`, before anything was pushed), commit the plan
   there as in item 1, push, and follow `/omni:dossier-push <n>`. Then cut each later landing's
   branch from the one before it and push it: it starts with the plan and nothing else.
2. **Pull requests.** One draft **feature**-kind PR per landing, through `/omni:pr`, head the
   landing's branch and base its `base`. Its title is the PRD's title followed by `titleSuffix`. Its
   body, in order: `prLinks.feature` filled; the landing's `mergeAfterLine` as a paragraph, when it
   is not `null`; the **Slices** checklist of **that landing's** slices only; a `## Landings`
   overview, one line per landing of the PRD,
   `- Landing <n>/<N> <name> — #<pr> — <draft | ready | merged> — merge when: <mergeWhen or —>`,
   this landing's line marked `(this PR)`; the **Acceptance** checklist when `acceptance.enabled` is
   true; the remaining sections; and last the `omni sign footer` line. Open them in order, landing 1
   first, then write every overview once every number is known.
3. **Again.** `gh pr list --head <branch> --state open --json number,url,isDraft` finds a landing
   PR already open: update its title and body instead of opening another, so a second run opens
   nothing new.
4. Each landing PR gets the status comment of item 3 (`slices: 0 / <its slices> merged`), and loses
   `labels.inProgress` as in item 5.
5. Comment on the PRD issue once: `Plan: <plan path> · Landings: #<pr 1> (1/N), #<pr 2> (2/N), …`.

A plan of one landing never reads `plan landings` for its branch or title: it is the feature
branch, the one feature PR, no suffix and no overview, as above.

**Point `plan.done`.** Once the plan is committed and its draft PR (or every landing PR) is open,
run `node .omni-loop/bin/omni.mjs flow show plan.done` and follow it (**Flow points**), with `{prd}`
the PRD's number and `{plan}` the plan's path; its kit step is empty: only its hooks run. A `not ok`
is named in the hand-off, and the plan and its PR stay as they are.

## 7. Hand off

Print the slice table and the waves `omni plan check` reported (and, for more than one landing,
the landing PRs in order, `#<pr> (n/N)`; "the feature PR" below is then landing 1's), then the PRD's page beside its
number. Run `node .omni-loop/bin/omni.mjs dossier link <n>`: exit `0` prints the page's link on one
line, so print `PRD <n>: <link>`. Anything else (`none`, `off`, `no sign-in (omni signin)`,
`unreachable`, `refused (<status>)`, or exit `2` from a kit without the verb) means it has no page
to show: print `PRD <n>: no page yet, https://github.com/<owner>/<repo>/issues/<n>` instead. It
never stops the hand-off. Then:

- **Followed by `/omni:brainstorm` or `/omni:yolo`:** return to it, and print no **What is next?**.
  The caller says what is next, so the reply never carries two.
- **Run alone:** end the reply with these two short steps, every placeholder filled with a real
  number or link, and the command alone on the reply's last line:

```markdown
**What is next?**

1. Review the plan: https://github.com/<owner>/<repo>/pull/<feature PR>
2. Type /clear (or open a new terminal), then run:

/omni:yolo <n>
```

No folder and no stages here: run alone, this skill cannot tell whether the PRD's phase-0 PR has
merged, so a stage marker could be wrong. A ◆ PRD that step 1 read as `prd` gets one more line
before the two steps: `PRD <n> waits for approval: <link>`, its `approval:` line as printed, so the
person approves it on its page before `/omni:yolo` runs.

## Guardrails

- One PRD, one feature branch, one feature PR, or, for a plan of more than one landing, one branch
  and one draft PR per landing, stacked in order. Related small asks belong in one PRD when it is
  written, not in one plan afterwards.
- Slices live in the plan, never in issues.
- Every slice declares a territory, and the waves come from `omni plan check`, never from a
  sentence saying the slices look independent.
- The feature PR, and every landing PR, stays draft.
- Never write code, never file an issue, never merge.
