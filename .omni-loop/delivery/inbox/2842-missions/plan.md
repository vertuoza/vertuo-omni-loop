# Plan: Missions the fleet delivers with the laptop closed

PRD #2842, its spec beside this plan (`spec.md`). The feature branch `feat/missions` goes into `main`
through one draft feature PR (`Closes #2842`); each slice is a sub-PR from `feat/missions--<slice>`
into the feature branch (`Part of #2842`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | Any member creates a Virtual Fleet from the Fleet section: `+ New virtual fleet` opens a drawer (name, icon, five role switches all on), Create fleet makes the fleet with its heroes and lands on it; the arcade never offers it to players | `supabase/migrations/20270122090000_virtual_fleets.sql` `supabase/checks/virtual_fleets.sql` `.github/workflows/supabase.yml` `supabase/database.types.ts` `apps/galaxy/src/dashboard/fleet/` `apps/galaxy/src/virtual-fleets/` `apps/galaxy/app/api/virtual-fleets/` `kit/lib/virtual-fleet/` `.omni-loop/knowledge/design/screens/fleet-new.` | — | 1 | deep |
| s2 | A mission's brief reaches its page as a draft mission of a Virtual Fleet: the brief's schema, `omni mission push`, the dossier kind `mission`, and the `missions`, `mission_events` and job columns behind it | `kit/lib/mission/` `kit/bin/commands/mission.` `kit/bin/mission.` `kit/bin/omni.` `supabase/migrations/20270122093000_missions.sql` `supabase/checks/missions.sql` `.github/workflows/supabase.yml` `supabase/database.types.ts` `apps/galaxy/src/dossier/store.` `apps/galaxy/src/missions/missions.` | s1 | 2 | deep |
| s3 | `/omni:mission` settles the Virtual Fleet, goal, measures, scope and mandate with a person, or in one line with `--prd`, writes `mission.md` and `mission.html`, opens its docs PR and pushes it | `kit/plugin/skills/mission/` `kit/plugin/skills/help/` `docs/guide/missions.md` | s2 | 3 | build |
| s4 | The supervisor: a `mission` kind on the App's job ledger checks first, picks the startable PRDs within the mandate, sends the Engineer hero's `/omni:yolo` to the mission's fleet under a key that never repeats, records each decision and wakes a minute on | `apps/omni-app/src/missions/` `apps/omni-app/src/jobs/pr-checks.` `apps/omni-app/src/jobs/payloads.` | s2 | 3 | deep |
| s5 | Start, Pause and Resume, and the wakes: a person's Start or Resume, a job's end, a stage change and an answer wake the mission at once | `apps/galaxy/app/api/missions/` `apps/galaxy/src/missions/missions.` `apps/galaxy/src/runners/runners.` | s2 | 4 | build |
| s6 | A Virtual Fleet's tabs and its Heroes tab: each hero's sprite, name, role, skills, agent and model, limits, and whether it works alone; add or remove a hero | `apps/galaxy/app/app/fleet/` `apps/galaxy/src/dashboard/fleet/` `apps/galaxy/src/virtual-fleets/heroes/` `.omni-loop/knowledge/design/screens/fleet-frame.` `.omni-loop/knowledge/design/screens/fleet-seats.` | s1 | 2 | build |
| s7 | The Missions tab: each mission's goal, status, progress and what it waits on, with Start, Pause and Resume | `apps/galaxy/app/app/fleet/` `apps/galaxy/src/missions/page/` `.omni-loop/knowledge/design/screens/mission-start.` | s5, s6 | 5 | build |
| s8 | The Operation room tab: one now line per hero, the clean-up line and the ledger of mission events, filtered by role and by mission | `apps/galaxy/app/app/fleet/` `apps/galaxy/src/missions/room/` `.omni-loop/knowledge/design/screens/fleet-room.` | s7 | 6 | build |
| s9 | A fake fleet runs a two-roadmap mission with blockers and an overlapping plan to Delivered, with no model call | `apps/omni-app/src/missions/mission.e2e.` | s4, s5 | 5 | build |

**Shared ground.**

- `supabase/database.types.ts` and `.github/workflows/supabase.yml`: s1 and s2, waves 1 and 2.
- `apps/galaxy/src/missions/missions.` (the contract, service and repository): s2 and s5, waves 2
  and 4.
- `apps/omni-app/src/missions/`: s4 owns the folder; s9 adds `mission.e2e.test.ts` in it after s4
  merged (waves 3 and 5).
- `apps/galaxy/app/app/fleet/`: s6, s7 and s8, waves 2, 5 and 6.
- The build app may not push workflow files: s1 and s2 each raise an outbox item asking a person to
  add their check's step, as PRD 2809's s1-01 did.
- `kit/dist/` and `apps/omni-app/api/` are generated: rebuilt by the wave, in no territory.
- Each migration is dated after `main`'s newest when its slice is marked ready
  (`node scripts/migration-order.ts`), and re-dated in every path that names it.

## Per slice: done when

### s1 (deep: a new kind of fleet beside the game's own, which must never reach a player) (`ui: yes`)

- `teams.kind` (`crew` by default, or `virtual`) and `virtual_heroes` (fleet, name, role, skills,
  agent, model, limits, position) exist; a member of the workspace reads them and, through a
  security-definer function, creates a virtual fleet and its heroes; a players' fleet stays an
  owner's.
- `/app/fleet` shows `+ New virtual fleet` after the fleet chips, and as its main button when the
  workspace has no fleet; it opens the drawer (the Need human drawer's pattern): Name first and
  focused, Icon (the fleet mascots, the first selected), Heroes (five yes/no switches, all on, each
  saying whether it works alone), Cancel and Create fleet.
- Create fleet makes the fleet (key from its name, BR-PRODUCT-47; mascot from the list,
  BR-PRODUCT-46; the next free fleet colour, BR-PRODUCT-27) with the heroes left on, each with its
  role's skills from `kit/lib/virtual-fleet/roles.ts`, and lands on the fleet; a name already used in
  the workspace reads `Name taken: choose another` under the field; with every switch off, Create
  fleet is disabled.
- No hero is a player, earns on the ledger, or appears on the arcade's select screen.
- `supabase/checks/virtual_fleets.sql` proves the rows' rules (its workflow step an outbox item when
  the push is refused); `supabase/database.types.ts` is regenerated; the `fleet-new` draft screen and
  its mockup match the drawer; the word pass finds nothing.

### s2 (deep: a migration, an append-only table and a unique dispatch key)

- `kit/lib/mission/brief.ts` reads `mission.md`'s front matter with Zod: `mission`, `title`,
  `fleet` (a Virtual Fleet of the workspace), `goal`,
  1 to 5 `measures` (each a sign, how it is read and a target), `scope` (PRDs and/or roadmaps of
  the repository, at least one), `mandate` (`parallel` 1 to 4, default 2); a malformed brief is
  refused, naming the field.
- `omni mission push <n>` sends `mission.md` and `mission.html` to the mission's page (a dossier of
  kind `mission`, versions `mission-record` and `brief`), which creates or updates a `missions` row
  in `draft`; a second push of unchanged files adds nothing.
- `missions`, `mission_events` (append only: an update or a delete is refused) and
  `runner_jobs.mission_id`, `runner_jobs.mission_key` (unique) exist; members of the workspace read,
  only the service role writes.
- `supabase/checks/missions.sql` proves each line above; `supabase/database.types.ts` is
  regenerated; the step for the workflow is an outbox item when the push of the workflow is refused.

### s3

- `/omni:mission` asks the Virtual Fleet (none asked when the workspace has one), the goal, the measures, the scope and the mandate one question at a time,
  writes `.omni-loop/delivery/missions/<nnnn>-<slug>/mission.md` and `mission.html` (self-contained,
  under the before/after page rules, marks and word pass included), opens the mission's issue and
  its docs PR, and runs `omni mission push`.
- `/omni:mission --prd <n> '<goal>'` asks nothing and writes the minimal mission.
- The help skill lists it; `docs/guide/missions.md` says what a mission is and how to start one.

### s4 (deep: the decisions a mission takes alone)

- A pure `pick` reads the mission, its PRDs' approvals (voided by a changed approved file), stages,
  blockers, plans' territories and running jobs, and returns the PRDs to send, at most
  `mandate.parallel` running; a PRD with no plan runs alone.
- A pure `outcome` maps each job end to the mission's next state (the spec's table).
- The `mission` kind runs in lane `mission:<id>`, inserts `/omni:yolo <prd>` jobs `sent_by_app`,
  addressed to the mission's Virtual Fleet (its runners, else any runner of the workspace), with
  `mission_key = mission:<id>:prd:<n>:run:<k>`, records one event per decision, sets `status`,
  `waiting_on` and `next_wake_at`, and ends `later` a minute on while running or waiting.
- A replay or two runs at once insert one job; Pause sends nothing; Delivered only when every PRD
  is merged. Tested on the ledger's fake store with a fixed clock.

### s5

- `POST /api/missions/<id>/start`, `/pause` and `/resume`: a member of the workspace only; Start
  moves a draft to running, Pause to paused, Resume back; Start and Resume call
  `background_job_wake` for the mission, and each records its event signed with the member's login.
- A runner job of a mission that reports its end, a stage change of one of its PRDs, and an answer
  given on one of its PRDs each wake the mission.
- Service tests on realistic rows and a fixed clock; a non-member is refused.

### s6 (`ui: yes`)

- `/app/fleet` on a Virtual Fleet reads tabs Operation room · Missions · Heroes · Board; Board is
  today's fleet board, unchanged; an ordinary fleet shows only its board.
- Heroes shows each hero's sprite (from `@omni/design`, in the fleet's colour, at whole-number
  scales), name, role, skills, agent and model, limits, and `Works alone` or `A person does this
  today` with why; Add a hero for an owner.
- The `fleet-frame` and `fleet-seats` draft screens and their mockups match (the tab reads Heroes);
  the word pass finds nothing.

### s7 (`ui: yes`)

- Missions lists each mission's goal, status, `<k> of <n> merged · <r> ready`, and each waiting PRD
  with what it waits on (approve, answer, merge) and its link; Start on a draft, Pause, Resume.
- The `mission-start` draft screen and its mockup match; the word pass finds nothing.

### s8 (`ui: yes`)

- The Operation room shows one now line per hero of the fleet (a working hero reads what it does,
  `Engineer · agent: building PRD 2803`, else `Idle`; a hero that cannot work alone reads `A person
  does this today`), the clean-up line from PRD 2809's
  kept saves, and the ledger of mission events, newest first, each with time, role mark and name,
  one sentence, link and state, filtered by role and by mission in the address.
- A new row slides in at the top once, never on load, none under reduced motion.
- The `fleet-room` draft screen and its mockup match; the word pass finds nothing.

### s9

- `apps/omni-app/src/missions/mission.e2e.test.ts` runs a mission of a Virtual Fleet over two roadmaps with a blocker
  and two PRDs whose plans share a territory: Start sends the startable ones at once, the
  overlapping one waits, a Ready waits for a merge, a merge sends what it unblocks, a Held is sent
  again once, and the mission reads Delivered when every PRD merged; no model call.
