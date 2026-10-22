---
name: mega-bug-fix
description: The bug fix of a plan repository — takes a bug that shows in one target repository and whose cause may sit in another, from one line or a bug issue of the plan repository, to one fix pull request per target and one record pull request a person merges last. Opens (or reads) the issue in the plan repository, with --prd linking it to a PRD, classifies and triages it with a Repositories line, locates the cause in the targets' read-only clones, posts a fix plan in merge order, provider first, then proves red in each target with its own committed setup and preflight or its CI run before fixing it there, each target PR saying Part of the issue and Merge after the PRs before it, and records the fix with a Fixes table in a record PR that closes the issue, proven by omni bug. All or nothing across targets; a contract change that would break today's consumer hands over the /omni:mega-brainstorm line, after asking the person on its job with omni runner ask when it runs on a runner (OMNI_UNATTENDED set); --answers <job> resumes from what they answered on the Omni page. A rerun of an issue whose fix plan names a pull request resumes the stopped fix on its branches, never starting over, and a stop a rerun can finish ends on the line that resumes it, which a runner reads as stopped mid-way. Runs nothing in a target but its own committed setup, then its own committed preflight, never merges. With --product <key>, runs from any kitted checkout of a product's repository instead, the bug being recorded on the server as <key>-B<n> with its Fixes rows, each fix PR's body starts with Fixes <key>-B<n> and a link, and there is no record PR and no plan-repository issue. Triggers on "fix this bug across the repositories", "the front-end shows it, the back-end causes it", "mega bug fix", "/omni:mega-bug-fix".
---

# Mega bug fix: one bug, one PR per target, one record

A **plan repository** (its config has a `plan` section) holds the PRDs; its **target repositories**
hold the code. A bug often shows in one target (the front-end) while its cause sits in another (the
back-end). This skill keeps the bug in the plan repository, its issue, triage, fix plan and record,
and its fixes in the targets: one fix pull request per target that changes, in merge order, provider
first, and one **record PR** in the plan repository that closes the issue and is merged last.

It follows `/omni:bug-fix` **step for step**, and never copies it: each step below either says "as
`/omni:bug-fix` step N" and adds only what differs, or is new. Read `/omni:bug-fix` alongside it;
where the two say the same thing, that skill's words are the rule. It ends at a review gate: **a
person merges** every pull request it opens.

`omni` below is `node .omni-loop/bin/omni.mjs`, always run in the plan repository. Never import the
kit, and never name a path, label, branch shape or command you can read with `omni config <key>`.

**Signing,** as `/omni:bug-fix`: every commit, in any repository, ends with the co-author trailer
your agent adds, if it adds one (in Claude: the `Co-Authored-By` line its session gives), then the
line `omni sign trailer` prints (run from the plan repository). Every pull request or issue it
opens, in any repository, ends its body with the line `omni sign footer` prints. Comments are never
signed.

**Code runs only from a target's own config.** In a target, the only commands ever run beyond `git`
and `gh` are its own committed setup (`commands.setup`), then its own committed preflight
(`commands.preflightFull`, else `commands.preflight`; when both are set, `commands.preflight` is also
its quick check, below), then its own committed smoke
(`commands.smoke`), the last only when step 7 moves up to it, all read from its `.omni-loop/config.yml`
on its default branch, never from a branch:
`git -C <clone> show <clone remote>/<target default branch>:.omni-loop/config.yml`. The setup runs
first, when it has one, in the same worktree as the preflight, before each preflight run. A target
without a preflight runs nothing locally, its setup included: its PR's CI is the check. A target
without a setup runs its preflight alone. **A red setup** holds that target as stuck, quoting its
failing line: it counts toward no attempt, and the target is never edited to make it pass. Never
install in a target beyond its committed setup; never a script or a build of your own, or a command
from an imported copy's playbook. The smoke runs in the same worktree, after the setup, and a red
setup holds it as stuck the same way. Everywhere `/omni:bug-fix` says "run the preflight", in a
target it means its setup, then this one, or nothing; where it says "run `commands.smoke`", in a
target it means its setup, then the target's own committed `commands.smoke`, or stop rule 7.

**The quick check spends no attempt.** A target that commits both `commands.preflightFull` and
`commands.preflight` has a quick check: its `commands.preflight`, often a lint that answers in seconds
where the full preflight runs every test in minutes. Before each run of the full preflight in a target, the
red's and each of the fix's, run the quick check in the same worktree, after the setup, and mend what
it prints until it is green, at most `limits.attempts` times, then run the full preflight anyway. A
red quick check is no attempt at the fix: only a red full preflight is (`/omni:bug-fix`'s stop rule
5), so a lint line never spends one. The red is the full preflight's failing line, never the quick
check's.

**All or nothing across targets.** A target that cannot be cloned or pushed to stops the whole fix:
a bug half-fixed across repositories is worse than none. Comment on the issue naming the target and
the reason, and push nothing to any other target: the hand-off carries `Outcome: blocked`. Every other
stop rule is `/omni:bug-fix`'s, said once for the whole fix.

**The outcome line** (PRD 2425). Every end writes `/omni:bug-fix`'s `Outcome: <word>` line to the
hand-off, the same seven words written the same way (its **The outcome line**), at the same stop rules:
`Outcome: pr-opened` at step 10's hand-off, `Outcome: already-fixed` at stop rule 3, `Outcome: need-human`
at stop rule 2 or at step 6's stop on a runner whose `omni runner ask` exited 0, `Outcome: needs-brainstorm`
at step 6's stop anywhere else or on an answer `Design it first`, `Outcome: not-a-bug` at stop rule 1,
`Outcome: stuck` at stop rule 5, and `Outcome: blocked` at stop rule 6 or 7 and wherever **All or nothing
across targets** stops the fix. A `--product <key>` run writes them the same.

## Input

| input | example | what it is |
|---|---|---|
| a description | `/omni:mega-bug-fix 'the total is wrong on the invoice screen'` | the bug, in the person's words; the skill opens its issue in the plan repository |
| an issue | `/omni:mega-bug-fix 612`, `#612`, or its URL | a bug issue of the plan repository; a URL of another repository stops the skill, as `/omni:bug-fix`. One whose fix plan already names a pull request is a rerun: see **Resuming a stopped fix** |
| `--prd <prd>` | `/omni:mega-bug-fix 'the total is wrong' --prd 1200` | links the bug to PRD `<prd>`, so `/omni:mega-pr-care <prd>` looks after its PRs too |
| `--product <key>` | `/omni:mega-bug-fix 'the total is wrong' --product mobile` | a product run: see **From a product** |
| `--answers <job>` | `/omni:mega-bug-fix #612 --answers 4821` | a resume (PRD 2255): a person answered on the Omni page the questions job `<job>` asked at a stop for a decision; see **Resuming with answers** |

With no input, say that this skill takes a description of the bug or an issue, and stop.
`--answers <job>` goes with a bug issue of the plan repository, the one the job stopped on: given alone,
say that a resume needs its issue, and stop.

## Step 0

1. Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the
   JSON, as `/omni:bug-fix` step 0 keeps it, and its `plan` section. **From a product:** with
   `--product <key>`, follow **From a product** below from here on, a plan repository or not.
   Otherwise, without a `plan` section, stop with exactly one line:

   ```text
   not a plan repository: /omni:bug-fix
   ```

2. The briefing (`node .omni-loop/bin/omni.mjs session start`), then the `bug-fixing` and
   `testing` forms, as `/omni:bug-fix` step 0. In a target, its own committed forms are read in its
   clone, `(cd <clone> && node <plan repository root>/.omni-loop/bin/omni.mjs kb show testing)`,
   never the imported copy.

## From a product (`--product <key>`)

A **product bug** (PRD 2011) lives on its product on the Omni page, and in no repository: its id is
the product's key and a counter, `mobile-B74` (`<key>-B<n>`), and its Fixes rows (one per fix
PR: repository, pull request, what changes, reproduction, guard, merged at) are the server's. This
run starts from any checkout of a repository the product holds that has the kit installed, a plan
repository or not. It opens no record PR and no plan-repository issue, writes no `bugs/` folder, and
runs steps 1 to 10 below with these differences.

**Which product.** `node .omni-loop/bin/omni.mjs product use <key>` remembers the key in this
checkout (exit 2: the key is not one, print its line and stop); without `--product`,
`omni product which` naming a remembered product makes this a run for it, said in one line.

- **Steps 1 and 2: no issue.** The bug is described in the person's words in the record (step 8
  below), not in an issue; the classification of `/omni:bug-fix` step 2 is kept in the record's
  Triage. A description or `--prd` that names a plan-repository issue is read, never opened.
- **Step 3, the triage,** is a `## Triage` section of the record, with its **Repositories** line,
  and no issue comment. **Step 5, the fix plan,** is the record's `## Fixes` table and no comment.
- **Step 4, the targets,** are the product's repositories (`omni targets --json` when the config has
  `plan.product`, else this checkout's repository and each one the person names, asked and never
  assumed), read in clones as step 4 says. A target outside the product is never read.
- **Step 7, each target,** runs as written, and its PR body differs (below). `Part of <plan slug>#<n>`
  is not written: there is no issue. Each PR is a standalone PR into its target's default branch,
  draft until its red and its fix are pushed.

**The record comes first, with no pull request yet.** Write `bug.md` to a scratch folder
(`mktemp -d`, outside every repository), shaped as step 8 shows (a `# <title>` heading, `## Triage`,
`## Fixes` with `—` for every pull request, `## Reproduction`, `## Guard`, `## Mutation`), one
Reproduction and one Guard line per row, each keyed by the repository. Then:

1. **Check it:** `node .omni-loop/bin/omni.mjs bug check --product <key> <file>`, until it prints
   `ok`: a row naming a repository outside the product is refused by name.
2. **Create it:** `node .omni-loop/bin/omni.mjs bug push --product <key> --new <file>`. It prints
   the new id, `<key>-B<n>`, on a line of its own, then the bug's page link. A refusal (no such
   product, no sign-in, the server unreachable) is printed as is, and the run stops there: nothing
   was created and no target was touched (**All or nothing across targets**).
3. **Open each fix PR** (step 7) with a body that starts with these lines, then the reproduction line
   and the guard line of its row, so `git log` and blame still lead to the why:

   ```markdown
   Fixes <key>-B<n> · <link>
   Merge after <slug>#<pr>
   ```

   then `/omni:bug-fix`'s body from **What was wrong** on, as step 7 says. It is **never a closing
   keyword**: `Fixes <key>-B<n>` names a record that is not a GitHub issue, so it closes nothing. A
   consumer's PR adds one `Merge after <slug>#<pr>` line per PR before it, in the plan's order.
4. **Write each PR into its row**, at once: edit `bug.md`'s `## Fixes` table, then
   `node .omni-loop/bin/omni.mjs bug check --product <key> <file>` and
   `node .omni-loop/bin/omni.mjs bug push --product <key> --bug <n> <file>`. A file that did not
   change adds no version.

**The merge is the App's.** There is no record PR to merge last: the App stamps `merged_at` on the row
whose repository and PR match when a fix PR merges, and the record ships when the last row is merged.
A person merges the PRs in the order the `Merge after` lines give.

**Step 10, the hand-off,** names the bug id and its page, each PR in merge order, and what was proven
and what was not, per target. `omni bug <n>` and `omni check` read a repository's issue and folder: the
hand-off names them as not run.

## 1. Issue

As `/omni:bug-fix` step 1, in the plan repository, labelled `labels.bug`. With `--prd <prd>`, the
body carries the line `For PRD #<prd>`, on a line of its own, exactly so (`omni care list` reads
it); an existing issue without it gets it added (`gh issue edit <n> --body-file <file>`).

An existing issue whose fix plan (step 5's lookup) already names a pull request in a row, or whose
triage's **Branch** line already names a fix branch, is a rerun: follow **Resuming a stopped fix**
from here, not steps 2 to 6. Without `--answers`, a rerun never starts the fix over.

```markdown
<the line, as the person wrote it>

For PRD #<prd>

A bug fix across repositories: `/omni:mega-bug-fix` triages it, plans the fix target by target,
opens one pull request per target, and a record pull request that closes this issue.

<the line `omni sign footer` prints>
```

## 2. Classify

As `/omni:bug-fix` step 2.

## 3. Triage

As `/omni:bug-fix` step 3, in the plan repository, the risk asked of Jev included. The triage
comment adds one line, after **Domain**, naming every target that must change, by its name:

```markdown
- **Repositories:** <name>, <name>
```

Its **Reproduction** and **Branch** lines name one per target, `<name>: <path>` and
`<name>: <fix branch>`. A regression's evidence is read in the target it happened in, and so is the
**Production** line: the deployed version, the releases and the deployments are those of the target
the report comes from, not the plan repository's.

## 4. Locate

New. Read the targets from their clones at `<worktrees>/targets/<name>` (`<worktrees>` is
`omni config worktrees`), cloned or fetched as `/omni:ultra-yolo` step 2 item 1 does, each with its
own default branch (`gh repo view <slug> --json defaultBranchRef --jq .defaultBranchRef.name`).
When the triage names a deployed version (its **Production** line), read each target at that deployed
tag too, besides its default branch (`git -C <clone> show <tag>:<path>`, `git -C <clone> log
<previous tag>..<tag>`): the cause is often in what the tag changed. The fix is still cut from the
target's default branch. Read only: find where the cause is, and which targets must change. Their knowledge is read where
`plan.targets` says it lives. A target that cannot be cloned or fetched stops the whole fix (**All
or nothing across targets**).

## 5. The fix plan

New. **One** comment on the issue, found by its marker and edited in place, as the triage is:

```bash
gh api repos/<repo.slug>/issues/<n>/comments --paginate \
  -q '.[] | select(.body | startswith("<!-- omni-bug:fix-plan -->")) | .id'
```

```markdown
<!-- omni-bug:fix-plan -->

## Fix plan

| order | repository | pull request | what changes |
| --- | --- | --- | --- |
| 1 | <provider slug> | <slug>#<pr> | <what changes there, in one line> |
| 2 | <consumer slug> | — | <what changes there> |
```

One row per target that changes, in merge order: **the provider first**, then its consumers: the
repository that serves the contract before the one that calls it, back-end towards front-end. Each
row's pull request is `—` until it opens, then `<owner/name>#<pr>` (`omni care list` reads it), and
the comment is edited in place each time one opens.

## 6. The boundary

As `/omni:bug-fix` step 4, read in each target (its own `risk.storedShape` and
`risk.sharedContract`, read from its committed config, when it has them), and checked at every step
after, with one difference: a fix may touch the contract between two targets **only when the
provider's change keeps the consumer working as it is on its default branch today** (an added field,
a restored one). A change that would break the consumer as it is, a stored shape, a new screen, route
or API, or a behaviour not already settled is more than a bug fix: comment on the issue as
`/omni:bug-fix`'s **The stop** does, with this line in place of its own, and stop, pushing nothing to
any target:

```text
/omni:mega-brainstorm <the issue's line>
```

The hand-off carries `Outcome: needs-brainstorm`. On a runner, with `OMNI_UNATTENDED` set, ask the person
on the job before that comment goes up: **Asking on a runner**, below, where an ask that went through
ends on `Outcome: need-human`.

## 7. Each target, in the plan's order

For each row of the fix plan, in order: a worktree of the target's clone at
`<worktrees>/targets/<name>--fix-<n>`, on `branches.fix` with `{topic}` = `<n>-<slug>`, cut from
the target's own default branch, never `repo.defaultBranch`:

```bash
git -C <clone> fetch <clone remote>
git -C <clone> worktree add -b <fix branch> <worktrees>/targets/<name>--fix-<n> <clone remote>/<target default branch>
```

Then `/omni:bug-fix` steps 6 to 9: **words first, prove red, fix, guard**, in that worktree. What
differs:

- **Prove red** with the target's preflight when it has one: the reproduction committed alone, its
  setup run first (when it has one), then the preflight run on it, and its failing line is the red.
  **Without a preflight,** push the reproduction alone, open the draft PR (below), and the red is
  the failing CI run's link. A preflight or CI run that passes on the reproduction alone is
  `/omni:bug-fix`'s stop rule 3, unless the third reading applies (next item). Red is seen **before** the fix, in every target, and never by running anything the target did not commit.
- **Fix** until the full preflight is green, the quick check green before each run (**The quick check
  spends no attempt**): `limits.attempts` counts red full preflights only.
- **The third reading moves up to the target's smoke.** When `/omni:bug-fix` step 7's third reading
  (**this level cannot see it**) applies in a target, the reproduction becomes one more case of the
  target's `commands.smoke`, read from its default branch's config, and runs as its setup, then
  `commands.smoke`, in that worktree, before any fix; its failing line is the red, and `commands.smoke`
  green is the proof the fix works. A target with no `commands.smoke` it can run (none committed, or a
  tool the session lacks and no CI run of it) is stop rule 7: the comment on the plan repository's
  issue names the target, the suspect, its **Production** line and the YAML line to commit in the
  target's `.omni-loop/config.yml`, and nothing is pushed to any other target (**All or nothing across
  targets**); the reproduction stays on its pushed branch in that target, and the hand-off carries
  `Outcome: blocked`. Each target PR's reproduction line names its level.
- **Stop rule 3 names the fix,** as `/omni:bug-fix`'s **Who fixed it** does, in that target's clone,
  and writes the same comment on the issue in the plan repository: `Fixed by #<n>` for a pull
  request of the plan repository, `Fixed by <PR URL>` for one in a target, only for a candidate proven
  red at its merge commit's first parent and green at its merge commit, `Maybe: #<n>` or
  `Maybe: <PR URL>` lines otherwise. Proving runs only the target's own committed setup, then its own
  committed preflight, on the reproduction committed alone in a detached worktree at each commit; a
  target without a preflight proves nothing here, so its candidates are `Maybe:` lines. The skill never
  closes the issue. A product run has no issue: it posts nothing, and the hand-off carries the same
  comment's text. The hand-off carries `Outcome: already-fixed`, then `Fixed by: <PR URL>` for the proven
  candidate only, never for a `Maybe:` one.
- **Mutation:** the line is `Mutation: not run in a target`.
- **The PR,** through `/omni:pr --repo <slug>`, a standalone PR into the target's default branch,
  draft until its red and its fix are pushed. Its body starts with `Part of <plan slug>#<n>`
  (`<plan slug>` is the plan repository's `repo.slug`), **never a closing keyword**, so it never
  closes the plan repository's issue. A consumer's PR adds one `Merge after <slug>#<pr>` line per
  PR before it in the plan. Then `/omni:bug-fix`'s body from **What was wrong** on,
  without its `## Proof` section (no film is made in a target), its `## Bug`
  section with one more line, `- **Fix plan:** <the fix-plan comment's link>`, and its **Record**
  line naming the record in the plan repository. `labels.bug` is added only when the target has
  it; a label is never created in a target.

  ```markdown
  Part of <plan slug>#<n>
  Merge after <slug>#<pr>
  ```

- **Its PR goes into the fix plan's row** (step 5), at once.

Push nothing to any target before every earlier target's worktree is ready: a target that cannot be
pushed to stops the whole fix (**All or nothing across targets**). Remove each worktree
(`git -C <clone> worktree remove`) once its PR is open.

## 8. The record

As `/omni:bug-fix` step 11, in the plan repository, on a worktree of its own on `branches.fix`
cut from `repo.defaultBranch`: `<paths.delivery>/bugs/<nnnn>-<slug>/bug.md`, with one more
section, `## Fixes`, after `## Triage`. The Reproduction, Guard and Mutation sections give one line
per target, keyed by the target's name, in the plan's order:

```markdown
## Fixes

| order | repository | pull request | what changes |
| --- | --- | --- | --- |
| 1 | <provider slug> | <slug>#<pr> | <what changes there> |
| 2 | <consumer slug> | <slug>#<pr> | <what changes there> |

## Reproduction

- **<provider name>:** `<path>` — <the failing preflight line, verbatim | the failing CI run's link>
- **<consumer name>:** `<path>` — <…>

## Guard

- **<provider name>:** <what it is and what it catches | none — <reason>>
- **<consumer name>:** <…>

## Mutation

- **<provider name>:** not run in a target
- **<consumer name>:** not run in a target
```

## 9. Ship the record

As `/omni:bug-fix` step 12, in the plan repository:

1. **Commit** the record, signed.
2. **Prove it:** `node .omni-loop/bin/omni.mjs bug <n>`, until it prints `ok`. It checks the
   `## Fixes` rows against `plan.targets`, in order 1..k, each with its PR and its Reproduction and
   Guard lines. A `## Fixes` record is exempt from the proof check: no body file, and no `## Proof`.
3. **Push** the fix branch.
4. **Send the record to its page:** follow `/omni:dossier-push <n> --kind bug`.
5. **The record PR,** through `/omni:pr`, a standalone PR into `repo.defaultBranch`: its body
   starts with `Closes #<n>` and one `Merge after <slug>#<pr>` line per target PR, in the plan's
   order, then `/omni:bug-fix`'s body, without its `## Proof` section. **The record PR is the only one
   that closes the issue, and it merges last.**

   ```markdown
   Closes #<n>
   Merge after <slug>#<pr>
   ```

## 10. Hand off

As `/omni:bug-fix` step 13: the issue, the fix plan, each target PR in merge order, the record PR,
the fix's page, and what was proven and what was not, per target (the red, the preflight or CI, the
guard, the mutation line, the `omni bug` line). With `--prd <prd>`, add that
`/omni:mega-pr-care <prd>` now looks after these PRs too. Then the line `Outcome: pr-opened`, then:

> Review the PRs and merge them in this order, the record PR last.

**A stop a rerun can finish** (stop rule 5 in any target, or a target that could not be cloned or
pushed to, **All or nothing across targets**) hands off what it left, then ends on exactly one last
line, nothing after it: the line that resumes it (**Resuming a stopped fix**). A runner reads a job
that ends on it as stopped mid-way, and the Omni page offers Resume, which sends the job's line again.

```text
/omni:mega-bug-fix #<n>
```

Every other stop keeps its own last line: a person decides first.

## Asking on a runner

As `/omni:bug-fix`'s **Asking on a runner**, at step 6's stop, with these differences. It runs in the plan
repository, when `OMNI_UNATTENDED` is set (a runner job, with nobody to read a comment) and the bug has
its issue there. Run by a person in a terminal, `OMNI_UNATTENDED` is not set, and step 6's stop is as it
is. A `--product <key>` run has no issue to ask on, so its stop is as it is too.

The questions are written as `/omni:bug-fix` writes them: 1 to 4 questions, each with 2 to 4 options, the
last `Design it first`, described `Stop here and brainstorm the behaviour`. An option is one way to fix
it across the targets: which target changes, which side of a contract.

Run `node .omni-loop/bin/omni.mjs runner ask --file <questions file> --issue <n> --lead <lead file>`,
where `--issue <n>` is the plan repository's issue. On exit 0, post step 6's stop comment, found by its
first line and edited in place on a rerun: it starts with `<!-- omni-bug:need-human -->` and ends on the
line `omni runner ask` printed, `Waiting for an answer on Omni: <the Runners page link, with
?answer=<job>>`, in place of the `/omni:mega-brainstorm` line. Then end with exit 0, pushing nothing to
any target, the hand-off carrying `Outcome: need-human`. On any other exit, post step 6's stop comment as
it is, with the `/omni:mega-brainstorm` line, and end as step 6 says, with `Outcome: needs-brainstorm`.

## Resuming with answers

Only with `--answers <job>` (PRD 2255), as `/omni:bug-fix`'s **Resuming with answers**, with these
differences. All of it runs in the plan repository. Read the answers with
`node .omni-loop/bin/omni.mjs runner answers <job>`; when it exits 1, or the row holds no answers, stop
with the line it printed and touch nothing, pushing nothing to any target: `Outcome: blocked`.

Post the decision on the plan repository's issue, starting `<!-- omni-bug:decision -->`, with
`Decided in Omni by @<login>`, the line `Job <job>` and each question with its answer, found by its first
line and that job line and edited in place on a rerun. Then go on from step 3, the triage, to locate the
cause (4) and post the fix plan (5), with the answers as the behaviour wanted across the targets: they
settle the decision step 6 stopped on, and that one only, so a line crossed for any other reason is a new
stop. Every pull request opens as written, and a person merges each one, the record PR last.

When an answer is `Design it first`, stop with the `/omni:mega-brainstorm` line, pushing nothing to any
target, and end with exit 0, the hand-off carrying `Outcome: needs-brainstorm`. When the fix meets another
decision, it asks again, as **Asking on a runner**. With `--product <key>` there is no issue to resume on:
stop with one line saying so, and `Outcome: blocked`.

## Resuming a stopped fix

A rerun of an issue whose fix plan already names a pull request, or whose triage already names a fix
branch (step 1), picks the fix up where the last run stopped: stuck at `limits.attempts` in a target,
a target that could not be reached, or a job that ended before its hand-off. The triage, the fix plan
and the boundary stand as they are, and steps 2 to 6 are not run again. A target's fix branch is its
PR's head branch, else the one the triage's **Branch** line names for it. Each row of the fix plan,
in the plan's order:

| the row's pull request | what the rerun does |
|---|---|
| merged, or open and not a draft | nothing: it is done |
| open and a draft, labelled `labels.needsFix` or not | resumed on its branch, below |
| `—`, with its fix branch on the target's remote | resumed on that branch, below, and its PR opens as step 7 says |
| `—`, with no fix branch | step 7, as written |
| closed unmerged | stop: a person closed it. Name it in the hand-off and push nothing to any target (**All or nothing across targets**) |

Then step 8, the record, and step 9. A record PR already open for the issue (an open PR of the plan
repository whose body starts with `Closes #<n>`) is kept, its `## Fixes` rows brought up to date: a
rerun never opens a second one. Then step 10.

**On its branch.** The pushed branch is what resumes. A worktree the stopped run left at the path is
removed first, with anything it did not push:

```bash
git -C <clone> fetch <clone remote>
git -C <clone> worktree remove --force <worktrees>/targets/<name>--fix-<n>   # only when the path is there
git -C <clone> worktree add -B <fix branch> <worktrees>/targets/<name>--fix-<n> <clone remote>/<fix branch>
```

The branch's first commit over the target's default branch is the reproduction: step 7 commits it
alone.

- **The branch holds the reproduction alone:** prove red on it as step 7 says, then fix.
- **It holds more** (a fix was tried, so red was seen first): the red stands. Its failing line is read
  back from the PR's body or the comment saying what is stuck. When neither quotes it, prove it again
  on the reproduction commit alone, in a detached worktree, as **Stop rule 3 names the fix** proves a
  candidate: the setup, then the full preflight. That run spends no attempt.

Then fix as step 7 says, on top of the branch: commits go after the stopped run's, never in place of
them. A rerun is a job of its own, so `limits.attempts` starts again. **Green:** commit, push
(`git push <clone remote> <fix branch>`, never forced), write the PR's body as step 7's PR says
(`gh pr edit <pr> --body-file <file>`), mark it ready (`gh pr ready <pr>`), remove `labels.needsFix`
(`gh pr edit <pr> --remove-label "<labels.needsFix>"`), and comment on the PR with one line,
`Resumed: green at <sha>`. **Red again `limits.attempts` times:** stop rule 5, as written, and the
hand-off ends on the line that resumes it again (step 10).

A `--product <key>` run has no issue, and `--answers <job>` follows **Resuming with answers**: neither
reads this section.

## Never

- **Never merge,** in any repository.
- **Never a closing keyword on a target PR:** `Part of`, always. Only the record PR closes the issue.
- **Never fix before red,** in any target, and never prove red by running a command the target did
  not commit.
- **Never push to one target while another cannot be reached:** all or nothing.
- **Never change a contract in a way that breaks today's consumer:** that is the
  `/omni:mega-brainstorm` line.
- **Never write a `Fixed by` line for a pull request that is not proven,** in the comment or in the
  hand-off, nor two `Outcome:` lines.
- **Never ask on a job unless `OMNI_UNATTENDED` is set,** and never carry on from answers that could not
  be read: stop with the line `omni runner answers` printed.
- **Never create a label in a target,** and never run a command from an imported copy's playbook.
- **Never run a command in a target other than its own committed setup, then its own committed
  preflight (its quick check included), then its own committed `commands.smoke` when step 7 moves up
  to it** (beyond `git` and `gh`).
- **Never count a red quick check as an attempt,** and never take it for the red.
- **Never start a fix over on an issue whose fix plan names a pull request:** resume it. Never rewrite
  a resumed branch, and never force a push.
- Never commit on any repository's default branch, and never report anything as proven that was not
  run.
