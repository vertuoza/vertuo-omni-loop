---
prd: 2896
title: A fleet works alone on its mission's branch, and asks a person only when one is needed
blocked-by: [2871]
spec: file
phase0: server
---

## Problem

A person is in series on every PRD, several times: the approval before the build, each high outbox
item, the review, the merge, the knowledge pull request. Agents got wider and those gates did not.
Measured on `main` from 2026-10-12 to 2026-11-14 (311 merges, 25 feature pull requests):

- PRD 2809's agents built 8 slices in about 6.5 hours, then the work waited about 12 hours for three
  answers and a merge (#2810). Five of the fifteen feature pull requests opened from 11-12 to 11-14
  waited 11 to 29 hours.
- One person merged 22 pull requests into `main` on 2026-11-13.
- A PRD blocked by another is held until a person merges its blocker
  (`apps/omni-app/src/missions/supervisor.ts`: a job that ends Ready "waits for a person to merge it").
- Ten knowledge and retro pull requests sat open for up to ten days and were replaced by one made by
  hand (#2869, 23 shipped PRDs in one).

A mission (PRD 2842) hands a goal to a Virtual Fleet, but its heroes stop wherever a person is
needed, so a mission moves at the speed of one person's availability.

Some teams review every pull request and must be able to keep doing so. Nothing here may change how
they work.

## Solution

A Virtual Fleet gets a **level**. A mission inherits its fleet's level and records it in its mandate.

| level | key | what it turns on |
|---|---|---|
| Reviews with you | `with-you` | nothing: a mission runs as it does today. The default |
| Own branch | `own-branch` | sections 2 to 5 |
| Works alone | `alone` | sections 2 to 8 |

A mission at `with-you` sends the same jobs, records the same events and opens the same pull requests
as before this PRD.

### 1. The level

- **On the fleet.** `teams.level`, `with-you` by default. The New virtual fleet drawer offers the three levels as one choice, each with one line saying what
  a person still does; the fleet's Missions tab shows the level with **Change**.
  Only a workspace owner sets a level above `with-you`; any member lowers it. A change applies to
  missions started after it.
- **On the mission.** `mandate.level` in `mission.md` and in `missions.mandate`. `/omni:mission` reads
  the fleet's level and writes it without asking; `--level <key>` overrides it. The Start screen shows
  the level in one line with **Change for this mission**. A member who is not an owner cannot start a
  mission above `with-you` unless the fleet's level already is.
- **Two bounds under it**, with defaults most people never change: `mandate.hardToRevert` (0 to 1,
  0.6 by default) and `mandate.ownPrds` (0 to 10, 0 by default). Both are read only at `alone`.
- **Lowering it mid-mission.** `alone` to `own-branch` takes effect on the next decision; what the
  fleet already decided stays listed. `own-branch` to `with-you` is refused while a PRD sits on the
  mission branch: `land or drop the <k> PRDs on <branch> first`.

### 2. The mission branch

- **Cut at Start.** The App cuts `branches.mission` (`mission/{number}-{topic}`) from the default
  branch when a person presses Start on a mission whose level is not `with-you`. Start refuses, naming
  the setting, when the repository does not allow rebase merges.
- **A PRD of the mission is built on it.** Its feature branch is cut from the mission branch and its
  feature pull request targets it. The runner job carries the base; `/omni:yolo`, `/omni:wave`,
  `/omni:pr` and `/omni:pr-care` read the base from the job where they read `repo.defaultBranch`
  today. Slices, waves and sub-PRs are unchanged.
- **Checks.** The `checks` workflow also runs for pull requests into `mission/**`, as it does for
  `main`. The App's own checks (outbox, budgets, business laws) run there as they do on a feature
  pull request into `main`.
- **A straight line.** The mission branch holds one commit per PRD and nothing else: it is never
  merged into, only squash-merged onto and rebased.

### 3. Joining the mission branch

When a PRD's job ends Ready, the supervisor reads **the merge gate**: every required check green on
the feature pull request's head, the Reviewer's verdict `pass` on that head (PRD 2871), and no open
high or `human-action` outbox item. On a pass the App squash-merges the feature pull request into the
mission branch, the commit's title the pull request's.

- The PRD's state is **on the mission branch**. The PRDs it blocked become startable, cut from a
  branch that holds its code. It no longer counts toward `mandate.parallel`.
- A gate that does not pass keeps the PRD waiting, on what it lacks: a red check goes back to
  `/omni:pr-care`, a Reviewer `changes` after its two rounds or an open item waits on a person (or on
  the committee, section 6). The rest of the mission goes on.
- A check that ends without deciding shows `not judged`, with its reason, never a pass; a check still
  running or waiting to run shows as not finished. Either way the PRD waits (BL-GATE-1).
- A PRD is **shipped** only when its commit is on the default branch: its release note, the knowledge
  harvest and the retro clock start there, as today.

### 4. Keeping up, landing, dropping

- **Keeping up.** When the default branch moves, the App rebases the mission branch onto it and
  force-pushes with lease, then rebases each open feature branch of the mission onto the new tip.
  A conflict only in paths under a `generated` entry sends one runner job that rebases and rebuilds
  them (the wave's rebuild). Any other conflict changes nothing: the mission waits on a person,
  naming the files.
- **The mission pull request.** One pull request from the mission branch into the default branch,
  opened when the first PRD joins, never a draft once a PRD is on it. Its body lists each PRD in
  landing order with its commit, its Reviewer verdict and its page, and is rewritten on every join
  and drop. A person merges it with **Rebase and merge**: the default branch gets one commit per PRD.
  The App then rebases the branch and opens the next mission pull request when PRDs remain.
- **Landing in parts.** A person may merge the mission pull request at any time; it carries what has
  joined so far.
- **Red.** When the mission branch's checks go red after a PRD joined, no further PRD joins; the
  mission waits on a person, naming that PRD and the drop line.
- **Dropping.** `omni mission drop <mission> <prd>`, run by a person: the App removes that PRD's
  commit by rebase, reopens its feature pull request against the mission branch and names every PRD
  that joined after it and touched the same territory; those are dropped with it unless the person
  passes `--keep`. A dropped PRD is `dropped` until a person sends it again.
- **One knowledge pull request per landing.** The harvest runs once for a merged mission pull request
  and covers every PRD it landed, numbering ids once. Retros stay per PRD.

### 5. What a person sees at `own-branch`

- **The mission page** gains a **Branch** line: the PRDs on it, the PRDs waiting on a person, in step
  with the default branch or not, and the mission pull request's link.
- **The operation room** records once each: a PRD joined, the branch was rebased, a PRD was dropped,
  a landing merged.
- **A feature pull request's status comment** names the mission branch it targets.

### 6. The committee, at `alone`

- **Members.** The PM chairs; the Architect and the Reviewer sit on it. The hero whose job wrote the
  PRD or raised the item sits out and never votes on it: on a PRD the PM wrote, or an item one of its
  PM skills raised, the Architect and the Reviewer vote alone. A fleet missing one of the three roles
  cannot be set to `alone`.
- **How it runs.** A new kit skill, `/omni:committee`, taken by runners: `/omni:committee <n>
  --approve` for a PRD waiting for approval, `/omni:committee <n> --item <id>` for a high outbox item.
  Each member runs as its hero's agent and model, reads the files with no other member's verdict in
  front of it, and returns `yes`, `no` or `unsure` with one sentence.
- **The vote.** Every member who sits must answer `yes`: three `yes`, or two when one sits out.
  Anything else escalates to a person, the verdicts attached. A member that fails or times out counts
  as `unsure`.
- **Only a PRD approved on its page.** The committee approves a PRD whose phase 0 is on the server
  (its spec says `phase0: server`). A PRD approved by a phase-0 pull request waits for a person, who
  merges that pull request as today: only a person merges into the default branch.
- **What it may never settle**, checked by code before any member runs:
  - an item ranked `human-action`;
  - a PRD or an item bearing on a locked law, a Legal entry, or a business law judged red;
  - an item whose hard-to-revert score is at or above `mandate.hardToRevert`;
  - a migration that drops or rewrites data.
- **The record.** A row of `mission_decisions`: the mission, the PRD, `approve` or `answer`, the item,
  the three verdicts, the outcome (`carried` or `escalated`) and, for an answer, the option chosen.
  It is signed by role and `agent`, never in a person's name, and written by the App, never through a
  terminal token (BR-PRODUCT-94).
  - A carried approval covers exactly the files the committee read. Any later change to one of them
    voids it, and the PRD waits for a new approval, from the committee or a person (BL-APPROVALS-1).
    It lets the PRD join its own mission's branch, and counts for no other mission. The PRD's page reads
    `Approved by fleet <key>`.
  - A carried answer settles the item as `answered by fleet <key>`; the feature pull request leaves
    its draft for the mission branch on it, never for the default branch.
- **Overturning.** A person overturns a decision from the mission pull request's list or with
  `omni mission overturn <mission> <decision>`. The decision stays as recorded and the person's is
  added beside it (BR-PRODUCT-12, BL-ASK-1). An overturned approval voids it; an overturned answer
  reopens the item for that person; either way the PRD is dropped from the branch if it had joined.
- **What a person sees.** The mission pull request's body opens with two lists, **Approved by the
  fleet** and **Answered by the fleet**, each line with the three verdicts and a link. The mission
  page gains **Waiting on you** (only what was escalated, each with why) and a trust line:
  `<n> decisions by the fleet · <k> overturned`. A person is notified for an escalation, a real
  conflict or a red branch, and for nothing else.

### 7. The PM's own PRDs, at `alone`

- **Four PM skills on runners.** Runners take `brainstorm`, `roadmap`, `mega-brainstorm` and
  `mega-roadmap`, for a mission's job only: a line naming one of them is refused on a job that belongs
  to no mission at `alone`, with `/omni:<skill> runs on a runner for a mission's PM only`. The four
  join the runner lists (`RUNNABLE_SKILLS`, the Omni app's list and the database's), so the PM's
  count line reads `Runs 6 of 7 skills alone` (`mission` stays a person's).
- **Which one.** While the mission's PRDs added by the fleet are fewer than `mandate.ownPrds`, the
  supervisor may send the PM one job for the mission's goal: `/omni:brainstorm` for one PRD,
  `/omni:roadmap` for several, and `/omni:mega-brainstorm` or `/omni:mega-roadmap` when the
  mission's PRDs live in a plan repository (section 8).
- **Each PRD counts.** A roadmap writes only the PRDs that fit under `mandate.ownPrds`, in its order;
  the ones it left unwritten are named on the mission page, under the roadmap, as `not written: the
  cap is <k>`. A brainstorm that would pass the cap is not sent.
- **Asks nobody.** An unattended PM skill asks nobody: each question it would have asked is a high
  item on the PRD it writes, which the committee settles or escalates. A roadmap's PRDs are each born
  on the server (`phase0: server`), and the roadmap opens no phase-0 pull request.
- **Approved by the two others.** A PRD the PM wrote joins the mission's scope as `added by the
  fleet` and is approved by the Architect and the Reviewer (section 6): both `yes`, the PM sitting
  out, the escalation list checked first. Every other PRD of the mission goes on meanwhile.

### 8. A mission in a plan repository, at `alone`

- A fleet whose mission's PRDs live in a plan repository may be set to `alone` for **the committee
  only**: it approves the mission's PRDs and answers their high items as section 6 says, and its PM
  writes PRDs with the mega skills as section 7 says.
- No mission branch is cut there (sections 2 to 5 stay one repository's). Each PRD is built with
  `/omni:ultra-yolo` (PRD 2873) into each target repository's feature pull request, which a person
  merges as today. The mission page says `committee only: a person merges each target's pull
  request`.
- `own-branch` is refused for a mission in a plan repository: `a mission branch holds one
  repository: use with-you or alone`.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuoza/vertuo-omni-loop | config | `branches.mission`, `mission/{number}-{topic}` | no written convention: follows `kit/lib/config.ts:319` (`branches.landing`, a template with named fields) |
| vertuoza/vertuo-omni-loop | brief | `mandate.level`, `mandate.hardToRevert`, `mandate.ownPrds` | no written convention: follows `kit/lib/mission/brief.ts` (`mandate.parallel`, camelCase like `limits.parallelSteps`) |
| vertuoza/vertuo-omni-loop | brief | `with-you`, `own-branch`, `alone` | no written convention: follows `apps/omni-app/src/missions/supervisor.ts` (`job-ended`, `prd-ready`: lowercase, dashes) |
| vertuoza/vertuo-omni-loop | database column | `teams.level` | no written convention: follows `supabase/migrations/20270122090000_virtual_fleets.sql:29` (`teams.kind`, a checked text column) |
| vertuoza/vertuo-omni-loop | database table | `mission_decisions` | no written convention: follows `supabase/migrations/20270122093000_missions.sql:184` (`mission_events`) |
| vertuoza/vertuo-omni-loop | mission event | `prd-joined`, `branch-rebased`, `prd-dropped`, `landed`, `decided`, `escalated`, `overturned` | no written convention: follows `supabase/migrations/20270122093000_missions.sql:190` (`job-ended`, `prd-merged`) |
| vertuoza/vertuo-omni-loop | CLI | `omni mission drop`, `omni mission overturn` | no written convention: follows `kit/bin/commands/mission.ts` (`omni mission push`) |
| vertuoza/vertuo-omni-loop | skill | `/omni:committee` | no written convention: follows `kit/plugin/skills/` (one lowercase word or dashed pair per skill) |

## Decisions

- **A mission branch, not one shared staging branch.** A red branch blocks one mission, not every
  project, and the mandate already belongs to the mission.
- **Landed by rebase, not by a merge commit or a stack of pull requests.** Everything stays under one
  branch and one pull request, and the default branch still gets one commit per PRD, each revertible
  alone. Asked for by the person in the design.
- **Drop, not fix forward.** A bad PRD is taken off the branch before it reaches the default branch.
  Dropping automatically on a red branch is left to a later PRD: here a person drops.
- **The merge gate** is green checks, the Reviewer's pass and no open high item, chosen by the person
  over checks alone and over a gate each mission picks.
- **One PRD for the branch and the committee**, chosen by the person over two PRDs. The plan orders
  the slices so the branch works before the committee exists.
- **A level on the fleet, three values**, chosen by the person over three switches on each mission,
  so that turning it on is one choice made once.
- **Escalation by rule first, by vote second.** The list of section 6 is checked by code; the
  committee's judgement only applies to what the list lets through.
- **A fleet's approval is in force for its mission only.** Outside a mission, a PRD is approved by a
  person as today. This changes the proposed rule BR-APPROVALS-1 (see Risks).
- **The committee approves its own PM's PRDs, the PM sitting out** (rework, 2026-11-15, asked for by
  the person: the team decides whether a person is really needed). The Architect and the Reviewer
  both vote `yes`, after the escalation list; `mandate.ownPrds` (0 by default) caps how many PRDs the
  fleet may add, each counting, and every PRD still reaches the default branch only through the
  mission pull request a person merges. This replaces "the committee never approves its own PM's PRD".
- **Runners take the PM's four writing skills for a mission only** (rework): `brainstorm`,
  `roadmap`, `mega-brainstorm`, `mega-roadmap`. Outside a mission they need a person at the
  terminal, as today.
- **A plan-repository mission works alone for the committee only** (rework), over keeping it at
  `with-you`: a mission branch across repositories is a later PRD.
- **Only a PRD approved on its page is approved by the fleet.** A phase-0 pull request is merged into
  the default branch, which only a person does.
- **The voice** (rework): B-E DEv objected that two agents approving the PM's own scope is a rubber
  stamp (persona:B-E DEv). The person approved the design without answering it: settled `none`.
- **The knowledge harvest runs once per landing**, not on mission branches: it numbers new ids, and
  two missions harvesting at once would hand out the same ones.
- **Built after PRD 2871**, declared by the person: the merge gate reads the Reviewer's verdict, the
  `<!-- omni-review: <round> <verdict> -->` marker `/omni:review` posts. PRD 2871 shipped on
  2026-11-15 (#2872).
- **The first voice round** is the rework's: the first design's business read had no sign-in.

## User stories

- As an owner who runs several projects at once, I set my fleet to Works alone once, start missions
  with one press, and am asked only for what a rule or a dissenting hero sends me.
- As a person landing a mission, I read one pull request that lists every PRD and everything the
  fleet decided without me, and I merge it so that each PRD is its own commit.
- As a person who sees a PRD that should not ship, I drop it from the mission branch and the rest of
  the mission still lands.
- As a team that reviews every pull request, I change nothing and nothing changes.

## Scope

In: the fleet's level and its screens; the mandate's three fields; the mission branch, its merge
gate, its rebase, its mission pull request, drop; the `checks` workflow on `mission/**`; one
knowledge pull request per landing; `/omni:committee`, `mission_decisions`, overturn; the PM's own
PRDs, with runners taking `brainstorm`, `roadmap`, `mega-brainstorm` and `mega-roadmap` for a
mission; a plan-repository mission at `alone` for the committee only; the guide's Missions page.

Out: dropping automatically on a red branch; a database or a preview per mission branch (a
mission's migrations reach the database when its PRD lands on the default branch, as today); bug
fixes and PRDs outside a mission; retros per landing; product PRDs; a mission branch across repositories (a plan-repository mission
keeps its target pull requests for a person); the PM's skills on runners outside a mission; any
change to who merges into the default branch.

## Test seams

Following the testing form: the narrowest test that proves the risk, beside the code.

- **The supervisor** (`apps/omni-app/src/missions/supervisor.ts`), pure functions: table tests for
  the merge gate, the new PRD states, what unblocks what, the branch's states and what each waits on.
- **The escalation list**, pure: one test per line of section 6 proving three `yes` do not settle it.
- **The committee's vote**, pure: three `yes` carry, or two when the author sits out; a `no`, an
  `unsure`, a failed or late member escalate; the author never votes; a PRD born with a phase-0 pull
  request is never approved by it.
- **The runner lists** (`kit/lib/runner/line.ts`, the App's list, the database's): the four PM skills
  accepted on a mission's job at `alone` and refused on any other, with the line above; the lists
  held equal by the tests PRD 2873 added.
- **The unattended PM skills:** each question the skill would ask becomes a high item; a roadmap past
  the cap writes the PRDs that fit, in order, and names the rest.
- **The App's merge, rebase, drop and mission pull request**, against the in-memory GitHub the App's
  tests use (`apps/omni-app/test/fixtures/`), with real git repositories for the rebase and the drop.
- **The brief** (`kit/lib/mission/brief.test.ts`): valid and invalid `level`, bounds, defaults.
- **The database** (`supabase/checks/missions.sql`): who may raise `teams.level`, the mandate's shape,
  `mission_decisions` readable by the workspace and written only by the service.
- **The off path:** a mission at `with-you` produces the events and pull requests the tests of
  PRD 2842 already pin, unchanged.
- **The screens:** page tests for the level choice, the Branch line, Waiting on you and the trust
  line, in each of their states.

## Risks

- **What merging this publishes.** A migration (`teams.level`, the mandate's shape, new event kinds,
  `mission_decisions`), applied to production by the `supabase` workflow; the kit (new skill, two
  commands, config key); the arcade and the App. All of it is inert until a fleet's level is raised.
  The `checks` workflow starts running for `mission/**`.
- **Rolling back.** Lower the fleets' level, land or drop what sits on mission branches, then revert
  the PRD's commit. The migration is additive; its tables and column are left behind by a revert.
- **Agents merging.** The App merges into `mission/**` only. The ruleset on `main` lets only the
  release key push there, so a mistake in the App cannot reach the default branch.
- **A fleet that widens its own scope.** The PM writes PRDs that two other heroes approve. Bounded by
  `mandate.ownPrds` (0 unless a person raises it), the escalation list, and the mission pull request
  a person reads and merges, where each PRD the fleet wrote is marked `added by the fleet`.
- **A committee that agrees and is wrong.** Three members of similar models can share a blind spot.
  The escalation list does not depend on their judgement, a person reads every decision on the
  mission pull request before it lands, and the trust line shows how often they were overturned.
- **A force-pushed branch.** A rebase rewrites the mission branch under open feature branches. The
  App rebases them itself and refuses on a conflict; a job that pushes onto a stale base is refused
  by `--force-with-lease` and meets the base again.
- **A setting only a person can change.** Rebase merges must be allowed on `main`. Start says so.
- **The Legal entries** (read again in the rework):
  - L-AIACT-1, content an agent makes says so: kept. A fleet's approval and answer are signed by role
    and `agent`, and the PRD's page reads `Approved by fleet <key>`, never a person's name.
  - L-GDPR-4, logs that record decisions are kept for good: kept. `mission_decisions` is such a log
    and has no retention period.
  - L-GDPR-3, a deleted account keeps the record of its decisions: kept. A person's overturn stays in
    `mission_decisions` as the product's history.
- **The locked laws it touches:**
  - N-PRODUCT-15: kept. If broken, unreviewed work reaches every user and nobody chose to ship it.
    Only a person merges into `main`. Changing it needs @pierrederval or @dervalp to approve the pull
    request on GitHub.
  - BR-PRODUCT-5: kept by its words, and its owner should confirm the reading. If broken, a person
    could merge work whose open decisions nobody answered. At `alone` an item the fleet answered is
    no longer open, and it is listed on the mission pull request before a person merges. Changing it
    needs @pierrederval or @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-3: kept. If broken, an agent waves its own work through the gate. The committee never
    applies the override label, and the building agent never votes. Changing it needs @pierrederval
    or @dervalp to approve the pull request on GitHub.
  - BR-PRODUCT-12: kept. If broken, nobody can tell what was decided. An overturned decision is never
    edited; the person's is added beside it. Changing it needs @pierrederval or @dervalp to approve
    the pull request on GitHub.
  - BR-PRODUCT-6, N-PRODUCT-3, N-PRODUCT-4, N-PRODUCT-14: kept. The live check, the grading of a
    question, the rules a pull request is judged by and the base comparison are unchanged; the base
    of a mission's PRD is its mission branch. Changing one needs @pierrederval or @dervalp to approve
    the pull request on GitHub.
  - BR-PRODUCT-28, 29, 39, 59, 63, 64 and N-PRODUCT-16 govern files this PRD edits and are not
    touched by the design.
- **A rule it changes.** BR-APPROVALS-1 (proposed): "A mission sends a PRD only when its Omni page
  holds a product approval in force". At `alone`, a committee's carried approval lets that
  mission send the PRD; it covers exactly the files the committee read, and a change to one voids it.
- **The business laws:**
  - BL-APPROVALS-1 — an approval covers exactly the files the approver read: kept, for a fleet's
    approval as for a person's.
  - BL-ASK-1 — a person's answer is never changed or reworded: kept; the fleet answers in its own
    name and a person's overturn is added beside it.
  - BL-GATE-1 — a check that ends without deciding shows `not judged` with its reason, never a pass,
    and one still running shows as not finished: kept; the mission branch's merge gate and the
    committee's record show an undecided check or verdict that way, and it holds the merge.

## Acceptance criteria

1. A fleet's level is `with-you` unless a workspace owner raised it; a member who is not an owner is
   refused when raising it, and any member may lower it.
2. A mission started on a fleet at `with-you`, with no `mandate.level`, records the same events and
   opens the same pull requests as before this PRD.
3. `/omni:mission` writes the fleet's level into `mandate.level` without asking, and the Start screen
   shows it with **Change for this mission**.
4. Starting a mission at `own-branch` cuts `mission/<number>-<topic>` from the default branch; where
   rebase merges are not allowed, Start is refused with the setting's name and nothing is cut.
5. A PRD of that mission is built on a feature branch cut from the mission branch, and its feature
   pull request targets the mission branch and runs the `checks` workflow.
6. When that pull request is green, the Reviewer's verdict on its head is `pass` and no high or
   `human-action` item is open, the App squash-merges it into the mission branch; with any of the
   three missing it does not, and the mission says what the PRD waits on.
7. Once a PRD is on the mission branch, a PRD it blocked is sent, on a branch that holds its commit.
8. When the default branch moves, the mission branch is rebased onto it and each open feature branch
   of the mission onto the new tip; a conflict only in generated paths is resolved by a job that
   rebuilds them; any other conflict changes no branch and the mission waits on a person, naming the
   files.
9. The mission pull request lists each PRD on the branch with its commit, its Reviewer verdict and
   its page; merging it with Rebase and merge puts one commit per PRD on the default branch, and each
   PRD is shipped from that moment, not before.
10. After a landing, one knowledge pull request covers every PRD that landed, with no id used twice.
11. `omni mission drop <mission> <prd>` removes that PRD's commit from the mission branch, reopens its
    feature pull request, and names the later PRDs that share its territory; the default branch is
    never changed by it.
12. A fleet missing a PM, an Architect or a Reviewer cannot be set to `alone`; a mission in a plan
    repository cannot be set to `own-branch`.
13. At `alone`, a PRD of the mission waiting for approval on its page is approved when the three
    members answer `yes`: its page reads `Approved by fleet <key>`, and a later change to a file they
    read voids it. A PRD waiting on a phase-0 pull request is never approved by the fleet.
14. At `alone`, a high item is settled when the three members answer `yes`, as `answered by fleet
    <key>` with the option chosen; the hero whose job raised it did not vote.
15. Each line of the escalation list reaches a person although three members would answer `yes`.
16. A `no`, an `unsure`, a member that fails or times out sends the PRD or the item to a person with
    the verdicts attached.
17. The mission pull request's body lists every approval and every answer the fleet carried, and the
    mission page shows only what was escalated under **Waiting on you**, and the trust line.
18. Overturning a decision leaves it as recorded, adds the person's beside it, and drops the PRD from
    the mission branch when it had joined.
19. With `mandate.ownPrds` at 0 no PM job is sent; above 0 the PM adds at most that many PRDs, each
    counting, each marked `added by the fleet`, and each approved when the Architect and the
    Reviewer both answer `yes`, the PM not voting.
20. Lowering a mission from `own-branch` to `with-you` while a PRD is on its branch is refused, saying
    how many PRDs to land or drop first.
21. A runner takes `/omni:brainstorm`, `/omni:roadmap`, `/omni:mega-brainstorm` and
    `/omni:mega-roadmap` on a mission's job at `alone`, and refuses each on any other job, naming why;
    the PM's count line reads `Runs 6 of 7 skills alone`.
22. An unattended PM skill asks nobody: each question it would have asked is a high item on the PRD it
    wrote; a roadmap that would pass `mandate.ownPrds` writes the PRDs that fit, in order, and the
    mission page names the ones left unwritten.
23. A mission in a plan repository at `alone` cuts no mission branch: the committee approves its PRDs
    and answers their high items, each PRD is built with `/omni:ultra-yolo`, and a person merges each
    target repository's pull request.
