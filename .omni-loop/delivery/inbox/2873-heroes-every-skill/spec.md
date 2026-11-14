---
prd: 2873
title: Every Virtual Hero lists all its role's skills, and runners take the ultra skills
blocked-by: none
spec: file
phase0: server
---

## Problem

A Virtual Hero (PRD 2842) lists only part of its role's skills: the PM shows `pitch` and `plan` but no
`brainstorm`, `roadmap` or `mega-brainstorm`, and the Engineer misses `mega-bug-fix` and the ultra
skills (bug #2870). An owner reading the Heroes tab cannot tell what a hero covers, nor which of its
skills a runner runs with nobody at it. The one line each hero carries (`Works alone` or `A person
does this today`) comes from a rule kept apart from the runner's own list, so it can say one thing
while the runner does another.

The Engineer also cannot build a multi-repository PRD on a runner: runners do not take
`/omni:ultra-yolo`, `/omni:ultra-wave` or `/omni:ultra-yolo-fix`. Only `/omni:mega-bug-fix` gets a
token for the other repositories of its product, so a mission whose PRD lives in a plan repository has
nothing to send.

There is no UI/UX role: no hero runs `/omni:visual-fix`, `/omni:pixel-perfect` or `/omni:think-big`.

## Solution

### 1. Every hero lists every skill of its role

Six roles, in the drawer's order: Engineer, QA, Reviewer, PM, Architect and **Designer** (new). Each
lists every kit skill of its role:

| role | skills |
|---|---|
| Engineer | `yolo`, `yolo-fix`, `wave`, `do-work`, `pr-care`, `bug-fix`, `mega-bug-fix`, `ultra-yolo`, `ultra-yolo-fix`, `ultra-wave`, `mega-pr-care`, `drive`, `mega-drive` |
| QA | `prove`, `bug-fix`, `validate-e2e` |
| Reviewer | `tech-review` |
| PM | `pitch`, `plan`, `brainstorm`, `roadmap`, `mega-brainstorm`, `mega-roadmap`, `mission` |
| Architect | `plan`, `tech-review` |
| Designer | `visual-fix`, `pixel-perfect`, `think-big` |

Skills of no role (`retro-apply`, `rewind`, `rewind-apply`, `knowledge-add`, `help`, `status` and the
like) are on no hero.

**Each skill carries one mark:** `runs alone` when the runner's own list of skills it takes
(`RUNNABLE_SKILLS` in the kit) holds it, `needs a person` otherwise. There is no third mark. The kit's
separate list of unattended skills is removed: the mark is read from the runner's list, so a skill a
later PRD lets runners take reads `runs alone` the day it ships, with no change here.

**The hero's line** is a count: `Runs <k> of <n> skills alone` (`Runs 10 of 13 skills alone` for the
Engineer once this PRD ships). A hero with no skill that runs alone reads `A person does this today`,
with no why line. The operation room reads an idle hero as `Idle`, and a hero with no skill that runs
alone as `A person does this today`, as today.

**The Designer** is drawn with a hero look of its own, in the fleet's colour, and its limits are
`It never merges into the default branch.`, `It never answers for a person.` and `It never locks a
screen: a person does.` Its agent and model are `claude` and `opus`.

**Stored heroes.** One migration adds `designer` to the roles a hero and a mission event accept, gives
`virtual_hero_roles()` the six roles and their lists, and rewrites the skills of every hero already
made to its role's list. Names, agents, models and limits a hero already has stay as they are.

**Screens.** The Heroes tab shows each skill with its mark, the `runs alone` skills first, and the
count line. The New virtual fleet drawer shows six yes/no switches, all on, each with its count line.

### 2. Runners take the ultra skills

- **The lists.** `ultra-yolo`, `ultra-wave` and `ultra-yolo-fix` join every list of skills a runner
  takes: the app's (`RUNNER_SKILLS`), the kit's (`RUNNABLE_SKILLS`, and `PRD_SKILLS`, so the Runners
  page names the PRD), the database's (`repository_runner_skills`'s fixed list) and the accounts'
  check. A migration of its own (apart from the heroes one) adds them there, with the four skills the database's list lacks today: `retro-apply`,
  `rewind`, `knowledge-add` and `rewind-apply`. A test holds the database's list equal to the app's,
  as one already holds the app's equal to the kit's.
- **The token.** An ultra job is sent from a plan repository of a product. When it is claimed, its
  token covers the product's repositories that the key allows and the same App installation holds,
  the way `/omni:mega-bug-fix`'s does: the rule becomes "a skill that spans the product", holding the
  four skills. An ultra line sent from a repository that is no product's plan repository is refused
  when it is sent: `/omni:<skill> runs from a product's plan repository: send it from <plan
  repository>`, naming the product's plan repository when there is one.
- **The clones.** On a runner (`OMNI_JOB` set), `/omni:ultra-yolo`, `/omni:ultra-yolo-fix` and
  `/omni:mega-bug-fix` clone their targets into `<worktrees>/targets/job-<id>/<name>`, a folder of the
  job's own, so two jobs never share a clone. Off a runner the folder is as today.
- **Unattended.** Under `OMNI_UNATTENDED`, `/omni:ultra-yolo`'s red gate offers no "answer here": the
  plan PR stays a draft with its questions posted, as `/omni:yolo` already does. `/omni:ultra-wave`
  starts at most `limits.parallelSteps` agents at once on a runner.
- **A target the App does not hold** stops the job at the clone step, naming the repository and the fix
  (`install the Omni GitHub App on <owner/name>`), with nothing pushed for that target.
- **The time limit.** A job that reaches the runner's time limit (8 hours by default) ends; what merged
  stays merged, and the same line sent again picks up where the plan stands, as `/omni:ultra-yolo`
  reads its state from GitHub. No automatic resume is added.
- **Missions.** A mission's Send gives the Engineer `/omni:ultra-yolo <prd>` when the mission's PRD
  lives in a plan repository, and `/omni:yolo <prd>` otherwise.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | code | role `designer` in `HERO_ROLES` | follows `HERO_ROLES` ← kit/lib/virtual-fleet/roles.ts:21 |
| vertuo-omni-loop | code | `skillMarks()` and `SkillMark` (`alone` \| `person`) in roles.ts | no written convention: follows `roleLine()` ← kit/lib/virtual-fleet/roles.ts:107 |
| vertuo-omni-loop | code | `spansProduct()` in place of `isMegaBugFix()` | follows `isMegaBugFix` ← apps/galaxy/src/runners/runners.service.ts:198 |
| vertuo-omni-loop | db | migrations `<timestamp>_runner_ultra_skills.sql` and `<timestamp>_heroes_every_skill.sql`, newer than every migration on `main` | conventions › A migration stays the newest |
| vertuo-omni-loop | skill | clone folder `<worktrees>/targets/job-<id>/<name>` | follows `<worktrees>/targets/<name>@<prd>` ← kit/plugin/skills/ultra-yolo/SKILL.md:279 |

## Decisions

- **One PRD for the heroes and the ultra skills on runners.** The person: "we need to do 1 and 2 in ONE
  go as they only get result once they are done". Letting runners take the PM's brainstorm, roadmap and
  mega skills inside a mission (the PRD's approval being the person's gate), and a design-system skill
  for the Designer, are later PRDs.
- **Two marks, no third.** The person asked not to show "not yet": a skill runners do not take reads
  `needs a person` until a PRD lets them take it.
- **The mark is read from the runner's list,** never a list of its own, so it cannot disagree with what
  a runner takes (bug #2870's cause).
- **The line is a count** (`Runs 10 of 13 skills alone`), in place of `Works alone` with why: the
  earlier rule read as unclear.
- **The Designer** has `visual-fix`, `pixel-perfect` and `think-big`, named `Designer` (the person's
  pick; `think-big` moves off the PM).
- **Heroes already made are updated** by the migration (the person, on #2870).
- **Approach A:** the ultra skills take `/omni:mega-bug-fix`'s path (one token for the product's
  repositories, a clone folder per job), not one job per repository.
- **The voice.** persona:F-E Developer objected: "One unattended job now opening pull requests in
  several repositories at once multiplies what I have to review before anything breaks." Settled:
  none. The person approved approach A as written; the existing gates answer it (draft pull requests,
  the outbox gate, a person merges).
- **No proof video** (the person said no).

## User stories

- As a workspace owner, I open a Virtual Fleet's Heroes tab and see every skill each hero's role
  covers, each marked `runs alone` or `needs a person`, so I know what I still do myself.
- As a workspace owner, I add a Designer hero to a fleet, which lists `visual-fix`, `pixel-perfect`
  and `think-big`.
- As a person writing a mission whose PRD lives in a plan repository, I press Send and the Engineer
  builds it across its repositories on a runner, with no terminal open.
- As a person on the Runners page, I send `/omni:ultra-yolo <n>` from the plan repository and follow
  its job, its PRD named, like any build.

## Scope

In: the six roles and their skill lists; each skill's mark from the runner's list; the count line; the
Designer (look, limits, defaults); the migration (roles, defaults, existing heroes, the runner skills
list); the Heroes tab, the drawer and the operation room's words; `ultra-yolo`, `ultra-wave` and
`ultra-yolo-fix` on runners (every list, the token, the per-job clone folder, the unattended gate, the
agent cap, the stop on a target the App lacks); a mission's Send choosing `/omni:ultra-yolo`.

Out: runners taking `brainstorm`, `roadmap`, `mega-brainstorm`, `mega-roadmap` or `mission` (the
next PRD); a design-system skill (a later PRD); routing a job to the hero's agent and model; an
automatic resume of an ultra job; letting an owner edit a hero's skills.

## Test seams

Following `omni kb show testing`: tests beside the code, nothing calls GitHub or Supabase.

- `kit/lib/virtual-fleet/roles.test.ts`: the six roles and their lists, in the drawer's order; each
  mark read from `RUNNABLE_SKILLS` (a skill added to it reads `runs alone`); the count line; `A person
  does this today` for a hero with no skill that runs alone.
- `apps/galaxy/src/virtual-fleets/roles-sql.test.ts`: the role defaults equal `virtual_hero_roles()`;
  a new test holds the database's runner skills list equal to `RUNNER_SKILLS`.
- `supabase/checks/virtual_fleets.sql`: six roles in order, `designer` accepted by heroes and mission
  events, every existing hero's skills rewritten to its role's list.
- `apps/galaxy/src/runners/runners.service` tests: an ultra job from a plan repository gets the
  product's repositories the key allows and the installation holds; from any other repository it is
  refused with its reason.
- `kit/lib/runner/line.test.ts`: an ultra line passes the runner's check and names its PRD.
- Render tests: the Heroes tab (marks, order, count line), the drawer (six switches), the operation
  room (`Idle` against `A person does this today`).
- The mission's Send: a plan-repository PRD sends `/omni:ultra-yolo`, any other `/omni:yolo`.
- The skills' text: the kit's skill tests where they exist, for the clone folder under `OMNI_JOB` and
  the unattended gate.

## Risks

Merging publishes a new migration (it rewrites existing heroes' skills) and lets runners run
multi-repository jobs. Rolled back by reverting the pull request and a follow-up migration that puts
back PRD 2842's defaults; heroes keep the lists they were given.

- **The token spans more repositories.** An ultra job's token reaches the product's repositories the
  key allows and the installation holds, never more, the same bound as `/omni:mega-bug-fix`'s.
- **A long unattended job** opens draft pull requests in several repositories; none merges without a
  person.

The Legal entries:
- L-AIACT-1 (content an agent makes says so): the ultra jobs sign their pull requests as the App, as
  every runner job does; kept.
- L-GDPR-2 (credentials never in clear): the wider token is kept as today, in the job's file, never in a
  variable or a log; kept.

The locked laws:
- BR-PRODUCT-63: an agent could read another team's private work if the token reached a repository
  outside the workspace. The token stays within the key's allow-list and the workspace's product.
  Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-15: unreviewed work would reach every user if an ultra job merged. It never merges into a
  default branch. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-28, BR-PRODUCT-64, BR-PRODUCT-12, BR-PRODUCT-29, BR-PRODUCT-39, N-PRODUCT-16,
  BR-PRODUCT-59: printed for the files this PRD touches; the design changes none of them (no account
  link, agent link, answer, ask session, ledger or AI key is read or written differently). Changing
  any needs @pierrederval or @dervalp to approve the pull request on GitHub.

The business laws:
- BL-APPROVALS-1 (an approval covers exactly the files the approver read): kept. An ultra job on a
  runner changes no approved file after its approval; a plan reworked after approval waits for a new
  one, as today.
- BL-ASK-1 (an answer a person gave is never changed): kept. The unattended red gate posts the
  questions and changes no answer.

## Acceptance criteria

- The Heroes tab of a Virtual Fleet shows each hero's skills as the table in **Solution** lists them,
  each marked `runs alone` or `needs a person`, the `runs alone` ones first.
- A skill's mark is `runs alone` exactly when the runner's list of skills holds it; adding a skill to
  that list changes its mark with no other change.
- Each hero reads `Runs <k> of <n> skills alone`, or `A person does this today` when none of its skills
  runs alone (the Reviewer).
- The New virtual fleet drawer shows six roles, the Designer among them, all on by default.
- After the migration, every hero already made lists its role's skills; its name, agent, model and
  limits are unchanged.
- The Runners page accepts `/omni:ultra-yolo <n>`, `/omni:ultra-wave <n>` and `/omni:ultra-yolo-fix
  <n>` sent from a product's plan repository, names the PRD, and refuses them from any other
  repository with the reason that names the plan repository.
- An ultra job's token covers the product's repositories the key allows and the installation holds,
  and no other.
- On a runner, an ultra job clones its targets into a folder of its own; a target the App does not
  hold stops the job naming the repository and the fix.
- On a runner, `/omni:ultra-yolo`'s red gate asks nothing and leaves the plan PR a draft with its
  questions posted; `/omni:ultra-wave` runs at most `limits.parallelSteps` agents at once.
- A mission whose PRD lives in a plan repository sends `/omni:ultra-yolo <prd>`; any other sends
  `/omni:yolo <prd>`.
- The database's list of runner skills equals the app's, the four it lacked today included.
