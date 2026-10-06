---
prd: 1118
title: Mega PR care and mega bug fix — across a plan repository's targets
blocked-by: none
spec: file
---

# Mega PR care and mega bug fix

**Date:** 2026-10-06 · **PRD:** #1118
**Touches:**
- `kit/plugin/skills/mega-pr-care/SKILL.md` (new), `kit/plugin/skills/mega-bug-fix/SKILL.md` (new),
  `kit/plugin/skills/ultra-yolo/SKILL.md` (one hand-off line)
- `kit/lib/care/` (`state.ts`, `decide.ts`, `chain.ts`, and a new `list.ts`), `kit/bin/commands/care.ts`
- `kit/lib/bug/`, `kit/bin/commands/bug.ts`
- `kit/lib/help/` (two help entries), `docs/guide/several-repositories.md`,
  `docs/guide/diagrams/skills-repositories.svg`

## Problem

A plan repository builds one PRD across several target repositories, and `/omni:ultra-yolo` ends with
one target PR per target plus the plan PR. From there, nobody looks after them. `/omni:pr-care` looks
after one feature PR in one repository. Run in a plan repository it would watch the plan PR alone, and
it would get every target PR wrong in three ways:

- it would take the plan repository's default branch and landing chain for the target's own;
- it would freeze every target while a wave builds in any one of them;
- it would spend fix attempts on a front-end PR that is red only because the back-end PR it needs is
  not merged yet.

A bug has the same gap. `/omni:bug-fix` fixes a bug in the repository it runs in. In a plan
repository, the bug lives in a target, often in two at once: the front-end shows it, and the cause is
in the back-end. Today a person clones the targets, finds which one owns the cause, and runs
`/omni:bug-fix` in each by hand. Nothing links the two fixes or says which to merge first.

## Solution

Two commands for a plan repository (a config with a `plan` section). Each follows its one-repository
skill **step for step**, the way `/omni:ultra-yolo` follows `/omni:yolo`: each step either says "as
`/omni:pr-care` step N" (or `/omni:bug-fix`) and adds only what differs, or is new. Both keep
`/omni:ultra-yolo`'s rule for targets: in a target, the only command ever run beyond `git` and `gh`
is that target's own committed preflight, read from its `.omni-loop/config.yml` on its default
branch. No install, no script, and never a command from an imported copy's playbook. A target
without a preflight runs nothing locally, and its CI is the check.

Both refuse to run in a repository without a `plan` section, each with one line naming its
one-repository skill: `not a plan repository: /omni:pr-care <n>` and
`not a plan repository: /omni:bug-fix`.

### `/omni:mega-pr-care <n>`

A person runs it in the plan repository and leaves it running, alongside or after
`/omni:ultra-yolo`. One run looks after **every pull request of PRD n**:

- the **plan PR** (the PRD's feature PR in the plan repository);
- every **target PR**, and every **target landing PR** for a plan of several landings;
- every **bug-fix PR linked to PRD n**: the target fix PRs and the record PR of each
  `/omni:mega-bug-fix` run with `--prd <n>`.

`omni care list <n>` names them, in **merge order**: target PRs first, in the order
`/omni:ultra-yolo` step 5 gives them, then linked bug-fix PRs in each fix plan's order, the plan PR
last. Each entry carries its repository, number, kind (`plan`, `target`, `landing`, `bug-fix`,
`bug-record`) and the target's name. The run ends when every PR on the list is merged or closed, or
when the person stops it.

**A round** runs when a CI run on any PR of the list finishes, and otherwise every 5 minutes. It reads
`omni care list <n>`, then, for each PR in merge order, `omni care state <n> --repo <slug> --pr <pr>`,
and carries out that PR's `round` exactly as `/omni:pr-care` step 2 does: restack, merge the base on a
conflict, fix red CI within `limits.attempts`, judge each review thread against the `review` form,
mark asked, rewrite the status comment. What differs:

- **A target PR's base, landings and claims are the target's own.** `omni care state --repo <slug>`
  takes the target's default branch from GitHub, its landing chain from
  `omni plan landings <n> --repo <name>`, and counts wave claims only among the slices whose `repo` is
  that target. A wave building in the back-end holds the back-end's PRs alone; the front-end's go on.
- **Waits on another repository.** When a PR's CI is red and the failing job's log shows the cause is
  a change in another PR of the list that is still open (the front-end calls a field the back-end PR
  adds), the round fixes nothing. It writes `waits on <slug>#<pr>` in that PR's status comment. While
  the named PR is open, `omni care state` lists no `fix-ci` for it and its round line says
  `waits on <slug>#<pr>`. No attempt is spent. Once the named PR merges, the next round re-runs the
  failed checks once and drops the line; still red, `fix-ci` comes back.
- **The rubric is the target's own.** A target PR's review threads are judged against that target's
  own committed `review` form, read in its clone,
  `(cd <clone> && node <plan root>/.omni-loop/bin/omni.mjs kb show review)`, as `/omni:ultra-wave`
  reads a target's flow. A target without one is judged against the kit default. Never the imported
  copy.
- **A cross-repository fix.** A review comment whose fix belongs in another PR of the list may be
  fixed there, only when that PR is still open and the change stays inside PRD n's slices for that
  target (or inside the bug's fix plan, for a bug-fix PR). One commit in that repository. The reply
  on the thread is `Fixed in <slug>@<sha>: <one line>`, verdict `fixed`. Otherwise the thread is
  `asked`, naming the repository the fix belongs in.
- **The plan PR's target table.** Each round rewrites the plan PR body's **Target pull requests, in
  merge order** section from the list, `<slug>#<n> — <state>, CI <green | red | running | waits on
  <slug>#<pr>>`, keeping everything else in the body.
- **The care line, on every PR.** Each PR's status comment carries `/omni:pr-care`'s line,
  `PR care: watching since <ISO 8601> · last round <ISO 8601>`. The PRD page reads it from the plan
  PR, as it does today.

It never merges, never marks a PR ready or back to draft, never adds `labels.outboxGo`, and never
creates a label in a target.

### `/omni:mega-bug-fix`

A person runs it in the plan repository, with a description, or a bug issue of the plan repository
(`<n>`, `#<n>` or its URL), and optionally `--prd <prd>`. It follows `/omni:bug-fix`:

1. **Issue** in the plan repository, labelled `labels.bug`, as `/omni:bug-fix` step 1. With
   `--prd <prd>`, the body carries the line `For PRD #<prd>`.
2. **Classify** and **triage**, as `/omni:bug-fix` steps 2–3, in the plan repository (the risk asked
   of Jev included). The triage comment adds one line, `- **Repositories:** <name>, <name>`.
3. **Locate.** Read the targets from their clones at `<worktrees>/targets/<name>` (cloned or fetched
   as `/omni:ultra-yolo` step 2 item 1 does), read only, to find where the cause is and which targets
   must change.
4. **The fix plan.** One comment on the issue, found by its marker `<!-- omni-bug:fix-plan -->` and
   edited in place: one row per target that changes, in order, each with what changes there and its
   PR once open. The order is the provider first, then its consumers: the repository that serves the
   contract before the one that calls it, back-end towards front-end.
5. **The boundary,** as `/omni:bug-fix` step 4, read in each target (its own `risk.storedShape` and
   `risk.sharedContract`, when its config has them), with one difference: a fix may touch the
   contract between two targets **only when the provider's change keeps the consumer working as it
   is on its default branch today** (an added field, a restored one). A change that would break the
   consumer as it is, a stored shape, a new screen, route or API, or a behaviour not already settled
   stops the skill with the `/omni:mega-brainstorm <the issue's line>` line.
6. **Each target, in the plan's order,** in a worktree of its clone on `branches.fix` with
   `{topic}` = `<n>-<slug>`, cut from the target's own default branch, `/omni:bug-fix` steps 6–9:
   words first, prove red, fix, guard. What differs:
   - **Prove red** with the target's preflight when it has one: the reproduction committed alone, the
     preflight fails on it, and that failing line is the red. **Without a preflight,** push the
     reproduction alone, open the draft PR (below), and the red is the failing CI run's link. A
     preflight or CI run that passes on the reproduction alone is `/omni:bug-fix`'s stop rule 3.
   - **Mutation:** `Mutation: not run in a target`.
   - **The PR,** through `/omni:pr --repo <slug>`, a standalone PR into the target's default branch.
     Its body starts with `Part of <plan slug>#<n>`, never a closing keyword, so it never closes the
     plan repository's issue. A consumer's PR adds `Merge after <slug>#<pr>`, one line per PR before
     it. The `## Bug` section is `/omni:bug-fix`'s, plus a `Fix plan:` line linking the issue's
     fix-plan comment. `labels.bug` is added only when the target has it.
   - Its PR goes into the fix plan's row.
7. **The record** in the plan repository: `<paths.delivery>/bugs/<nnnn>-<slug>/bug.md`, as
   `/omni:bug-fix` step 11 writes it, with one more section, `## Fixes`: a table
   `| order | repository | pull request | what changes |`, one row per target, in the plan's order,
   and the Reproduction, Guard and Mutation sections give one line per target. It is committed on a
   fix branch of the plan repository, proven with `omni bug <n>`, pushed, sent with
   `/omni:dossier-push <n> --kind bug`, and opened as the **record PR** through `/omni:pr`:
   `Closes #<n>`, and `Merge after` every target PR. The record PR is the only one that closes the
   issue, and it merges last.
8. **Hand off:** the issue, the fix plan, each PR in merge order, the record PR, the fix's page, and
   what was proven and what was not. With `--prd`, it says that `/omni:mega-pr-care <prd>` now looks
   after these PRs too.

A target that cannot be cloned or pushed to stops the whole fix: a bug half-fixed across repositories
is worse than none. The comment on the issue names the target and the reason, and nothing is pushed
to any other target. Every other stop rule is `/omni:bug-fix`'s, said once for the whole fix.

### The kit

- **`omni care state <n> --repo <slug> --pr <pr>`** reads a target PR right: the target's default
  branch, its landing chain (`omni plan landings <n> --repo <name>`), wave claims among that
  target's slices only, and the `waits on` line of its status comment. The pure decision lists no
  `fix-ci` while the PR waits on an open PR, and lists one `rerun` once that PR has merged. Run in a
  repository without a `plan` section, it behaves exactly as today.
- **`omni care list <n> [--json]`**, new, run in a plan repository: the PRs a mega care run looks
  after, in merge order, as above. It reads the board, `plan landings`, and the plan repository's
  open and closed issues labelled `labels.bug` whose body carries `For PRD #<n>`, then each one's
  fix-plan comment. A repository that cannot be read is listed `unreadable`, never a failure. Run in
  a repository without a `plan` section, it exits 2 with one line.
- **`omni bug <n>`** checks a record with a `## Fixes` section: each row names a `plan.targets`
  repository and a PR there, orders run 1..k with no gap, Reproduction and Guard give one line per
  row, and the branch's check that it changes the reproduction is skipped (the reproduction lives in
  the target). A record without `## Fixes` is checked exactly as today.
- **Help and docs.** `/omni:help` lists both commands, in the multi-repository group, with an
  example each. The several-repositories guide and its skills diagram add them, and
  `/omni:ultra-yolo`'s green hand-off ends with the `/omni:mega-pr-care <n>` line, as `/omni:yolo`'s
  ends with `/omni:pr-care <n>`.

## Decisions

- **Both commands in one PRD.** They are independent, and the person asked for them together. The
  plan builds them as separate slices, side by side.
- **One run per PRD, bug fixes included.** A run looks after the PRD's plan PR, its target PRs and the
  bug-fix PRs linked with `--prd`, not an arbitrary list of PRs, so the PRD page's watcher line keeps
  meaning one thing.
- **The voice objected.** F-E Developer (`persona:F-E Developer`): "If a reviewer comments on the
  back-end PR and the bot quietly pushes a change into my front-end PR to follow it, I get code in my
  repo I never asked for — exactly the slop I'm afraid of." Proposed: fix a comment only in its own PR.
  The person chose cross-repository fixes instead, bounded: the other PR still open, the change inside
  the PRD's slices or the bug's fix plan, and the reply naming `<slug>@<sha>`. Settled: `none`.
- **Waits-on is judged, then held by the kit.** Only reading the failing log tells that a red comes
  from another repository's unmerged PR; the skill judges it once and writes it in the status comment,
  and the kit's pure decision holds it from then on. No attempt is spent on a red the branch did not
  cause.
- **The bug lives in the plan repository; its fixes in the targets.** The issue, the triage, the fix
  plan and the record are in the plan repository, where the kit is installed and the Omni page reads
  them, so a target needs no kit. Target PRs say `Part of`, never `Closes`: only the record PR closes
  the issue, merged last.
- **Back-end towards front-end, and only compatible contract changes.** As a developer would: the
  provider is fixed and merged first, and its change must keep today's consumer working, so the merge
  order is safe whatever the timing. A breaking contract change is a feature, for
  `/omni:mega-brainstorm`.
- **Red is proven in the target or on its CI,** never by running anything the target did not commit.
- **All or nothing across targets.** A target that cannot be reached stops the whole fix.
- **The PRD page is unchanged.** It reads the plan PR's care line, which a mega run keeps current;
  showing a watcher line per target PR is out of scope.
- **No proof video.** These are terminal skills; the person said no.

## User stories

1. As a PM, after `/omni:ultra-yolo`, I run `/omni:mega-pr-care 1200` once, and the plan PR and every
   target PR stay conflict-free, green and review-handled while I do other things.
2. As a front-end developer, my PR shows `waits on vertuo-backend-php#41` instead of a pile of failed
   fix attempts, and it goes green by itself once the back-end PR merges.
3. As a back-end developer, a wave building in the front-end never stops care from handling the
   review comments on my PR.
4. As a tech lead, review comments on my repository's PR are judged against my repository's own
   `review` form, not the plan repository's.
5. As a PM, I report "the total is wrong on the invoice screen" once, in the plan repository, and get
   one issue, one fix plan, one PR in the back-end and one in the front-end, linked and in merge
   order, and one record that closes the bug.
6. As a reviewer of a fix PR, I see in its body which PR to merge first, and the red proven before the
   fix.
7. As a PM, a bug fixed for my PRD with `--prd` is looked after by the same mega care run.

## Scope

In: the two skills; `omni care state` reading a target PR (default branch, landings, claims, waits on);
`omni care list`; `omni bug` reading a multi-target record; the two help entries; the
several-repositories guide and its diagram; `/omni:ultra-yolo`'s hand-off line.

Out: a mega visual fix; a mega prove; any change to `/omni:pr-care` or `/omni:bug-fix` themselves;
the PRD page (a watcher line per target PR); a cloud runner; a contract change that breaks a consumer;
running anything in a target beyond its committed preflight; creating a label in a target.

## Test seams

- `kit/lib/care/decide.test.ts`: a PR waiting on an open PR lists no `fix-ci` and spends no attempt;
  once that PR has merged it lists one `rerun`; a target whose own slices hold no claim is `act` while
  another target's wave runs; everything a one-repository state decides is unchanged.
- `kit/lib/care/state.test.ts`: the `waits on <slug>#<pr>` line is read from the status comment, and a
  status comment without it reads as not waiting.
- `kit/lib/care/chain.test.ts`: a target's chain restacks onto the target's default branch, never the
  plan repository's.
- `kit/lib/care/list.test.ts`: the merge order (target PRs by earliest wave then `## Repositories`,
  landings in their order, linked bug fixes in fix-plan order, the plan PR last), and an unreadable
  repository listed, not thrown.
- `kit/bin/care.test.ts`: `omni care state --repo` and `omni care list` through `main()` on a fixture
  plan repository and a stubbed GitHub; `care list` outside a plan repository exits 2.
- `kit/bin/bug.test.ts`: a record with `## Fixes` passes with good rows and fails, one line each, on a
  repository not in `plan.targets`, a missing PR, a gap in the order, a missing per-target line; a
  record without it is checked as today.
- `kit/lib/help/entries.test.ts` and `kit/test/plugin.test.ts`: both skills are listed and their
  `SKILL.md` front matter reads.

No test calls GitHub: everything runs on fixtures and a stubbed `gh`, as the testing form requires.

## Risks

- **What merging publishes:** the kit — two skills in the plugin and the changed `omni care` and
  `omni bug` verbs in `kit/dist/omni.mjs` — to every repository on its next `omni update`. No
  database change, no app deploy.
- **A wrong waits-on** would hold a PR the branch could fix. It lasts only while the named PR is open,
  is written where a person reads it, and is re-checked by a rerun once that PR merges.
- **A cross-repository fix** puts a commit in another repository's PR. It is bounded to an open PR
  and to the PRD's slices or the bug's fix plan, and its reply names the commit; the reviewer keeps
  the last word, as in `/omni:pr-care`.
- **A fix plan in the wrong order** could merge a consumer before its provider. Each consumer's PR
  states `Merge after`, the provider's change must keep today's consumer working, and a person merges
  every PR.
- **One-repository behaviour must not move:** `omni care state` and `omni bug` without a plan section
  are pinned by their existing tests.
- **Rollback:** revert the feature PR; the skills disappear on the next `omni update`. Replies,
  comments and PRs already posted stay on GitHub as ordinary ones.

## Acceptance criteria

- `/omni:mega-pr-care` and `/omni:mega-bug-fix`, run in a repository without a `plan` section, stop with
  one line naming `/omni:pr-care <n>` or `/omni:bug-fix`.
- `omni care list <n>` in a plan repository lists the plan PR, every target and landing PR and every
  linked bug-fix and record PR, in merge order with the plan PR last, and lists an unreadable
  repository as `unreadable`.
- `omni care state <n> --repo <target slug> --pr <pr>` restacks a target landing onto the target's
  default branch, and is `act` while a wave holds claims only in another target.
- Given a target PR whose status comment says `waits on <slug>#<pr>` with that PR open, its round lists
  no `fix-ci` and the attempt count does not move; once that PR merges, the round lists one `rerun`.
- A mega care round judges a target PR's review thread against that target's own `review` form, and
  rewrites the plan PR's **Target pull requests, in merge order** section from the list.
- A review comment fixed in another PR of the list is replied `Fixed in <slug>@<sha>` with the `fixed`
  marker, only when that PR is open and the change is inside the PRD's slices or the bug's fix plan;
  otherwise it is `asked`, naming the repository.
- `/omni:mega-bug-fix '<line>'` opens the bug issue in the plan repository with its triage (a
  **Repositories** line) and a fix-plan comment ordering the provider before its consumer.
- Each target fix PR starts with `Part of <plan slug>#<n>`, a consumer's adds `Merge after
  <slug>#<pr>`, and the red is a failing preflight line or a failing CI run's link, seen before the fix.
- A fix that would break the consumer as it is on its default branch stops with the
  `/omni:mega-brainstorm` line, and nothing is pushed.
- `omni bug <n>` passes a record whose `## Fixes` rows each name a `plan.targets` repository and its PR
  in order 1..k, and fails, naming the row, otherwise; a record without `## Fixes` is checked as today.
- The record PR closes the bug issue and states `Merge after` each target PR.
- With `--prd <prd>`, the bug's PRs appear in `omni care list <prd>`.
- `/omni:help` lists both commands, and `/omni:ultra-yolo`'s green hand-off ends with
  `/omni:mega-pr-care <n>`.
