---
prd: 1130
title: Mega retro — one retro across every repository of a PRD
blocked-by: none
spec: file
---

# Mega retro

**Date:** 2026-10-06 · **PRD:** #1130
**Touches:**
- `apps/omni-app/src/retro/` (`retro.ts`, `qualify.ts`, `github.ts`, `render.ts`, `publish.ts`,
  `issues.ts`, `kinds/after-merge.ts`, and a new `targets.ts`)
- `apps/omni-app/src/octokit-for.ts`, `apps/omni-app/src/functions.ts` (the installation of a target)

## Problem

The retro is written by the omni-loop GitHub App when a PRD's feature PR merges
(`apps/omni-app/src/retro/retro.ts`, PRD 72). It reads one repository: the one the merge happened in.
For a PRD built across several repositories with `/omni:ultra-yolo`, that repository is the plan
repository, and the plan PR holds almost nothing: the slices, their sub-PRs, their CI runs and their
churn all live in the target repositories. So the retro of a multi-repository PRD is close to empty,
and its day-14 look counts only bugs fixed in the plan repository. PRD 563 left this out of scope on
purpose ("retro or knowledge PRs across repositories: the plan repository's own PRs only, as today").

## Solution

**When it runs** does not change: the plan PR merging into the plan repository's default branch starts
the retro, as any feature PR does. Every target PR merges before the plan PR (`/omni:ultra-yolo`'s
merge order), so at that moment the targets hold the whole delivery. A merge in a target never starts a
retro: a target has no PRD folder, so `qualify` skips it, as today.

**The targets.** After `qualify`, when the plan repository's config at the merge commit has a `plan`
section and the PRD's `plan.md` has a `## Repositories` table, the retro reads each target row of that
table (the plan repository's own row excepted), its `owner/name` from `plan.targets`:

1. **Access.** The App looks up its own installation on that repository (the App's call
   `GET /repos/{owner}/{repo}/installation`, on the App's budget) and reads it as that installation.
   No installation, or a read refused: the target is **not read**, with its reason, and the retro goes
   on with the others.
2. **Its pull requests.** The target's feature PRs: the PRs whose head is the PRD's feature branch
   (`branches.feature` filled with the PRD's topic), one per landing of a plan of several landings,
   and the sub-PRs into each.
3. **Its kinds.** The kinds the merge run reads today (timeline, delivery, CI, churn), each with a
   scope for that target (its owner, name, feature PR, sub-PRs, and the target's default branch), one
   saved step per target and kind, `gather-<kind>-<target>`. The plan repository's outbox decisions
   are read once, from the plan repository, as today.

**One fact sheet, grouped by repository.** Every record and every finding carries its repository. The
plan repository's come first, then the targets in the order of `## Repositories`. The thresholds and
rules are the same for every repository; a finding about a target says so in its title.

**What it writes,** all in the plan repository, as today:

- `retro.md` and `retro.json` in the PRD's shipped folder: the Timeline, Checks and Churn sections each
  have one subsection per repository, the Findings name their repository, and a target not read is
  one line, `<owner/name>: not read — <reason>`.
- One retro issue per kept finding, in the plan repository, its title naming the repository.
- The retro PR, or the verdict comment on the plan PR, as today.

**One comment on each target's merged feature PR,** the only thing the App writes in a target: the
retro's link and that repository's findings, one line each, found by its marker
`<!-- <markers.prefix>-retro-target -->` and rewritten in place on a replay or on day 14. A target
whose findings are none gets the link and `No finding for this repository.` A target not read gets
no comment.

**Day 14.** The after-merge kind reads, in the plan repository, the bug issues that name the PRD
(`#<n>`, as today) and the `/omni:mega-bug-fix` issues whose body carries `For PRD #<n>`. For each,
the fix PRs it names (a mega bug's fix-plan rows, `owner/name#n`) are read in their repositories and
placed against that repository's churn ranges at the merge, as a fix in the plan repository is today.
A bug fixed straight in a target, with no issue in the plan repository, is not seen: a stated limit.

**A PRD of one repository** is untouched: no `plan` section, or no `## Repositories` table, reads
exactly what it reads today, and writes no target comment.

## Decisions

- **Extend the automatic retro, not a new command.** The retro already runs by itself on every merge;
  a multi-repository PRD gets the same, so nobody has to remember to run anything.
- **Everything lands in the plan repository.** The retro file, its issues and its PR stay where the
  PRD lives, each finding naming its repository (the person's choice).
- **The voice objected.** B-E DEv (`persona:B-E DEv`): "I never open the plan repo. A finding about my
  back-end filed there is a finding I'll never see, so to me this retro is fluff." Accepted: each
  target's merged feature PR gets one comment with its findings and the retro's link. Settled:
  `accepted`.
- **The App's own installation per target.** The App reads a target as its installation there, looked
  up per target, so a target in another installation is read too; a target without the App is a line,
  never a failure.
- **Plan PR merge is the trigger.** Target PRs merge first, so the plan PR's merge sees the whole
  delivery; a target's own merges start nothing.
- **Day-14 bugs come from the plan repository.** That is where `/omni:mega-bug-fix` opens them;
  bugs fixed in a target without a plan-repository issue are out of sight, said in the spec.
- **The knowledge PR is out of scope,** a later PRD.
- **No proof video:** the retro runs inside the App; the person said no.

## User stories

1. As a PM, after the plan PR of a multi-repository PRD merges, I get one retro that tells how the
   delivery went in every repository: its timeline, its checks, its churn and its findings.
2. As a back-end developer, I see the findings about my repository in a comment on my merged feature
   PR, without opening the plan repository.
3. As a lead engineer, I read the retro's issues in one place, each naming the repository it is about.
4. As a PM, fourteen days later, the retro counts the bugs fixed in the targets for my PRD, including
   the ones fixed with `/omni:mega-bug-fix`.
5. As a PM, when the App is not installed on one target, the retro still runs and says which
   repository it could not read and why.

## Scope

In: reading each target's feature PRs, sub-PRs, timeline, delivery, CI and churn through the App's
installation there; one fact sheet grouped by repository; `retro.md` and `retro.json` sections per
repository; issues in the plan repository naming their repository; one comment per target's merged
feature PR; the day-14 look over mega bug fixes; the "not read" line.

Out: the knowledge PR across repositories; retro issues opened in targets; any file, branch or label
written in a target; installing the App on a target; bugs fixed in a target with no plan-repository
issue; a retro started by a target's own merge; any change to a one-repository PRD's retro.

## Test seams

- `apps/omni-app/src/retro/targets.test.ts`: from a config with `plan.targets` and a `plan.md` with
  `## Repositories`, the targets to read, in order, the plan repository excepted; none for a PRD of
  one repository.
- `apps/omni-app/src/retro/retro.test.ts`: the real function on a stubbed GitHub with a plan
  repository and two targets: one gather step per target and kind; a target with no installation is
  `not read` and the run finishes; the published `retro.md` groups sections by repository; one
  comment on each read target's merged feature PR, rewritten in place on a replay.
- `apps/omni-app/src/retro/render.test.ts` and a new golden: the grouped Timeline, Checks, Churn and
  Findings, and the `not read` line.
- `apps/omni-app/src/retro/issues.test.ts`: an issue for a target's finding opens in the plan
  repository and names the repository.
- `apps/omni-app/src/retro/kinds/after-merge.test.ts`: a `For PRD #<n>` bug with fix-plan rows in two
  targets; each fix placed against its own repository's churn.
- The existing retro tests and goldens for a one-repository PRD pass unchanged.

No test calls GitHub: everything runs on a stubbed GitHub and fixtures, as the testing form requires.

## Risks

- **What merging publishes:** the omni-loop GitHub App (`apps/omni-app`) on its next deploy. No
  database change, no kit change.
- **GitHub API budget:** a multi-repository retro reads each target as much as a one-repository retro
  reads its repository, on that target's installation budget at `background` priority, and the App's
  installation lookup is one App call per target. One retro at a time per repository, as today.
- **Writing in a target:** only one comment per merged feature PR, found by its marker and rewritten
  in place, never a second.
- **A target the App cannot read** makes a thinner retro, never a failed one; the line says so.
- **One-repository behaviour must not move:** pinned by the existing retro tests and goldens.
- **Rollback:** revert the feature PR and redeploy the App; retros and comments already posted stay
  as ordinary files and comments.

## Acceptance criteria

- Given a plan repository whose PRD's `## Repositories` names two targets the App is installed on,
  the plan PR's merge produces one `retro.md` whose Timeline, Checks, Churn and Findings each name
  both targets, read from their own feature PRs and sub-PRs.
- Given a target the App is not installed on, the retro finishes, and `retro.md` says
  `<owner/name>: not read — <reason>`; no comment is posted there.
- Every retro issue opens in the plan repository, and a finding about a target names that repository
  in its title.
- Each read target's merged feature PR carries exactly one comment with the retro's link and that
  repository's findings (or `No finding for this repository.`), rewritten in place on a replay.
- On day 14, a `/omni:mega-bug-fix` issue with `For PRD #<n>` whose fix PRs sit in two targets is
  counted in the After merge section, each fix placed against its own repository's churn.
- A merge in a target starts no retro.
- A one-repository PRD's retro reads and writes exactly what it does today.
