---
name: mega-bug-fix
description: The bug fix of a plan repository — takes a bug that shows in one target repository and whose cause may sit in another, from one line or a bug issue of the plan repository, to one fix pull request per target and one record pull request a person merges last. Opens (or reads) the issue in the plan repository, with --prd linking it to a PRD, classifies and triages it with a Repositories line, locates the cause in the targets' read-only clones, posts a fix plan in merge order, provider first, then proves red in each target with its own committed preflight or its CI run before fixing it there, each target PR saying Part of the issue and Merge after the PRs before it, and records the fix with a Fixes table in a record PR that closes the issue, proven by omni bug. All or nothing across targets; a contract change that would break today's consumer hands over the /omni:mega-brainstorm line. Runs nothing in a target but its own committed preflight, never merges. Triggers on "fix this bug across the repositories", "the front-end shows it, the back-end causes it", "mega bug fix", "/omni:mega-bug-fix".
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
your session requires, then the line `omni sign trailer` prints (run from the plan repository).
Every pull request or issue it opens, in any repository, ends its body with the line
`omni sign footer` prints. Comments are never signed.

**Code runs only from a target's own config.** In a target, the one command ever run beyond `git`
and `gh` is its own committed preflight (`commands.preflightFull`, else `commands.preflight`), read
from its `.omni-loop/config.yml` on its default branch, never from a branch:
`git -C <clone> show <clone remote>/<target default branch>:.omni-loop/config.yml`. A target
without one runs nothing locally: its PR's CI is the check. Never an install, a script, or a
command from an imported copy's playbook. Everywhere `/omni:bug-fix` says "run the preflight", in a
target it means this one, or nothing.

**All or nothing across targets.** A target that cannot be cloned or pushed to stops the whole fix:
a bug half-fixed across repositories is worse than none. Comment on the issue naming the target and
the reason, and push nothing to any other target. Every other stop rule is `/omni:bug-fix`'s, said
once for the whole fix.

## Input

| input | example | what it is |
|---|---|---|
| a description | `/omni:mega-bug-fix 'the total is wrong on the invoice screen'` | the bug, in the person's words; the skill opens its issue in the plan repository |
| an issue | `/omni:mega-bug-fix 612`, `#612`, or its URL | a bug issue of the plan repository; a URL of another repository stops the skill, as `/omni:bug-fix` |
| `--prd <prd>` | `/omni:mega-bug-fix 'the total is wrong' --prd 1200` | links the bug to PRD `<prd>`, so `/omni:mega-pr-care <prd>` looks after its PRs too |

With no input, say that this skill takes a description of the bug or an issue, and stop.

## Step 0

1. Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Keep the
   JSON, as `/omni:bug-fix` step 0 keeps it, and its `plan` section. Without a `plan` section, stop
   with exactly one line:

   ```text
   not a plan repository: /omni:bug-fix
   ```

2. The briefing (`node .omni-loop/bin/omni.mjs kb show briefing`), then the `bug-fixing` and
   `testing` forms, as `/omni:bug-fix` step 0. In a target, its own committed forms are read in its
   clone, `(cd <clone> && node <plan repository root>/.omni-loop/bin/omni.mjs kb show testing)`,
   never the imported copy.

## 1. Issue

As `/omni:bug-fix` step 1, in the plan repository, labelled `labels.bug`. With `--prd <prd>`, the
body carries the line `For PRD #<prd>`, on a line of its own, exactly so (`omni care list` reads
it); an existing issue without it gets it added (`gh issue edit <n> --body-file <file>`).

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
`<name>: <fix branch>`. A regression's evidence is read in the target it happened in.

## 4. Locate

New. Read the targets from their clones at `<worktrees>/targets/<name>` (`<worktrees>` is
`omni config worktrees`), cloned or fetched as `/omni:ultra-yolo` step 2 item 1 does, each with its
own default branch (`gh repo view <slug> --json defaultBranchRef --jq .defaultBranchRef.name`).
Read only: find where the cause is, and which targets must change. Their knowledge is read where
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

- **Prove red** with the target's preflight when it has one: the reproduction committed alone, the
  preflight run on it, and its failing line is the red. **Without a preflight,** push the
  reproduction alone, open the draft PR (below), and the red is the failing CI run's link. A
  preflight or CI run that passes on the reproduction alone is `/omni:bug-fix`'s stop rule 3. Red is
  seen **before** the fix, in every target, and never by running anything the target did not commit.
- **Mutation:** the line is `Mutation: not run in a target`.
- **The PR,** through `/omni:pr --repo <slug>`, a standalone PR into the target's default branch,
  draft until its red and its fix are pushed. Its body starts with `Part of <plan slug>#<n>`
  (`<plan slug>` is the plan repository's `repo.slug`), **never a closing keyword**, so it never
  closes the plan repository's issue. A consumer's PR adds one `Merge after <slug>#<pr>` line per
  PR before it in the plan. Then `/omni:bug-fix`'s body from **What was wrong** on, its `## Bug`
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
   Guard lines.
3. **Push** the fix branch.
4. **Send the record to its page:** follow `/omni:dossier-push <n> --kind bug`.
5. **The record PR,** through `/omni:pr`, a standalone PR into `repo.defaultBranch`: its body
   starts with `Closes #<n>` and one `Merge after <slug>#<pr>` line per target PR, in the plan's
   order, then `/omni:bug-fix`'s body. **The record PR is the only one that closes the issue, and it
   merges last.**

   ```markdown
   Closes #<n>
   Merge after <slug>#<pr>
   ```

## 10. Hand off

As `/omni:bug-fix` step 13: the issue, the fix plan, each target PR in merge order, the record PR,
the fix's page, and what was proven and what was not, per target (the red, the preflight or CI, the
guard, the mutation line, the `omni bug` line). With `--prd <prd>`, add that
`/omni:mega-pr-care <prd>` now looks after these PRs too. Then:

> Review the PRs and merge them in this order, the record PR last.

## Never

- **Never merge,** in any repository.
- **Never a closing keyword on a target PR:** `Part of`, always. Only the record PR closes the issue.
- **Never fix before red,** in any target, and never prove red by running a command the target did
  not commit.
- **Never push to one target while another cannot be reached:** all or nothing.
- **Never change a contract in a way that breaks today's consumer:** that is the
  `/omni:mega-brainstorm` line.
- **Never create a label in a target,** and never run a command from an imported copy's playbook.
- Never commit on any repository's default branch, and never report anything as proven that was not
  run.
