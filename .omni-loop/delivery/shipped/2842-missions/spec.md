---
prd: 2842
title: Missions the fleet delivers with the laptop closed
blocked-by: none
spec: file
phase0: server
---

## Problem

Omni Loop builds one PRD per command, or a roadmap through `/omni:drive`, which runs on a person's
laptop (`/loop /omni:drive`: its state in `.omni-loop/local/loop.json`, its steps as local
subagents). Close the laptop and the loop stops. Nothing holds *why* the work is done either: a
roadmap lists PRDs, not the goal they serve or how anyone will tell it worked.

Concept #2800 (the Fleet's Operation room) asks for a **mission**: a goal a person states once, that
the runner fleet then delivers on its own, laptop closed, stopping only for what needs a person.
PRD 2809 made a runner job survive a lost runner; this PRD gives the fleet something to work towards.
It is the first PRD of the concept's area `room-and-reviewer`; the Reviewer gets its own PRD next.

## Solution

### 0. The Virtual Fleet and its Virtual Heroes

A **Virtual Fleet** is a new kind of fleet: like the workspace's fleets (a name, a colour, a mascot,
`teams`), but its members are **Virtual Heroes**, and it is never offered on the arcade's select
screen. (Later, an ordinary fleet may hire Virtual Heroes; not in this PRD.)

- **Today** the Fleet section (`/app/fleet`) only shows fleets (a row of fleet chips, the chosen
  fleet's name, mascot and place this season, its board); it cannot create one. With no fleet it says
  `This workspace has no fleet yet` and links to Settings › Fleets, where only an owner creates a
  players' fleet. No fleet of agents exists.
- **Create one from the Fleet section,** any member of the workspace: `+ New virtual fleet` closes the row of fleet chips (and is
  the main button when the workspace has no fleet yet). It opens a **drawer** on the right (the
  pattern of the Runners page's Need human drawer: 560 px over the page dimmed, the whole width on a
  phone) with, in order:
  1. **Name**, first and focused: unique in the workspace, players' fleets included (`Name taken:
     choose another` under the field otherwise);
  2. **Icon**: one of the fleet mascots (BR-PRODUCT-46), the first selected;
  3. **Heroes**: the five roles, PM, Engineer, Architect, QA, Reviewer, each a yes/no switch, **all on
     by default**, each saying whether it works alone today; at least one stays on, or Create fleet is
     disabled.
  **Create fleet** saves it, its key made from its name (BR-PRODUCT-47) and its colour picked for it
  (the next fleet colour not in use; changed later in Settings › Fleets), and lands on its
  Operation room: its heroes, idle, and `Write a mission`. A hero can be added or removed later in
  the Heroes tab.
- **A Virtual Hero** is a role with its skills: a name (by default its role, never a person's first
  name), its role, the skills that role runs (Engineer: `yolo`, `yolo-fix`, `wave`, `do-work`,
  `pr-care`, `bug-fix`; QA: `prove`, `bug-fix`; PM: `pitch`, `plan`; Architect: `plan`; Reviewer:
  none yet), its preferred agent and model (recorded; the runner's accounts still decide in this
  PRD), its limits in sentences, and a sprite from `@omni/design` drawn in the fleet's colour. It
  is always shown as an agent (`Engineer · agent`), never as a person.
- **Can it work alone?** A hero whose role has a skill a runner runs with nobody at it works alone
  (the Engineer today; the QA's `prove` too). The others read `A person does this today`, with why
  (the PM's brainstorm and roadmap need a person; the Architect and the Reviewer have no unattended
  skill yet; the Reviewer gets one in the next PRD).
- **Its runners:** the runners an owner gives to the Virtual Fleet on the Runners page, as today
  for any fleet; with none, any runner of the workspace that holds the repository.

### 1. The mission and its brief

A **mission** is a goal, not a container:

- **goal:** one sentence: what changes, and for whom;
- **measures:** 1 to 5 observable signs it worked once deployed, each with how it is read and a
  target (recorded now; following them after deployment is a later PRD);
- **fleet:** the Virtual Fleet that takes it: its heroes are the mission's team, and its jobs go to
  that fleet's runners;
- **scope:** PRDs and/or roadmaps of this repository, in any mix (one PRD, four PRDs, a roadmap, two
  roadmaps…);
- **mandate:** how many PRDs may run at once (`parallel`, 1 to 4, 2 by default), and the fixed rules:
  it never merges, never answers for a person, and waits for a person wherever one is needed.

**`/omni:mission`**, a new skill a person runs (the lead's seat, a person's today), settles the Virtual Fleet,
the goal, measures, scope and mandate in a conversation, as `/omni:brainstorm` does, then writes the brief.
**`/omni:mission --prd <n> '<goal>'`** makes a minimal mission in one line: no conversation, that
PRD as its scope, the goal as given, no measure yet, the default mandate, and the workspace's only
Virtual Fleet (with several, it asks which one: its one question).

A mission is numbered by its GitHub issue (as a concept is), and lives in two places:

- **its page on the Omni app**, a dossier of kind `mission`, every version kept: the source of
  truth while it runs. `omni mission push <n>` sends `mission.md` and `mission.html` there.
- **the repository**, as plain files, `.omni-loop/delivery/missions/<nnnn>-<slug>/mission.md`
  (front matter: `mission`, `title`, `fleet`, `goal`, `measures`, `scope`, `mandate`, Zod-checked by
  `kit/lib/mission/brief.ts`) and `mission.html` (the brief, self-contained, under the
  before/after page rules), through a docs PR the skill opens and a person merges whenever.
  **Starting never waits for that merge.**

### 2. The mission's record

- `teams.kind` (`crew`, the default, or `virtual`) and `virtual_heroes` (fleet, name, role, skills,
  agent, model, limits, position, timestamps).
- `missions` (one row per mission: workspace, repository, fleet, number, title, goal, measures, scope,
  mandate, `status`, `waiting_on`, `started_by`, `next_wake_at`, timestamps) and `mission_events`
  (append only: `mission_id`, `at`, `role` (`pm`, `engineer`, `architect`, `qa`, `reviewer`,
  `supervisor`), `actor` (`agent` or a member's login), `kind` (`started`, `paused`, `resumed`,
  `dispatched`, `job-ended`, `waits`, `prd-ready`, `prd-merged`, `held`, `stopped`, `delivered`),
  `prd`, `job_id`, `link`, `sentence`). No credential, no transcript, no log excerpt.
- A **status**: `draft`, `running`, `waiting` (on a person: approve, answer or merge, named in
  `waiting_on`), `paused`, `delivered`, `stopped` (why, and how to resume).
- `runner_jobs.mission_id` and `runner_jobs.mission_key` (unique) tie a job the mission sent to it.
- A member of the mission's workspace reads its rows; only the service role writes them.

### 3. The supervisor

A kind `mission` on the App's job ledger (ADR-0123), in a lane per mission so one run of a mission
happens at a time. Plain code: no model call, no runner slot while it waits.

**When it runs:** at once when a person presses Start or Resume, when one of its jobs reports an
end, when one of its PRDs changes stage, and when an answer is given on one of its PRDs (each calls
`background_job_wake`); and otherwise every minute while it is `running` or `waiting` (its run ends
`later`, due a minute on).

**Each run, in order:**

1. **Check first.** Read its jobs and their outcomes, and each PRD of its scope: approved or not,
   its stage (`prd_stages`), whether its feature PR is ready or merged. A roadmap in scope expands
   into its `roadmap_prds` rows, blockers included.
2. **Pick.** A PRD may start when its approval stands (a changed approved file voids it: the PRD
   waits for a new approval), not merged, every blocker merged, no job of it
   queued or running, and nothing of it waits on a person; and when its plan's territories meet
   none of the running PRDs' (read from the plan on its page with the kit's plan parser; a PRD with
   no plan runs alone). At most `mandate.parallel` run at once.
3. **Send.** `/omni:yolo <prd>`, the Engineer hero's work, to the mission's Virtual Fleet (its
   runners, else any runner of the workspace holding the repository), sent by the app (`sent_by_app`), never
   in a person's name, under `mission_key = mission:<id>:prd:<n>:run:<k>`: a replay or a run at the
   same moment inserts nothing twice.
4. **Record** each decision as a mission event, and set `next_wake_at`.

**When a job ends:**

| outcome | the mission |
| --- | --- |
| Ready | the PRD reads ready for review and waits for a person to merge it |
| Waiting on answers | waits for a person; the page's auto-fix (PRD 2270) carries on once answered |
| Held, Stopped mid-way | sends the PRD again once (`run:2`); a second time stops that PRD and says why |
| Runner lost | PRD 2809's resume carries it; the mission only records it |
| Cancelled | never sent again; that PRD is paused |
| Failed (another reason) | stops that PRD and says why |

A PRD merged counts as delivered; the mission reads **Delivered** when every PRD of its scope is.

**Pause** sends nothing new; running jobs finish and their ends are recorded. **Resume** wakes it.

### 4. The Fleet's tabs

The sidebar's **Fleet** entry, on a Virtual Fleet, shows tabs **Operation room · Missions · Heroes ·
Board**; on an ordinary fleet it shows today's board, unchanged.

- **Missions:** each mission's goal, status and progress (`2 of 4 merged · 1 ready`, and
  which PRD waits on you), its brief linked; **Start** on a draft, **Pause**, **Resume**; a PRD
  that waits for a person says on what (approve, answer, merge) and links it.
- **Heroes:** each hero's sprite, name, role, skills, agent and model, limits, and whether it works
  alone or a person does it today, with why.
- **Operation room:** one now line per hero (a working hero reads what it is doing, `Engineer · agent:
  building PRD 2803`, else `Idle`; a hero that cannot work alone reads `A person does this today`); the
  clean-up line (PRD 2809's kept saves); the **ledger**: the missions' events, newest first, each
  with its time, the role's mark and name (`Engineer · agent`, `Supervisor · agent`, or a member's
  name), one sentence, its link and a state word, filtered by role and by mission in the address.
  One motion: a new row slides in at the top, never on load, none under reduced motion.
- No first name for an agent, no standup, no narration: every row is a real record (the person's
  rule at the crown of concept #2800).

## Conventions

| repo | layer | name | source |
| --- | --- | --- | --- |
| vertuo-omni-loop | db | `missions`, `mission_events`, `runner_jobs.mission_id`, `runner_jobs.mission_key` | no written convention: follows `roadmaps` ← `supabase/migrations/20261110090000_roadmaps.sql` |
| vertuo-omni-loop | db | dossier kind `mission`, version kinds `mission-record`, `brief` | dossier kinds ← `supabase/migrations/20261119090000_concept_dossiers.sql:47` |
| vertuo-omni-loop | db | `supabase/migrations/<next free version>_missions.sql` | conventions › A new migration takes the next free version |
| vertuo-omni-loop | job | `mission` (App job kind) | job kinds ← `apps/omni-app/src/jobs/payloads.ts` |
| vertuo-omni-loop | kit | `kit/lib/mission/`, `kit/bin/commands/mission.ts` (`omni mission push`) | no written convention: follows `kit/lib/concept/` and `kit/bin/commands/concept.ts` |
| vertuo-omni-loop | skill | `kit/plugin/skills/mission/SKILL.md` (`/omni:mission`) | no written convention: follows `kit/plugin/skills/brainstorm/` |
| vertuo-omni-loop | ui | `apps/galaxy/src/missions/` (contract, client, controller, service, repository) | ADR-0095 layering ← `.omni-loop/knowledge/playbook/architecture.md` |
| vertuo-omni-loop | files | `.omni-loop/delivery/missions/<nnnn>-<slug>/` | no written convention: follows `.omni-loop/delivery/inbox/concepts/` |

## Decisions

- **A mission is a goal, measurable, with a brief in HTML, and any mix of PRDs and roadmaps:** the
  person's own words, replacing the concept's "one mission per approved roadmap".
- **The supervisor decides how many PRDs run at once,** as waves do for slices (blockers, no shared
  ground, a limit in the mandate): the person's call, replacing the concept's "one execution job at
  a time per mission". Fleet-wide capacity stays for area `fleet-capacity`.
- **Missions are for Virtual Fleets** (the person, after the first design): a Virtual Fleet is a
  new kind of fleet made of Virtual Heroes; a hero is a role with its skills; a new one starts with
  all five roles; a mission names its fleet when it is written. Ordinary fleets hiring heroes is
  later. The concept's "seats" become heroes, and the Seats tab the Heroes tab.
- **Any member creates a Virtual Fleet** (the person's answer; a players' fleet stays an owner's), and
  it is **created from the Fleet section, in a drawer, name first, then icon, then the roles as yes/no
  switches, all on by default** (the person's review of the first before/after, which also asked
  that today's side say plainly the Fleet section cannot create a fleet at all). The colour is
  picked for it so the drawer asks only the three things the person named.
- **A hero's name is never a person's first name** ("an agent is not a human", the crown of concept
  #2800); by default it is its role.
- **One job is `/omni:yolo <prd>`;** the slices stay `/omni:yolo`'s.
- **The brief is written by a skill, `/omni:mission`,** run with a person; the PM agent takes that
  seat in a later PRD.
- **Start at once, then a check every minute:** the person found 5 minutes too slow; Start, Resume,
  job ends, stage changes and answers wake the mission immediately, and a minute's check catches a
  missed wake. A check reads only Omni's database.
- **The area is split in two PRDs:** this one, and the Reviewer next (its skill, its gate before a
  PR goes ready, and its glossary entry). Until then `/omni:yolo` marks ready as today.
- **The voice.** persona:Irisa objected: "Another skill and another page before anything gets
  built. For a quick win I just want to hand over a PRD and go." Settled `accepted`:
  `/omni:mission --prd <n> '<goal>'` makes a minimal mission in one line.
- **No proof video:** the person said no; the fake-fleet tests are the proof.
- **The concept's Areas table:** the `unlosable-jobs` row was written with an extra cell by PRD
  2809's brainstorm (`|| #2809 |`); this PRD's commit repairs it while it fills `room-and-reviewer`.

## User stories

- As Paul, I write a mission for "every quote can be paid online" over two roadmaps, press Start on
  Friday, close the laptop, and on Monday the Missions tab reads `3 of 6 PRDs merged · 2 ready for
  review · 1 waits on you`.
- As Irisa, I type `/omni:mission --prd 2803 'dark mode for quotes on site'`, press Start, and the
  quick win goes to the fleet at once.
- As the Lead Engineer, I open the Operation room and read who did what overnight, each row signed
  by its role, and filter it to the Engineer seat.
- As the B-E DEv, I see that two of a mission's PRDs never ran on the same files at once.

## Scope

In: the Virtual Fleet (kind, heroes, the default team, `+ New virtual fleet` and its drawer in the
Fleet section, the Heroes tab); the brief (`/omni:mission`, `--prd`, `mission.md`, `mission.html`, `omni mission push`, the
dossier kind); the records (`teams.kind`, `virtual_heroes`, `missions`, `mission_events`, the job
columns); the supervisor kind and
its wakes; Start, Pause, Resume; the Fleet's tabs with Missions and the Operation room; the tests.

Out: ordinary fleets hiring Virtual Heroes; routing a job to the hero's agent and model; the
Reviewer and any review gate; following the measures after deployment; fleet-wide capacity
and provider waits; the PM, Architect and QA heroes working alone; missions across
repositories.

## Test seams

- **The fleets:** `supabase/checks/virtual_fleets.sql`: an owner creates a virtual fleet with its five
  heroes, a member reads them, others nothing; the arcade's fleet list for players leaves it out.
- **The database:** `supabase/checks/missions.sql` (its own step of the `supabase` workflow, added by
  a person if the build app may not push workflow files): members read their missions and events,
  others nothing, nobody signed in writes; a second job with the same `mission_key` is refused;
  `mission_events` refuses an update or a delete.
- **The supervisor:** `apps/omni-app/src/missions/supervisor.test.ts`, pure functions over read
  state and a fixed clock: pick (approval, blockers, overlap, limit), the outcome table, Pause,
  Delivered.
- **The kind:** `apps/omni-app/src/missions/job.test.ts` on the ledger's fake store: Start wakes and
  dispatches at once; a replayed or concurrent run inserts no second job; `later` a minute on.
- **The kit:** `kit/lib/mission/brief.test.ts` (the front matter and the page rules) and
  `kit/bin/mission.test.ts` (`omni mission push`, on a fixture repository with `makeRepo()`).
- **The pages:** `apps/galaxy/src/missions/*.test.ts` (service, render) for the tabs and the ledger's
  words; the screens' mockups pass the word pass.
- **End to end, a fake fleet:** `apps/omni-app/src/missions/mission.e2e.test.ts`: a two-roadmap
  mission with blockers and an overlapping plan runs to Delivered against an in-memory database and
  fake runner outcomes, with no model call.

## Risks

- **What merging publishes:** a migration on production (`missions`, `mission_events`, two
  `runner_jobs` columns, the dossier kind), the App's new job kind, the arcade's Fleet tabs and API,
  and the kit (`/omni:mission`, `omni mission`). A mission sends real `/omni:yolo` jobs once a person
  presses Start. Rolled back by reverting the PR (no mission can then run) and a migration dropping
  the tables and columns.
- **Runaway work:** the mandate caps parallel PRDs, a held PRD is sent again once only, a cancel is
  never retried, and Pause stops all new jobs.
- **The Legal entries:** L-AIACT-1 (agent content says so: jobs are sent by the app and every agent
  row is signed `· agent`); L-GDPR-1 (only the workspace's members read its missions and events);
  L-GDPR-2 (no credential in a mission, its events or a job line); L-GDPR-4 (mission events record
  decisions and are kept; they hold no log excerpt).
- **The locked laws:**
  - N-PRODUCT-15: if broken, unreviewed work reaches every user, and nobody chose to ship it. Kept: a
    mission never merges; ready waits for a person. Changing it needs @pierrederval or @dervalp to
    approve the pull request on GitHub.
  - BR-PRODUCT-12: if broken, the terminal acts on words the person no longer stands behind. Kept:
    the mission reads answers and never changes one.
  - BR-PRODUCT-63: if broken, an agent could read another team's private work. Kept: a mission only
    reads and sends for its own workspace's repository.
  - Rules BR-PRODUCT-46 and BR-PRODUCT-47 (a fleet's mascot from the eleven keys; a fleet's key from
    its label) hold for a Virtual Fleet as for any. N-PRODUCT-16 (the game's ledger is only added to)
    is kept: a Virtual Fleet earns nothing on the ledger and no hero is a player.
  - BR-PRODUCT-28, BR-PRODUCT-29, BR-PRODUCT-39, BR-PRODUCT-59, BR-PRODUCT-64, N-PRODUCT-16: printed
    for the database layer; the design keeps each (no membership, ask session, AI key, agent link or
    game ledger row is read or written).
- **The business laws:** BL-APPROVALS-1 (an approval covers exactly the files the approver read;
  any later change voids it, and the build waits for a new one) is kept: a mission sends a PRD only
  while its approval stands; once an approved file changes, that approval is void, the PRD reads
  `waits on you: approve it again`, and the mission sends it only after a member approves it anew.
  BL-ASK-1 (an answer a person gave is never changed) is kept: a mission never stores, changes or
  rewords a person's answer, review or approval; its events only link to them and say that the person
  answered, approved or merged, and when. A mission's own rows are signed by their role, never in a
  person's name.

## Acceptance criteria

- The Fleet section shows `+ New virtual fleet` after its fleet chips, and as its main button when the
  workspace has no fleet; it opens a drawer whose fields are, in order, Name (focused), Icon (the
  fleet mascots, the first selected) and Heroes (five yes/no switches, all on).
- Create fleet makes a fleet of kind `virtual` with the heroes left on, each with its role's skills,
  a key from its name and a free colour, and lands on its Operation room; a name already used in the
  workspace is refused under the field; with every switch off, Create fleet is disabled.
- The arcade's select screen never offers a virtual fleet; a hero is removed or added in the Heroes
  tab.
- The Heroes tab shows each hero's sprite, name, role, skills, agent and model, limits, and `Works
  alone` or `A person does this today` with why; no hero shows a person's first name.
- `/omni:mission` and `--prd` record the mission's Virtual Fleet, and its jobs go to that fleet's
  runners (any runner of the workspace when it has none).

- `/omni:mission` writes `mission.md` and `mission.html` under
  `.omni-loop/delivery/missions/<nnnn>-<slug>/`, its front matter read by the kit's schema (goal, 1
  to 5 measures, scope, mandate), and `omni mission push <n>` puts both on the mission's page.
- `/omni:mission --prd <n> '<goal>'` makes a mission with that PRD as its scope, no measure, and the
  default mandate, with no question asked.
- Start on a draft mission sends `/omni:yolo` for each startable PRD within the same run, and its
  ledger shows `Supervisor · agent` dispatch rows.
- On every run the mission checks each PRD's approval again against its approved files; a PRD is
  not sent while it has no standing approval (none yet, or voided by a changed file), a blocker is
  not merged, its plan meets a running PRD's
  territory, or `mandate.parallel` PRDs already run; it is sent on the run after that changes.
- Two runs of the same mission at once, or a replay, insert one job, never two.
- Ready leaves the PRD waiting for a person's merge; a merge sends the PRDs it unblocks within a
  minute; Held is sent again once, then the PRD stops with why; Cancelled is never sent again.
- Pause sends nothing new and running jobs' ends are still recorded; Resume sends at once.
- The mission reads Delivered only when every PRD of its scope is merged.
- On a Virtual Fleet, the Fleet's tabs read Operation room · Missions · Heroes · Board (an ordinary
  fleet keeps today's board); Missions shows each mission's goal,
  status, progress and what each waiting PRD waits on; the Operation room shows one now line per hero, the
  clean-up line and the ledger, filtered by role and by mission.
- No mission event or job line holds a credential, and every agent row is signed `· agent`.
- A mission never stores, changes or rewords a person's answer or approval: its events link to them,
  and a person's own row carries only that they answered, approved or merged, and when.
- Every test above runs on a fake fleet and an in-memory database, with no model call.
