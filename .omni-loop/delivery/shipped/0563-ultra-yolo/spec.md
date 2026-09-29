---
prd: 563
title: ultra-yolo — build a multi-repository PRD from the plan repository, one gate
blocked-by: none
spec: file
---

# ultra-yolo: build a multi-repository PRD from the plan repository, one gate

**Date:** 2026-09-29 · **PRD:** #563 · **Series:** multi-repository mode, part 3 of 3 (after
PRD 522 mega-invade and PRD 549 mega-brainstorm) · **Touches:** `omni board`, a new
`omni plan moved`, `omni item new --out` and a new `omni item relay`, `omni rework plan`, three new
skills (`kit/plugin/skills/ultra-yolo/`, `ultra-wave/`, `ultra-yolo-fix/`), and short paragraphs in
`/omni:do-work` (`--target`) and `/omni:pr` (`--repo`). No migration, and no change to the galaxy
app, the GitHub App or the game.

## Problem

PRD 549 lets a PM in a plan repository (`vertuoza/vertuo-automation-plan`) write one PRD whose plan
names, slice by slice, the target repository each slice lands in, reviewed in one phase-0. Nothing
builds it. `/omni:yolo` and `/omni:wave` stop on such a PRD (`PRD <n> spans repositories:
/omni:ultra-yolo <n> builds it`), because every step they take acts on the checkout they run in:
`omni board` reads sub-PRs in one repository, `/omni:do-work` writes its outbox items and runs its
preflight in that checkout, and every `gh pr` call means "this repository".

## Solution

Ultra-yolo runs once, from the plan repository. Every slice is built in its own target, through a
sub-PR into a feature branch there; each target gets one feature pull request; every decision the
agents take is relayed into the plan repository's outbox, where **one gate** decides; and the plan
repository's feature pull request, the one that closes the PRD, is marked ready last.

**1. `omni board <prd>` reads every repository.** In a plan repository, on a PRD whose plan has a
`repo` column:

- Each slice's `repo` resolves to `owner/name`: a `plan.targets` entry by its short name, or
  `repo.slug` for the plan repository itself.
- One `gh pr list --repo <slug> --base <feature branch>` per repository (with `board.matchBy:
  label`, `--label <labels.sub>` as today), and a slice matches a PR by (repository, head branch).
  The branch names are the plan repository's own `branches.feature` and `branches.slice`, filled
  with the PRD's topic, in every repository.
- Each row of `--json` gains `repo` (the short name) and `slug`. The states, the frontier, and
  `blocked by` across repositories are computed exactly as today; same-wave collisions are already
  per repository (PRD 549).
- A repository `gh` cannot read makes each of its slices `unreadable` (a new state) and holds only
  them and what they block.
- A plan without a `repo` column reads exactly as today.

**2. `omni plan moved <prd>`** (new, read-only). For each target row of the plan's
`## Repositories`, it compares `read at` with the target's default branch today (the gh reader of
PRD 522) and lists the changed files that fall under that target's slice territories:

```text
vertuo-backend-php   moved   3 files under s1's territory (src/Quote/Total.php, …)
vertuo-apps          ok
```

`ok` when nothing under the territories changed, even if the head moved; `unreachable` when `gh`
cannot read it. `--json` gives `[{ repo, state, files }]`. In a plan repository it exits `0` whatever the states: a moved target is a
decision, not an error. Outside a plan repository: `not a plan repository`, exit `1`.

**3. Items relayed into the plan repository.**

- `omni item new ... --out <dir>` writes the item into `<dir>` instead of the PRD's outbox folder,
  with the same checks, the same id and the same file name. It never adopts (`--adopt` with `--out`
  is refused).
- `omni item relay <dir> --prd <n>` checks every item and account file in `<dir>` against the
  plan repository's ledger rules, exactly as `omni item new` does, and moves them into the PRD's
  outbox folder (accounts to `accounts/`). A refused file stays in `<dir>`, named with its reason,
  exit `2`; the others move.
- `omni status`, `omni comment`, `omni answers`, `omni adopt`, `omni replies`, `omni settle` and
  `omni ship` are unchanged: every item ends up in the plan repository.

**4. `omni rework plan <prd>` names the repository.** In a plan repository, each rework carries
`repo`, the repository of the slice its item was raised on (`--json` and the plain lines), so a
rework lands in the target the decision was taken in.

**5. `/omni:do-work --target <name>` and `/omni:pr --repo <slug>`.**

- `--target <name>` builds the slice in a worktree of that target's clone. Its territory is paths
  in the target. Its items go to a scratch folder through `omni item new --out`, which its result
  JSON lists; the result gains `repo`. Its preflight is the target's own
  (`commands.preflightFull` or `commands.preflight` from the target's `.omni-loop/config.yml`);
  a target with no loop has none, and the slice's result says `preflight: "none — CI is the check"`.
  `omni check coverage` and `omni check all` run in the plan repository only.
- `--repo <slug>` makes every `gh` call of `/omni:pr` (claim, labels, status comment, lifecycle)
  act on that repository. A label missing there is never created: it becomes a human step, as
  **Labels** already says.

**6. `/omni:ultra-yolo <n>`.** A new skill, run in a plan repository; it follows `/omni:yolo`,
with these differences:

0. **Step 0.** `omni config`, with a `plan` section; `omni prd <n>` must print `repos:`, otherwise
   it stops with `PRD <n> is an ordinary PRD: /omni:yolo <n>`. The briefing and `omni kb status`,
   as yolo.
1. **The plan repository.** The draft plan feature PR (from PRD 549) gets `labels.inProgress`.
   `omni plan moved <n>`: each moved target becomes one **medium** outbox item naming the changed
   files; the build goes on, on the target's default branch today.
2. **The targets.** For each repository of `## Repositories` (the plan repository's own row
   excepted): a full clone in `<worktrees>/targets/<name>` of the plan repository (made ignored
   through `.git/info/exclude` when it is not), fetched on every run; `feat/<topic>` cut from the
   target's default branch, or reused; a **draft target feature PR** into the target's default
   branch, its body starting with `Part of <plan owner>/<plan repo>#<n>` and listing that target's
   slices. A target that cannot be cloned or pushed to holds only its own slices and what they
   block.
3. **The waves.** While the board can move, follow `/omni:ultra-wave <n>` once, as yolo loops
   `/omni:wave`, with the same stop table.
4. **Finish each target.** In its clone: merge the target's default branch into `feat/<topic>`,
   run its preflight (a target with the loop only), push, then mark the **target feature PR ready**
   and follow `/omni:pr --repo`'s lifecycle until its CI is green or it is stuck. A stuck target
   holds the plan PR in draft.
5. **One gate.** The plan PR's body lists every target PR **in merge order** (by the earliest wave
   of its slices, then `## Repositories` order), then `omni comment` and `omni status <n>`.
   - **Green, and every target PR ready with green CI:** the release note, `omni ship`, commit,
     push, and the plan PR marked ready, as yolo's green path.
   - **Red:** the plan PR stays draft with the questions posted; with `answers.enabled`, the
     "answer here" offer of yolo step 6, which carries on into `/omni:ultra-yolo-fix` in the same
     run. Re-running `/omni:ultra-yolo <n>` after answers were given on the PR does the same.
6. **Hand-off.** yolo's three blocks, with **What is next?** listing the target PRs to merge first,
   in merge order, then the plan PR last (it closes the PRD). Every merge is a person's.

**7. `/omni:ultra-wave <n>`.** One wave across repositories; it follows `/omni:wave`, with these
differences: it claims each takeable slice in its target (`/omni:pr --repo` claim: the claim commit
in the clone, the draft sub-PR into the target's `feat/<topic>`); dispatches one subagent per slice
following `/omni:do-work --in-wave --target <name>`; merges each sub-PR with `--repo` after the
territory check (paths in the target); after each merge, `omni item relay` of that slice's items
into the plan repository's outbox, on the plan feature branch; adopts the wave's mediums there and
commits once per wave; checks each touched target (its preflight, when it has the loop) in its
clone; and ticks the slices in both the target PR's body and the plan PR's.

**8. `/omni:ultra-yolo-fix <n>`.** After answers; it follows `/omni:yolo-fix`, with these
differences: replies are read and settled on the plan PR, in the plan repository; each rework of
`omni rework plan <n>` is claimed and built in its `repo` (a sub-PR into that target's
`feat/<topic>`, through `/omni:do-work --target`), its items relayed; each touched target is
checked again and its target PR's CI followed; then step 5 of ultra-yolo (the gate, ship before
ready).

It never merges into any repository's default branch, never adds `labels.outboxGo`, and never
creates a label in a target.

## Decisions

- **Three dedicated skills,** `/omni:ultra-yolo`, `/omni:ultra-wave` and `/omni:ultra-yolo-fix`,
  beside their single-repository twins: the cross-repository steps (clones, `--repo` on every call,
  relaying items, finishing each target) would make the shared skills branch everywhere. Building
  one slice in one repository is the same job, so `/omni:do-work` and `/omni:pr` stay shared, with
  `--target` and `--repo`.
- **All three in this one PRD,** so a red gate hands over to the fix in the same run, as yolo does.
- **One outbox, in the plan repository, relayed:** a slice's items are written to scratch and moved
  into the plan repository's outbox after its sub-PR merges, so `omni status` is the one gate, and
  a target without the loop needs nothing installed.
- **Code runs only from a target's own config.** A target with the loop runs its own preflight on
  the person's computer; a target without it runs nothing locally, and its feature PR's CI is the
  check. A command from an imported copy's playbook (unconfirmed) is never run.
- **The plan PR is marked ready last:** only when every target PR is ready with green CI and the
  gate is green. The target PRs merge first, in merge order; the plan PR closes the PRD.
- **A moved target is a medium item, not a stop:** files changed under its territories since
  `read at` are recorded, and the build goes on on today's default branch.
- **Branch names are the plan repository's** in every target, so the board reads every repository
  with one rule.
- **Nothing merges into a default branch,** in any repository; a person merges every feature PR.

## User stories

- As a PM, after merging the mega phase-0, I run `/omni:ultra-yolo <n>` once and get a feature PR
  in the back-end and one in the front-end, each built slice by slice.
- As a reviewer of the back-end, I open that repository's feature PR and see it is part of the plan
  repository's PRD, with its own slices ticked and its CI green.
- As the PM, I answer every question the agents raised, in any repository, in one place: the plan
  repository's feature PR or the Omni page.
- As the PM, when the back-end moved since the plan was written, I find it as a decision in the
  outbox, not as a surprise.
- As the person who merges, I am told the order: the back-end PR, then the front-end PR, then the
  plan PR that closes the PRD.
- As a reviewer who disagreed with a decision, I answer on the plan PR, and the rework lands in the
  repository that decision was taken in.

## Scope

In:

- `kit/lib/board.mjs`, `kit/bin/commands/board.mjs`: point 1.
- `kit/lib/plan-repo/`: the gh reader exported for reuse; `kit/bin/commands/plan.mjs`: `moved`.
- `kit/bin/commands/item.mjs` (`--out`, `relay`) and the outbox library it calls: point 3.
- `kit/lib/policy/rework.mjs`, `kit/bin/commands/rework.mjs`: point 4.
- `kit/plugin/skills/do-work/SKILL.md` (`--target`) and `kit/plugin/skills/pr/SKILL.md` (`--repo`).
- `kit/plugin/skills/ultra-yolo/`, `ultra-wave/`, `ultra-yolo-fix/` (new); their entries in
  `kit/lib/help/entries.mjs`.
- `docs/guide/invade.md`: its plan-repository section names `/omni:ultra-yolo`.
- `kit/dist/`: rebuilt.

Out:

- Installing the loop in a target, or writing anything in a target outside `feat/<topic>`, its
  slice branches and its pull requests.
- The omni-loop GitHub App's gate check in a target, and retro or knowledge PRs across
  repositories: the plan repository's own PRs only, as today.
- Running a command from an imported copy's playbook.
- The Omni app, its dossier pages and the game.
- Acceptance scenarios: `acceptance.enabled` is off in this repository.

## Test seams

Every test runs on fixtures; none calls GitHub or Supabase (`omni kb show testing` › Never).
Commands are tested through `main()` on a fixture repository (`makeRepo()` in
`kit/test/fixture.mjs`) with a `plan` section where the case needs one, and `gh` faked as
`kit/bin/board.test.mjs` and `kit/bin/commands/targets.test.mjs` fake it.

- **Board (unit and command):** a plan repository with two targets makes one `gh pr list --repo`
  per repository; a slice matches only a PR of its own repository; `blocked by` across repositories
  and the frontier; an unreadable repository makes its slices `unreadable`; a plan without `repo`
  reads exactly as today (every existing board test unchanged).
- **`omni plan moved` (command):** `ok` with an unmoved head, `ok` with a head that moved outside
  the territories, `moved` with the files inside, `unreachable`, `--json`, and
  `not a plan repository`.
- **Items (command):** `item new --out` writes the same file to the given folder and refuses
  `--adopt`; `item relay` moves valid items and accounts into the outbox, leaves a refused one in
  place with its reason and exits `2`.
- **Rework (unit and command):** `repo` on each rework in a plan repository, absent otherwise.
- **Skills (`kit/test/plugin.test.mjs`):** the three new skills parse, name only commands the CLI
  has, and follow the signing and footer rules (ADR-0042); the edited `/omni:do-work` and
  `/omni:pr` keep passing it.
- **Help:** `omni help ultra-yolo`, `ultra-wave` and `ultra-yolo-fix` print their entries.
- **Bundle:** `kit/dist/omni.mjs` rebuilt; `kit/test/dist.test.mjs` passes.

## Risks

- **What a merge publishes** (`omni kb show releasing`): the kit. The root package's bin and the
  plugin marketplace hand out the new verbs and the three skills on the next release (`v0.0.N`).
  Rollback: revert the merge; the next release hands out the kit without them, and a multi-repository
  PRD waits again behind the yolo and wave guards.
- **It writes in other repositories.** Ultra-yolo pushes branches and opens pull requests in each
  target, with the person's own `gh` access. It never merges into a default branch; a revert is
  closing those pull requests and deleting `feat/<topic>` and its slice branches there.
- **It runs a target's code on the person's computer,** from that target's own committed config
  only.
- **A target without the loop is built blind locally:** its CI is the only check, so a red CI
  there holds the plan PR.
- **Rate limits:** one `gh pr list` per repository per board read, and a few calls per slice;
  well under GitHub's limits for a handful of targets.
- **Proof on real repositories is owed.** Tests run on fixtures; the first live run in
  `vertuoza/vertuo-automation-plan` with two real targets follows the merge, after the live runs of
  PRD 522 and PRD 549.

## Acceptance criteria

- In a plan repository, `omni board <n> --json` lists every slice with its `repo` and `slug`, reads
  one pull-request list per repository, matches each slice only to a PR of its repository, and
  computes the frontier across repositories; a repository it cannot read makes its slices
  `unreadable`. A plan without `repo` reads exactly as today.
- `omni plan moved <n>` prints `moved` with the files for a target changed under its territories
  since `read at`, `ok` otherwise, `unreachable` when unreadable, and exits `0`.
- `omni item new --out <dir>` writes the item to `<dir>`; `omni item relay <dir> --prd <n>` moves
  every valid item and account into the plan repository's outbox and leaves a refused one in
  `<dir>` with its reason (exit `2`).
- In a plan repository, `omni rework plan <n>` names each rework's `repo`.
- `/omni:ultra-yolo <n>` on a PRD without `repos:` stops with `PRD <n> is an ordinary PRD:
  /omni:yolo <n>`.
- `/omni:ultra-yolo <n>` opens one draft feature PR per target (`Part of <plan repo>#<n>`), builds
  every slice through `/omni:ultra-wave` as a sub-PR into its target's `feat/<topic>`, relays every
  item into the plan repository's outbox, marks each target PR ready once finished, and marks the
  plan PR ready only when every target PR has green CI and `omni status <n>` is green; its hand-off
  lists the target PRs in merge order, then the plan PR.
- A red gate leaves the plan PR in draft with the questions posted, and `/omni:ultra-yolo-fix <n>`
  lands each rework in its `repo`, then runs the gate again.
- No step merges into any repository's default branch, creates a label in a target, or runs a
  command that is not a target's own committed preflight.
- `omni help ultra-yolo`, `ultra-wave` and `ultra-yolo-fix` print their entries, and `pnpm test`
  is green.
