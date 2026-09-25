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

There are two modes. **Claim** opens a slice's draft sub-PR before the slice is built, then stops.
`/omni:do-work` (run alone) and `/omni:wave` ask for it. **Lifecycle** is the default: it opens or
picks up a PR and watches it until it is done or stuck.

## Three kinds

| Kind | Base | Label | Link line | Graded by |
|---|---|---|---|---|
| **Feature PR**: the one PR a PRD sends to the default branch | `repo.defaultBranch` | `labels.feature` | `prLinks.feature` | CI, once it leaves draft |
| **Sub-PR**: one slice, on `branches.slice` | the feature branch (`branches.feature`) | `labels.sub` | `prLinks.sub` | the preflight (below) |
| **Standalone PR**: a fix or anything with no PRD | `repo.defaultBranch` | none | `Closes #<issue>` when there is one | CI |

In a link line, `{prd}` is the PRD's issue number. Every PR an agent owns also carries
`labels.inProgress` until the agent stops. A phase-0 PR is opened by `/omni:brainstorm`; it follows
this lifecycle with `labels.phase0` and `prLinks.phase0`.

**The preflight** is `commands.preflightFull`, or `commands.preflight` when that is null. If both are
null, say so in the body's **Verified** line and in the status comment.

## Labels

Before adding a label, check it exists: `gh label list --search "<name>" --json name`.

- `labels.autoCreate` is `true`: create a missing label with `gh label create "<name>" --description "<what it marks>"`.
- `labels.autoCreate` is `false`: never create one. Open the PR without it, and report
  "create label `<name>`" as a human step in the status comment and in your reply.

Never add `labels.outboxGo`; it is a person's override.

## Merging and ready

- **Never merge a PR whose base is `repo.defaultBranch`.** A feature PR or standalone PR is merged by
  a person.
- **Never mark a feature PR ready.** `/omni:yolo` does that, after `omni ship` has run on the feature
  branch. This skill leaves a feature PR in draft, however green it is.
- `/omni:pr` owns `gh pr ready` for a sub-PR, and runs it only once the preflight is green.
- A **sub-PR** is merged into its feature branch by the orchestrator (`/omni:wave`), one at a time:
  check `baseRefName` is not the default branch, then `gh pr merge <n> --squash --delete-branch`. A
  subagent never merges its own sub-PR.

## The body

If `.github/PULL_REQUEST_TEMPLATE.md` exists, a feature or standalone PR fills it with concrete
evidence, below the lines this skill adds. Otherwise use the shapes below as the whole body. Titles
are Conventional Commits for all three kinds.

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
of the summary).

**Sub-PR**, short, because the feature PR carries the review:

```markdown
<prLinks.sub, filled> · slice <id> of <n> · into `<feature branch>`

<What this slice makes true, in one or two sentences.>

**Verified:** `<the preflight>`: <green, and any step skipped with its reason>
**Decisions:** <the outbox items this slice raised, or "none">
```

**Standalone PR**: the template, or Summary / Verified / Risk and rollback / Reviewer focus, ending
with `Closes #<issue>` when there is one.

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
2. Make one empty claim commit, ending with the co-author trailer your session requires:
   `git commit --allow-empty -m "chore(<slice>): claim"`. Then run `git push -u <remote> <slice branch>`.
3. Open the draft sub-PR: `gh pr create --draft --base <feature branch> --head <slice branch>
   --title "<slice>: <title>"`. Its body starts with `prLinks.sub` filled (the sub-PR shape above).
   Its labels are `labels.sub` and `labels.inProgress`, subject to **Labels**.
4. Post the status comment with state `claimed`. Stop.

## The lifecycle

**A sub-PR leaves here first.** No CI runs on a sub-PR, so it never enters the check loop, and "no
checks reported" tells you nothing about it. Go to **A sub-PR's lifecycle**.

For a feature or standalone PR, open it as a draft with its kind label and `labels.inProgress` (both
subject to **Labels**), and post the status comment. Then loop until it stops:

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
   `git diff --name-only $(git merge-base <remote>/<base> HEAD)..HEAD`?
3. If it plainly did not (a runner, network or timeout failure, in code the branch did not touch),
   one `gh run rerun <run-id> --failed` is allowed per PR, counted as an attempt.
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
