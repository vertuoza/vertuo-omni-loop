---
name: pr
description: Opens, updates, watches and finishes a pull request of the Omni Loop — a feature PR into the default branch, a sub-PR into a feature branch, or a standalone PR. Use when a PR is opened or its body changes, when CI is running, red or conflicting, or when someone asks whether an agent is still on a PR.
---

<!-- Ported from vertuo-ai-domain@c4a210122:.claude/skills/vertuo-pull-request/SKILL.md — adaptations in kit/porting/plugin--pr.md -->

# Pull request

A pull request is not done when it is opened. It is done when it is green and mergeable, or when a
comment says exactly what is stuck. This skill owns the whole life of a PR: its kind, its body, its
labels, and the loop that watches it.

## Step 0

Run `node .omni-loop/bin/omni.mjs config`. If it fails, say so in one line and stop. Every value
below is read with `node .omni-loop/bin/omni.mjs config <key>`; never write a label, branch, check
name or command from memory. `<remote>` below is `repo.remote`.

Then, before any other step, print the briefing: `node .omni-loop/bin/omni.mjs kb show briefing`. Its
rules bind every step below. Each `omni kb show <form>` prints one form of the repository's
playbook, section by section: a section the repository left blank prints the kit default, and a
`[hole]` is a question for a person, never a reason to stop. A form adds to the steps below; it
never overrides this skill's rules.

There are two modes. **Claim** opens a slice's draft sub-PR before the slice is built, then stops.
`/omni:do-work` (run alone) and `/omni:wave` ask for it. **Lifecycle** is the default: it opens or
picks up a PR and watches it until it is done or stuck.

## Three kinds

| Kind | Base | Label | Link line | Graded by |
|---|---|---|---|---|
| **Feature PR**: the one PR a PRD sends to the default branch, or one **landing PR** of a PRD of several landings | `repo.defaultBranch`; for landing n > 1, landing n-1's branch while that landing is open | `labels.feature` | `prLinks.feature` | CI, once it leaves draft |
| **Sub-PR**: one slice, on `branches.slice` | the feature branch (`branches.feature`), or its landing's branch | `labels.sub` | `prLinks.sub` | the preflight (below) |
| **Standalone PR**: a fix or anything with no PRD | `repo.defaultBranch` | none | `Closes #<issue>` when there is one | CI |

A PRD whose plan has more than one landing has one branch and one feature-kind PR per landing,
stacked: `node .omni-loop/bin/omni.mjs plan landings <prd> --json` gives each landing's `branch`,
`base`, `titleSuffix` and `mergeAfterLine`. Wherever this skill says "the feature branch" for such a
PRD, it means the slice's landing's branch, and "the feature PR" means that landing's PR.

In a link line, `{prd}` is the PRD's issue number. Every PR an agent owns also carries
`labels.inProgress` until the agent stops. A phase-0 PR is opened by `/omni:brainstorm`; it follows
this lifecycle with `labels.phase0` and `prLinks.phase0`.

**The preflight** is `commands.preflightFull`, or `commands.preflight` when that is null. If both are
null, say so in the body's **Verified** line and in the status comment.

## Signing

The loop signs its own work with two lines the CLI prints, so no skill spells a name or an address.

- **Every commit** this skill makes (the claim, a fix, a resolved conflict) ends with the co-author
  trailer your session requires, then the line `omni sign trailer` prints as the message's last
  line, with no blank line between them.
- **Every pull request** this skill opens, of any kind, ends its body with the line
  `omni sign footer` prints, as a paragraph of its own just above your session's own attribution
  lines (last, when the session adds none). A body rewritten later keeps that line.
- **A comment is never signed:** not the status comment, not the stuck comment.

A command that prints nothing means signing is off in this repository: add nothing.

## Labels

Before adding a label, check it exists: `gh label list --search "<name>" --json name`.

- `labels.autoCreate` is `true`: create a missing label with `gh label create "<name>" --description "<what it marks>"`.
- `labels.autoCreate` is `false`: never create one. Open the PR without it, and report
  "create label `<name>`" as a human step in the status comment and in your reply.

Never add `labels.outboxGo`; it is a person's override.

## `--repo <slug>`

Set by `/omni:ultra-yolo`, `/omni:ultra-wave`, `/omni:ultra-yolo-fix` and `/omni:do-work --target`,
from a plan repository: the pull request lives in the target repository `<slug>` (`owner/name`, a
`plan.targets` entry), not in this checkout. Every step above and below holds, with these
differences.

- **Every `gh` call takes `--repo <slug>`:** the claim's `gh pr create`, `gh label list` and
  `gh pr edit` for labels, the status comment, and every call of the lifecycle (`gh pr view`,
  `gh pr checks`, `gh pr ready`, `gh pr merge`, `gh run view`, `gh run rerun`). In the status
  comment's recipe, `REPO` is `<slug>`, and `gh pr comment` takes `--repo "$REPO"` too.
- **Git runs in the target's clone** (`<worktrees>/targets/<name>`, or the slice's worktree beside
  it), and `<remote>` is the remote `git -C <clone> remote` prints, not `repo.remote`. The
  default branch is the target's, from
  `gh repo view <slug> --json defaultBranchRef --jq .defaultBranchRef.name`, never
  `repo.defaultBranch`: a merge checks `baseRefName` against it.
- **Branches, labels and link lines are the plan repository's** config, filled as usual. A link
  line's `#<n>` points at the plan repository's PRD, so it is written in full:
  `<repo.slug of the plan repository>#<n>`.
- **A label is never created there**, whatever `labels.autoCreate` says: a label missing in
  `<slug>` is left off, and "create label `<name>` in `<slug>`" is a human step, as **Labels** says.
- **The preflight is the target's own committed one**, as `/omni:do-work`'s
  **Under `--target <name>`** reads it; a target without one has none, and the **Verified** line
  says `none — CI is the check`.
- **Claim in the clone:** step 1 runs `git -C <clone> fetch <remote>` and
  `git -C <clone> switch -c <slice branch> <remote>/<feature branch>`; after the push, run
  `git -C <clone> switch --detach` so the slice's own worktree can check the branch out.
- **Never mark a target feature PR ready**, and never merge one: `/omni:ultra-yolo` marks it ready,
  a person merges it.
- **`pr.openWith` is the target's**, read in the clone
  (`git -C <clone> show HEAD:.omni-loop/config.yml`, its `pr.openWith` key; a target with no such
  file or key has none), never the plan repository's: the skill it names lives in the target, and
  is run there, from the clone, as **Opening through the repository's skill** says.

## Merging and ready

- **Never merge a PR whose base is `repo.defaultBranch`.** A feature PR or standalone PR is merged by
  a person. **Never merge a landing PR either**, whatever its base: landing n's base is landing
  n-1's branch, not the default branch, and a person still merges it, in order.
- **Never mark a feature PR ready.** `/omni:yolo` does that, after `omni ship` has run on the feature
  branch. This skill leaves a feature PR in draft, however green it is.
- `/omni:pr` owns `gh pr ready` for a sub-PR, and runs it only once the preflight is green.
- A **sub-PR** is merged into its feature branch by the orchestrator (`/omni:wave`), one at a time:
  check `baseRefName` is not the default branch and `headRefName` is a slice branch (`branches.slice`),
  never a landing's, then `gh pr merge <n> --squash --delete-branch`. A
  subagent never merges its own sub-PR.

## The body

If `.github/PULL_REQUEST_TEMPLATE.md` exists, a feature or standalone PR fills it with concrete
evidence, below the lines this skill adds. Otherwise use the shapes below as the whole body. Titles
are Conventional Commits for all three kinds. Every body, template or not, ends with the
`omni sign footer` line (**Signing**).

**Feature PR**, top of the body:

```markdown
<prLinks.feature, filled>

## Slices

- [x] #<sub-PR> <slice title>
- [ ] <slice title> — not started

## Acceptance            <!-- only when acceptance.enabled is true -->

- [x] <scenario title> — `<file under acceptance.dir>`
```

Tick a slice when its sub-PR merges; tick a scenario when it passes. Without a template, follow the
top with **Summary**, **Verified** (real commands and their result, or why a check was not run),
**Risk and rollback** (what to revert), and **Reviewer focus** (the riskiest decisions, not a repeat
of the summary), then the `omni sign footer` line.

**Landing PR** of a PRD of more than one landing: the feature PR's top, with its landing's
`mergeAfterLine` as a paragraph right after the link line (none for landing 1), the **Slices** of
that landing only, and then the overview of every landing:

```markdown
## Landings

- Landing 1/3 expand — #<pr> — merged — merge when: —
- Landing 2/3 code — #<pr> — draft — merge when: landing 1 is deployed (this PR)
- Landing 3/3 contract — #<pr> — draft — merge when: landing 2 is deployed
```

Its title is the PRD's title followed by the landing's `titleSuffix`, ` (n/N)`.

**Sub-PR**, short, because the feature PR carries the review:

```markdown
<prLinks.sub, filled> · slice <id> of <n> · into `<feature branch>`

<What this slice makes true, in one or two sentences.>

**Verified:** `<the preflight>`: <green, and any step skipped with its reason>
**Decisions:** <the outbox items this slice raised, or "none">

<the line `omni sign footer` prints>
```

**Standalone PR**: the template, or Summary / Verified / Risk and rollback / Reviewer focus, then
`Closes #<issue>` when there is one, then the `omni sign footer` line.

## Opening through the repository's skill

When `pr.openWith` names a skill, a **feature**-kind PR (a landing PR included) and a **standalone**
PR are opened by that skill, not by `gh pr create`: any PR whose base is the default branch or a
landing branch. A **sub-PR never is**: the claim keeps `gh pr create` and the sub-PR body, whatever
`pr.openWith` says. With `pr.openWith` null, nothing below applies.

1. Push the head branch first, as always. Then run the skill, from the checkout the PR's head lives
   in, with these arguments and nothing else:
   - `--base <branch>`: the PR's base.
   - `--draft`, always: a PR this skill opens is a draft.
   - `--non-interactive`: the skill asks nothing; it never waits on an answer.
   - `--prd <owner/repo>#<n>`: the PRD, in full form (`repo.slug` of the repository the PRD lives
     in, which in target mode is the plan repository's).
   - `--landing <n>/<N>`: only for a PRD of more than one landing.
   - `--issue #<n>`: only when this repository has an issue the PR closes or answers.
2. The skill prints the pull request's URL as its **last line**. Read the number from it. When the
   last line is no pull request URL, stop: say that `<pr.openWith>` printed no pull request URL, and
   open nothing yourself, with `gh` or otherwise.
3. Complete the body: read it with `gh pr view <n> --json body --jq .body`, then write it back with
   `gh pr edit <n> --body-file <file>`, **Omni's lines above the skill's**: the link line, the
   merge-after line for a landing PR, the **Slices** checklist, the `## Landings` overview when there
   is one, and the **Acceptance** checklist when `acceptance.enabled` is true; then everything the
   skill wrote, unchanged; then the `omni sign footer` line, last. A later rewrite of the body
   keeps the skill's part as it is.
4. The title is the skill's. The labels, the status comment and the lifecycle below are this
   skill's, as for any PR.

## The status comment

Anyone asking "is an agent still on this?" reads `labels.inProgress` and this comment. There is one
per PR, found by its marker and rewritten in place on every pass of the loop. **Never** use
`gh pr comment --edit-last`: it rewrites whichever comment was last, not this one.

```bash
MARK="<!-- $(node .omni-loop/bin/omni.mjs config markers.prefix)-status -->"
BODY=$(mktemp)   # write the body below into it; its first line is "$MARK"
REPO=$(node .omni-loop/bin/omni.mjs config repo.slug)   # when it prints null, use {owner}/{repo}
ID=$(gh api "repos/$REPO/issues/<n>/comments" --paginate \
  --jq ".[] | select(.body | contains(\"$MARK\")) | .id" | head -n 1)
if [ -n "$ID" ]; then gh api -X PATCH "repos/$REPO/issues/comments/$ID" -F body=@"$BODY"
else gh pr comment <n> --body-file "$BODY"; fi
```

```markdown
<MARK>
**Agent status** · updated <YYYY-MM-DD HH:MM UTC>

- state: <claimed | implementing | waiting for CI (run <id>) | fixing <check> | merging slices | done | stuck>
- attempt: <k> / <limits.attempts>
- slices: <merged> / <total> merged            <!-- feature PR only -->
- human steps: <missing labels, or "none">
```

This skill does not decide whether a claim is stale. The board does: `/omni:wave` reads the slice's
`claimed-stale` state from `omni board <prd>`. Whoever picks up a stale PR takes it over and says so
in this comment.

## Claim

Claim mode takes one slice of a PRD, given its plan id and title. It does not loop.

1. Cut the slice branch (`branches.slice`, with `{topic}` and `{slice}` filled) from the feature
   branch (`branches.feature`): `git fetch <remote> && git switch -c <slice branch> <remote>/<feature branch>`.
2. Make one empty claim commit, `git commit --allow-empty -m "chore(<slice>): claim"`, its message
   ending with the co-author trailer your session requires, then the `omni sign trailer` line
   (**Signing**). Then run `git push -u <remote> <slice branch>`.
3. Open the draft sub-PR: `gh pr create --draft --base <feature branch> --head <slice branch>
   --title "<slice>: <title>" --body-file <file>`. Its body starts with `prLinks.sub` filled (the
   sub-PR shape above) and ends with the `omni sign footer` line.
   Its labels are `labels.sub` and `labels.inProgress`, subject to **Labels**.
4. Post the status comment with state `claimed`. Stop.

## The lifecycle

Before opening or picking up a PR, read what this repository asks of one:
`node .omni-loop/bin/omni.mjs kb show verification` (what must be green before a push),
`node .omni-loop/bin/omni.mjs kb show pull-requests` (its title, body, labels and reviewers) and
`node .omni-loop/bin/omni.mjs kb show definition-of-done` (when it is done). They add to the
preflight, **Labels** and **The body** above.

**A sub-PR leaves here first.** No CI runs on a sub-PR, so it never enters the check loop, and "no
checks reported" tells you nothing about it. Go to **A sub-PR's lifecycle**.

For a feature or standalone PR, open it as a draft (through `pr.openWith` when it is set, as
**Opening through the repository's skill** says) with its kind label and `labels.inProgress` (both
subject to **Labels**), and post the status comment. Read `node .omni-loop/bin/omni.mjs kb show ci`
once: which checks exist and which gate a merge, the known reds, and when a re-run is allowed. Then
loop until it stops:

```bash
gh pr view <n> --json isDraft,mergeable,mergeStateStatus,baseRefName
```

**Which checks count.** If `ci.branchProtection` is `true`: `gh pr checks <n> --required`. Otherwise
read `gh pr checks <n> --json name,state,bucket` and take the checks named `ci.aggregateCheck` and
`ci.outboxContext`; when `ci.aggregateCheck` is null, every reported check except `ci.outboxContext`
stands in for it. The `ci.outboxContext` check is posted by the **omni-loop** GitHub App, never by a
workflow; when the app is not installed, that check is simply absent.

| What you see | What you do |
|---|---|
| `mergeable: CONFLICTING` | `git fetch <remote> && git merge <remote>/<base>`, resolve, run the preflight, push. Not an attempt. |
| `mergeable: UNKNOWN` | GitHub is still computing. Look again in a minute. |
| `mergeStateStatus: BEHIND` only | Leave it. A person decides when a PR into the default branch is updated. |
| checks pending | Watch in the background (below), then loop. |
| a counted check red, other than `ci.outboxContext` | Fix it (below). |
| only `ci.outboxContext` red | Not a failure to fix: run `node .omni-loop/bin/omni.mjs status <prd>`. Red only for items a person must answer is the gate doing its job; say so in the status comment and stop. Anything else, fix it through the outbox, never by adding `labels.outboxGo`. |
| every counted check green and `mergeable: MERGEABLE` | Done. A standalone PR gets `gh pr ready <n>` if it is still a draft. A feature PR stays in draft (see **Merging and ready**). `gh pr edit <n> --remove-label "<labels.inProgress>"`, final status comment. Stop. |

**Watch in the background.** A foreground command is killed after at most 10 minutes. Run the watch
with Bash `run_in_background: true` and act when it wakes you:

```bash
gh pr checks <n> --watch --fail-fast --interval 60     # add --required when ci.branchProtection is true
```

A conflicting PR runs no checks at all: the watch exits at once with "no checks reported". Read
`mergeable` then; an empty check list is a conflict, never "CI is down".

**On red**, triage then fix:

1. Read the failing job: `gh run view <run-id> --log-failed`.
2. Decide whether the branch caused it: does the failure point at a file in
   `git diff --name-only $(git merge-base <remote>/<base> HEAD)..HEAD`? A failure matching a known
   red in the `ci` form, where the branch changes nothing that red names, is not the branch's.
3. Re-run only when the `ci` form's **When to re-run** allows it: one
   `gh run rerun <run-id> --failed` per PR at most, counted as an attempt.
4. Otherwise fix the cause, run the preflight, push, bump the attempt in the status comment, and loop.

**Stuck after `limits.attempts` failed attempts:** `gh pr ready <n> --undo` (a standalone PR that is no longer a draft),
`gh pr edit <n> --add-label "<labels.needsFix>" --remove-label "<labels.inProgress>"` (subject to
**Labels**), set the status comment's state to `stuck`, and post a new comment:

```markdown
## Stuck after <limits.attempts> attempts

**Red check:** <check name> — <one-line failure>
**Tried:** 1. … 2. … 3. …
**I believe:** <what is wrong, one paragraph>
**A person should look at:** <file or check>, because <reason>
```

### A sub-PR's lifecycle

No CI runs on a sub-PR, and its checks are never read. The preflight, run on this machine, grades it.

1. Run the preflight on the slice branch. If it is red, fix the cause, push, bump the attempt in the
   status comment, and run it again. After `limits.attempts` failures, take the **Stuck** path above,
   with the preflight step as the red check.
2. Check `gh pr view <n> --json mergeable`. When the PR conflicts with its feature branch, run
   `git fetch <remote> && git merge <remote>/<feature branch>`, resolve the conflict, and go back to step 1.
3. Once the preflight is green and the PR does not conflict, run `gh pr ready <n>` (this skill owns
   that step for a sub-PR). Then remove `labels.inProgress` and write the final status comment. The
   orchestrator merges it.
