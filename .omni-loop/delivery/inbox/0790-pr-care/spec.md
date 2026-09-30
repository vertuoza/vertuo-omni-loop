---
prd: 790
title: PR care — keep the feature PR green, conflict-free and review-handled
blocked-by: none
spec: file
---

# PR care

**Date:** 2026-09-30 · **PRD:** #790
**Touches:**
- `kit/plugin/skills/pr-care/SKILL.md` (new), `kit/plugin/skills/yolo/SKILL.md` (one hand-off line)
- `kit/bin/commands/care.mjs` (new), `kit/bin/commands/index.mjs`, `kit/lib/care/` (new)
- `kit/lib/playbook/forms.mjs`, `kit/templates/playbook/review.md` (new)
- `kit/lib/help/` (the new skill's help entry)
- `apps/galaxy/src/dossier/github/` (`reader.ts`, `summary.ts`, a new `care.ts`)
- `apps/galaxy/src/dossier/page/` (`view.ts`, `StageHeader.tsx`, a new `CarePane.tsx`, `dossier.css`)

## Problem

PMs learn at the very end of a delivery that their feature PR has red CI, a merge conflict, or a pile
of review comments. Each one costs a round trip with a developer, and some of the comments are taste,
not defects, yet they block the merge all the same. `/omni:pr` already fixes red CI and conflicts, but
only while a skill that opened the PR is still running, and it never reads a review. The PRD page links
the feature PR but says nothing about its health.

## Solution

**`/omni:pr-care <n>`.** A person (PM or developer) runs it in a terminal. It looks after PRD n's
**feature PR** until it is merged or closed, or the person stops it. Only the feature PR: phase-0,
sub-PRs, retro and fix PRs are out of scope.

A **round** runs when a CI run on the feature PR finishes, and otherwise every 5 minutes. Each round
reads the PR's state with `omni care state <n>` (checks, mergeable state, unresolved review threads
with their comments, whether a wave holds claims) and does, in this order:

1. **Conflict** (`CONFLICTING`): merge `<remote>/<base>` into the feature branch, resolve, run the
   preflight, push. The steps are `/omni:pr`'s, and this does not count as an attempt.
2. **Red CI**: `/omni:pr`'s fix loop, with the same `limits.attempts`. When stuck, the PR gets
   `labels.needsFix` and `/omni:pr`'s "Stuck after N attempts" comment. The watch goes on for
   conflicts and reviews.
3. **Each unresolved review thread without a care reply** is judged against the `review` playbook
   form (below) and gets exactly one of three verdicts:
   - **fixed**: commit the change, push, reply `Fixed in <sha>: <one line>`, and resolve the thread.
   - **pushed back**: reply with a short, polite reason that names the rubric line it rests on
     ("Low value for this PR: naming preference, no linter rule. Happy to take it as a follow-up."),
     and resolve the thread. A thread resolved without a code change always carries the reason why.
   - **asked**: when the comment needs a product decision, or following it would contradict the spec,
     reply that the PM will decide, leave the thread open, and flag it on the page.

Every care reply ends with a hidden marker, `<!-- omni-care: fixed|pushed-back|asked -->`, written by
`omni care reply`. The marker is how the page and the next round know a thread was handled.

**The reviewer keeps the last word.** When a person writes in a thread after a care reply, or reopens
a thread care resolved, care does not argue again: the thread becomes **asked** and waits for the PM.

**Never during a wave.** While a wave holds claims on the feature branch (the board shows claimed
slices), a round only reads and reports, and pushes nothing.

**Liveness.** Each round rewrites `/omni:pr`'s status comment on the feature PR (found by its marker),
which gains the line `PR care: watching since <time> · last round <time>`.

**The `review` form.** A new extended playbook form, `omni kb show review`, with three slots: `fix`,
`push-back` and `ask`. A repository edits it like any form. The kit default:

- **fix**: a bug, a security problem, data loss; duplicated code; a missing or weak test; a broken
  repository convention or law; a name the reviewer shows is misleading.
- **push-back**: naming taste; style no linter enforces; "while you're here" changes outside the PR's
  scope; a rewrite to the reviewer's preferred pattern with no defect named; a question the spec
  already answers.
- **ask**: a comment that needs a product decision, or one that contradicts the spec.

**The PRD page.**
- **Health chip:** in the stage header, beside the feature PR link while it is open, a chip:
  `CI ✓ · no conflict · 2 open`, red on `CI red` or `conflict`, grey while CI runs.
- **PR care tab:** a new tab after Outbox, shown while the PRD has a feature PR. It has three rows:
  - **CI:** green, red (linking to the failed run) or running.
  - **Conflicts:** none, or conflicting with `<base>`.
  - **Review:** counts of open, fixed, pushed-back and asked threads, then one line per thread: the
    reviewer's avatar and login, the comment's first line, the verdict with Claude's reason, and a
    link to the thread on GitHub. Asked threads come first.

  Under them, the **watcher line**: `Claude is watching · last round 3 min ago` when the status
  comment's last round is under 15 minutes old, otherwise `Nobody is watching`, with `/omni:pr-care <n>`
  in a copy chip.

**Data.** The page reads everything from GitHub, live, as the App, through the existing reader, its
60 s cache and the page's once-a-minute refresh. One GraphQL read of the feature PR is added: its
check rollup, mergeable state, review threads (resolved or not, with their comments) and the status
comment. No table, migration or webhook is added.

## Decisions

- **A local watch, not a cloud runner.** The person runs `/omni:pr-care` on their own machine. It needs
  no new secrets or runners, and it stops when the terminal does, which the watcher line makes visible.
- **The feature PR only.** Sub-PRs are merged by the wave, and phase-0 and retro PRs are docs.
- **A written rubric, judged by the model.** The rubric is a playbook form, so each repository can move
  a line between fix and push-back without touching the kit.
- **Resolve both fixed and pushed-back threads, always with a reason.** Only asked threads stay open.
- **Verdicts live on GitHub as reply markers.** The page parses them, so the verdicts are stored in
  one place only and nothing drifts.
- **Pure decision core.** `kit/lib/care/` holds a pure function that turns a PR state into the next
  actions, the marker writer and reader, and the state parser. The skill only carries the actions out.

## User stories

1. As a PM, I open my PRD's page and see at a glance whether the feature PR is green, conflict-free
   and has open review threads.
2. As a PM, I run `/omni:pr-care 790` once, and review comments are handled while I do other things.
3. As a PM, I see why each review comment was fixed or pushed back, and I decide only the asked ones.
4. As a reviewer, I get a reasoned reply to every comment, and when I push again, a person decides.
5. As a tech lead, I move "naming" from push-back to fix in our repository's `review` form, and care
   follows it on the next round.
6. As a PM, when nobody is watching my PR, the page tells me and gives me the command to start.

## Scope

In: the skill, the `omni care` verb (`state`, `reply`), the `review` form and its template, the
status comment's care line, the health chip, the PR care tab, and the `/omni:yolo` hand-off line.

Out: sub-PRs, phase-0, retro and fix PRs; a cloud or GitHub Actions runner; a page button that starts
a session; new webhooks, tables or Inngest functions; notifications (the waiting bell) for asked
threads; opening follow-up issues for pushed-back comments.

## Test seams

- `kit/lib/care/decide.test.mjs`: the pure decision from a PR state. Conflict comes before red CI,
  red CI before reviews. Nothing is pushed while a wave holds claims. A handled thread is skipped. A
  person's reply after a care reply makes the thread asked. A stuck CI still leaves reviews handled.
- `kit/lib/care/marker.test.mjs`: write and read the three verdicts; a comment without a marker, or
  with an unknown verdict, reads as unhandled.
- `kit/bin/care.test.mjs`: `omni care state` on a stubbed GitHub response prints the expected JSON,
  and `omni care reply` builds a body ending with the marker.
- `kit/lib/playbook/forms.test.mjs`: `review` is a form with its three slots, and its template
  passes the playbook check.
- `apps/galaxy/src/dossier/github/care.test.ts`: parse recorded GraphQL fixtures (green, red,
  running, conflicting, threads of each verdict, a stale and a fresh status comment).
- `apps/galaxy/src/dossier/page/care-render.test.ts`: the tab's rows, the order of threads, the
  watcher line in both states, and the chip's three looks.

No test calls GitHub: everything runs on fixtures, as the testing form requires.

## Risks

- **What merging publishes:** the kit (a new skill and verb in the plugin and `kit/dist/omni.mjs`),
  and galaxy's PRD page on its next deploy. No database change.
- **An over-eager push-back** could annoy a reviewer. The reviewer keeps the last word (a second
  comment makes the thread asked), and the repository can tighten the rubric.
- **An over-eager fix** could push a bad change. Each fix runs the preflight before pushing, and it
  lands on the feature PR, which a person still reviews and merges.
- **GitHub API budget:** one GraphQL read per round and one per page refresh (cached 60 s). Rounds at
  5-minute intervals stay well inside the App's budget.
- **Rollback:** revert the feature PR. The skill disappears on the next `omni update`. The replies
  already posted stay on GitHub as ordinary comments.

## Acceptance criteria

- `omni kb show review` prints the three slots, with the kit default when the repository has none.
- Given a feature PR in conflict, a round merges the base, runs the preflight and pushes, and the next
  `omni care state` shows it mergeable.
- Given a red CI, a round runs `/omni:pr`'s fix loop, and after `limits.attempts` failures the PR carries
  `omni:needs-fix` while review threads are still handled.
- Given a thread asking to remove duplicated code, a round commits the fix, replies
  `Fixed in <sha>` with the `fixed` marker, and resolves the thread.
- Given a thread asking to rename a variable for taste, a round replies with a reason that names the
  rubric line, adds the `pushed-back` marker, and resolves the thread.
- Given a thread that needs a product decision, a round replies with the `asked` marker and leaves it
  open.
- Given a reviewer's reply after a care reply, the next round marks the thread asked and does not
  argue.
- While a wave holds claims, a round pushes nothing and posts nothing but the status comment.
- The PRD page shows the health chip beside an open feature PR, and the PR care tab shows CI,
  conflicts, each thread with its verdict and reason (asked first), and the watcher line, which says
  `Nobody is watching` with the copyable command when the last round is 15 minutes old or more.
- `/omni:yolo`'s hand-off, after the feature PR is marked ready, ends with the `/omni:pr-care <n>` line.
