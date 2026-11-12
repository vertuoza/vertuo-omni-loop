---
prd: 2741
title: Prove a bug fix at the head that merges
blocked-by: none
spec: file
phase0: server
---

**Date:** 2026-11-12 · **PRD:** #2741 · **After:** PRD 556 (`omni bug`), PRD 1118 (the `## Fixes`
record), PRD 2100 (the proof in the fix PR's body), PRD 2578 (the proof ladder, the product variant)
· **Touches:** `kit/lib/bug/proof-body.ts`, `kit/lib/bug/verdict.ts`, `kit/lib/bug/fixes.ts`,
`kit/lib/bug/product.ts`, `kit/bin/commands/bug.ts`, the skills `bug-fix`, `mega-bug-fix` and
`pr-care`, `docs/guide/`.

## Problem

A bug fix's pull request carries its proof (PRD 2100): a GIF, the failing line before the fix, and
the passing line after it, which names the commit it ran on:

```markdown
- **After the fix** (green, `abc1234`): `✓ export retries stop after 3 attempts`
```

`omni bug <n>` checks that the line is there, never which commit it names. So the proof a person
reads can belong to code that is not the code they merge:

1. **The proof cites an earlier commit's green.** The fix branch moved on after the reproduction ran
   (one more fix commit, a rebase), and the body still cites the older commit.
2. **The proof describes code a review commit removed.** `/omni:pr-care` pushes a fix for a review
   thread after the PR was proven and marked ready; nothing runs `omni bug` again, so the proof is
   of code that no longer exists.

**The evidence.** The kit-gaps review (Nov 2026), item 2: in 9 of 18 bug fixes of a plan repository
built with the kit, the proof cited an earlier commit's green, or described code a review commit
then removed. Cases are cited by the review's item number only (Decisions).

## Solution

A proof is only good at the head that merges. `omni bug` reads the fix pull request's head and
refuses a proof whose cited green commit is any other commit, and `/omni:pr-care` proves again after
every push it makes to a bug-fix pull request.

### `omni bug <n>`

- When the body's `## Proof` holds a produced proof, its **After the fix** line must cite a commit:
  `(green, `<sha>`)`, 7 to 40 hex characters. A produced proof whose After line cites none is one
  more fault: `## Proof's "After the fix" line cites no commit: write (green, <short sha>) of the head`.
- **The head.** Read from the open pull request of the current branch, `gh pr view --json
  body,isDraft,state,number,headRefOid,commits`. With `--body-file` and no open pull request yet,
  the head is the local `git rev-parse HEAD`.
- **The rule.** The cited sha must be a prefix of the head's full sha. Anything else is refused, one
  line:
  `the proof cites green at abc1234, but #<pr>'s head is def5678 (2 commits later): run the reproduction again at the head and rewrite the After line`.
  When the cited sha is not a commit of the pull request at all, the line says `abc1234 is not a
  commit of #<pr>` in place of the count.
- **Exactly the head.** No commit may follow the cited one, not even one that changes only the bug's
  own record folder (Decisions).
- A proof that was not produced (`GIF not produced - A: …; B: …; C: …`) cites no green commit, and
  this check leaves it alone: it already keeps the pull request a draft (PRD 2100).

### A record with `## Fixes`, and a product bug

- **`## Fixes` (PRD 1118).** The record PR carries the one proof, and the code is in the rows' pull
  requests. `omni bug <n>` reads each row's pull request head (`gh pr view <n> --repo <slug> --json
  headRefOid,commits`) and the cited sha must be the head of one of them. Matching none, it is
  refused, naming every row's head:
  `the proof cites green at abc1234, the head of no Fixes row: demo-org/api#41 is at 1a2b3c4, demo-org/web#88 at 5d6e7f8`.
- **A product bug (PRD 2578).** `omni bug check --product <key> <file> --body-file <body>` gains
  `--pr <owner/repo>#<n>`, the fix pull request whose body was given, and grades the cited sha
  against that pull request's head. With `--body-file` and no `--pr`, it is a usage error, exit 2:
  `omni bug check: --body-file needs --pr <owner/repo>#<n>, the fix pull request it belongs to`.
- `gh` that cannot read a head (no sign-in, no such pull request) is one fault that says so and
  never a pass (BL-GATE-1):
  `not judged: could not read the head of <owner/repo>#<n>: <why>`, then what to run.

### `/omni:pr-care` after a push

After every push it makes to a bug-fix pull request (a branch matching `branches.fix`, or a body
with `## Proof` and `## Bug`), pr-care runs `omni bug <n>` again. When the only fault is the cited
green:

1. it runs the reproduction (the record's **File:**) at the new head, and on green rewrites the
   After line with the new short sha and the new passing line, then puts the body back with
   `gh pr edit --body-file`, and runs `omni bug <n>` once more;
2. when the reproduction is red, or `omni bug` still refuses, it puts the pull request back to draft
   (`gh pr ready <pr> --undo`) and says why in its status comment.

The GIF is not filmed again: the After line is the claim this PRD binds to the head. `/omni:bug-fix`
and `/omni:mega-bug-fix` already take the proof after their last commit (their step 12); they gain
one sentence saying that the After line cites the head at the moment the body is checked.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | cli | `--pr <owner/repo>#<n>` on `omni bug check` | no written convention: follows `REFERENCE` ← kit/lib/bug/fixes.ts:24 (`acme/backend#41`) |
| vertuo-omni-loop | cli | `headRefOid`, `commits` in the `gh pr view` read | `openPullRequest` ← kit/lib/bug/proof-body.ts (the existing `--json` field list) |
| vertuo-omni-loop | cli | the After line `(green, `<sha>`)` | the body template ← kit/plugin/skills/bug-fix/SKILL.md:729 |

## Decisions

- **Rules check (2026-11-12, after the person flagged PRD 2739).** Words use the glossary's terms;
  a head `gh` cannot read says `not judged: …` (BL-GATE-1); no new decision is taken by an agent
  alone (never#2): re-proving and putting the pull request back to draft follow the person's
  answer and the rule written here, so no outbox item is added.
- **Exactly the head.** The person chose that the cited green commit is the head itself, with no
  exception for later commits that change only the bug's record folder. Any later commit means
  running the reproduction again.
- **pr-care re-proves; no CI template.** The person chose that pr-care runs `omni bug` after each push
  it makes to a bug-fix pull request, which catches the agent's own review fixes, the cases seen. A
  workflow template that runs it on every push is out of scope.
- **The GIF is not filmed again after a review push.** The After line, with its sha and passing line,
  is what this PRD binds to the head; refilming is left to the bug-fix skill's own proof ladder.
- **No config key and no hook point.** The rule is the same in every repository; nothing here is
  something a target would want to change.
- **The evidence is cited by the review's item number only.** The source review is of a private
  delivery; this repository is open source, and never#11 keeps that delivery out of it. The person
  chose item numbers and anonymised shapes; the test fixtures are fictional (`demo-org`).
- **The voice.** persona:Lead Engineer objected: *"If a docs-only commit forces a full re-proof, people
  will learn to skip it."* Settled `none`: the person chose exactly the head, knowing a record-only
  commit then needs the reproduction run again; pr-care does that run, so nobody does it by hand.

## User stories

- As the person who merges a bug fix, I want the proof I read to be of the commit I merge, so a
  green proof means the merged code is green.
- As a person whose review comment an agent fixed after the proof, I want the proof taken again, so the
  fix of my comment did not quietly break the bug fix.
- As a developer running `/omni:bug-fix`, I want `omni bug` to tell me which commit to prove at, so I
  never guess.

## Scope

In: the sha check in `omni bug <n>` (the open pull request and `--body-file`); the `## Fixes` record's
check against its rows' heads; `--pr` on `omni bug check --product`; pr-care's rerun and re-proof
after a push to a bug-fix pull request; one sentence in `bug-fix` and `mega-bug-fix`; the guide.

Out: a CI workflow template; refilming the GIF; checking the **Before the fix** (red) line or keeping
the red proof (another item of the review); visual fixes (`omni visual`); any config key or hook
point.

## Test seams

Following `omni kb show testing`: unit tests on pure functions, CLI tests through the command with a
temporary repository and an injected `exec`, never a call to GitHub.

- `kit/lib/bug/proof-body.test.ts`: the cited sha parsed from the After line; a produced proof whose
  After line cites none → its fault.
- `kit/bin/bug.test.ts`: **the test that would have caught the earlier-green cases**: an open pull
  request (injected `gh pr view`) whose head is the child of the cited commit → `not ok` naming both
  shas and `1 commits later`; cited sha = head → `ok`; a sha not in the pull request → `not a commit
  of #<pr>`; `--body-file` with no pull request compares with the local `HEAD`.
- `kit/bin/bug.test.ts`: **the test that would have caught the review-commit cases**: a proof cited
  at head A, then a review commit B pushed (the injected head moves to B) → `not ok`.
- `kit/lib/bug/fixes.test.ts` (or `bug.test.ts`): a `## Fixes` record whose cited sha is the head of
  no row → `not ok` naming every row's head; the head of one row → `ok`.
- `kit/bin/bug-product.test.ts`: `bug check --product --body-file` with no `--pr` → exit 2; with
  `--pr` and a stale sha → refused.
- A skill test (`kit/plugin/` skill text tests) that pr-care's text names the rerun of `omni bug`
  after a push to a bug-fix pull request.

## Risks

Merging publishes a new kit version: every repository on it gets the stricter check. An open bug-fix
pull request whose proof cites an older commit, or no commit, is refused the next time `omni bug`
runs on it, until its After line is rewritten at the head; merged fixes are never graded again.
Rollback: revert the feature PR and release.

PRD 2739 (follow-ups) also changes `kit/lib/bug/verdict.ts`, `kit/lib/bug/product.ts` and the pr-care
skill; the two PRDs touch different checks of the same files, so whichever merges second takes the
other's lines on rebase. `blocked-by` stays `none`.

- The Legal entries: none touched.
- N-PRODUCT-14: the terminal checks always compare with the base branch. If broken, a rule quietly
  loses its test and the workspace learns it only when the server refuses the pull request. Kept:
  `omni bug`'s range stays `<base>..HEAD`; the head check is an extra fault. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-15: only a person merges into the main branch. If broken, unreviewed work reaches every
  user. Kept: pr-care only re-proves or puts the pull request back to draft; it never merges or marks
  ready on a refused proof. Changing it needs @pierrederval or @dervalp to approve the pull request on
  GitHub.
- BL-APPROVALS-1 — An approval covers exactly the files the approver read; a later change voids it. Kept, and strengthened in spirit: a proof now covers exactly the head a person merges, and a later commit voids it until it is taken again.
- BL-ASK-1 — An answer a person gave is never changed or reworded afterwards. Kept: pr-care rewrites only the agent's own After line in the pull request body, never a person's comment or answer.

## Acceptance criteria

1. `omni bug <n>` on a fix branch whose open pull request's head is one commit after the commit the
   After line cites prints `not ok` and the line naming both short shas and `1 commits later`.
2. `omni bug <n>` prints `ok` once the After line cites the head (any prefix of 7 characters or more).
3. A produced proof whose After line cites no commit is refused with its own line.
4. A proof that was not produced is graded as today: the head check adds nothing.
5. `omni bug <n> --body-file <f>` with no open pull request compares the cited sha with the local
   `HEAD`.
6. A `## Fixes` record whose cited sha is the head of none of its rows' pull requests is refused,
   naming each row's head; the head of one row passes.
7. `omni bug check --product <key> <file> --body-file <b>` without `--pr` exits 2 with its usage line;
   with `--pr <owner/repo>#<n>` it refuses a sha that is not that pull request's head.
8. A head `gh` cannot read prints `not judged: could not read the head of <owner/repo>#<n>: <why>`, a fault, never a pass.
9. `/omni:pr-care`'s text says: after each push to a bug-fix pull request, run `omni bug <n>`; on a
   stale green, run the reproduction at the head and rewrite the After line, else put the pull
   request back to draft and say why in the status comment.
