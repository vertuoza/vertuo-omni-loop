# Plan: Missions the fleet delivers with the laptop closed

PRD #2842, its spec beside this plan (`spec.md`). The feature branch `feat/missions` goes into `main`
through one draft feature PR (`Closes #2842`); each slice is a sub-PR from `feat/missions--<slice>`
into the feature branch (`Part of #2842`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A mission's brief reaches its page as a draft mission: the brief's schema, `omni mission push`, the dossier kind `mission`, and the `missions`, `mission_events` and job columns behind it | `kit/lib/mission/` `kit/bin/commands/mission.` `kit/bin/mission.` `kit/bin/omni.` `supabase/migrations/20270122090000_missions.sql` `supabase/checks/missions.sql` `.github/workflows/supabase.yml` `supabase/database.types.ts` `apps/galaxy/src/dossier/store.` `apps/galaxy/src/missions/missions.` | — | 1 | deep |
| s2 | `/omni:mission` settles goal, measures, scope and mandate with a person, or in one line with `--prd`, writes `mission.md` and `mission.html`, opens its docs PR and pushes it | `kit/plugin/skills/mission/` `kit/plugin/skills/help/` `docs/guide/missions.md` | s1 | 2 | build |
| s3 | The supervisor: a `mission` kind on the App's job ledger checks first, picks the startable PRDs within the mandate, sends `/omni:yolo` under a key that never repeats, records each decision and wakes a minute on | `apps/omni-app/src/missions/` `apps/omni-app/src/jobs/pr-checks.` `apps/omni-app/src/jobs/payloads.` | s1 | 2 | deep |
| s4 | Start, Pause and Resume, and the wakes: a person's Start or Resume, a job's end, a stage change and an answer wake the mission at once | `apps/galaxy/app/api/missions/` `apps/galaxy/src/missions/missions.` `apps/galaxy/src/runners/runners.` | s1 | 3 | build |
| s5 | The Fleet's tabs and the Missions tab: each mission's goal, status, progress and what it waits on, with Start, Pause and Resume | `apps/galaxy/app/app/fleet/` `apps/galaxy/src/dashboard/fleet/` `apps/galaxy/src/missions/page/` `.omni-loop/knowledge/design/screens/fleet-frame.` `.omni-loop/knowledge/design/screens/mission-start.` | s4 | 4 | build |
| s6 | The Operation room tab: five now lines, the clean-up line and the ledger of mission events, filtered by role and by mission | `apps/galaxy/app/app/fleet/` `apps/galaxy/src/missions/room/` `.omni-loop/knowledge/design/screens/fleet-room.` | s5 | 5 | build |
| s7 | A fake fleet runs a two-roadmap mission with blockers and an overlapping plan to Delivered, with no model call | `apps/omni-app/src/missions/mission.e2e.` | s3, s4 | 4 | build |

**Shared ground.**

- `apps/galaxy/src/missions/missions.` (the contract, service and repository): s1 and s4, waves 1
  and 3.
- `apps/omni-app/src/missions/`: s3 owns the folder; s7 adds `mission.e2e.test.ts` in it after s3
  merged (waves 2 and 4).
- `apps/galaxy/app/app/fleet/`: s5 and s6, waves 4 and 5.
- `.github/workflows/supabase.yml`: s1 only. The build app may not push workflow files: s1's outbox
  asks a person to add the `missions.sql` step, as PRD 2809's s1-01 did.
- `kit/dist/` and `apps/omni-app/api/` are generated: rebuilt by the wave, in no territory.
- The migration is dated after `main`'s newest when its slice is marked ready
  (`node scripts/migration-order.ts`), and re-dated in every path that names it.

## Per slice: done when

### s1 (deep: a migration, an append-only table and a unique dispatch key)

- `kit/lib/mission/brief.ts` reads `mission.md`'s front matter with Zod: `mission`, `title`, `goal`,
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

### s2

- `/omni:mission` asks the goal, the measures, the scope and the mandate one question at a time,
  writes `.omni-loop/delivery/missions/<nnnn>-<slug>/mission.md` and `mission.html` (self-contained,
  under the before/after page rules, marks and word pass included), opens the mission's issue and
  its docs PR, and runs `omni mission push`.
- `/omni:mission --prd <n> '<goal>'` asks nothing and writes the minimal mission.
- The help skill lists it; `docs/guide/missions.md` says what a mission is and how to start one.

### s3 (deep: the decisions a mission takes alone)

- A pure `pick` reads the mission, its PRDs' approvals (voided by a changed approved file), stages,
  blockers, plans' territories and running jobs, and returns the PRDs to send, at most
  `mandate.parallel` running; a PRD with no plan runs alone.
- A pure `outcome` maps each job end to the mission's next state (the spec's table).
- The `mission` kind runs in lane `mission:<id>`, inserts `/omni:yolo <prd>` jobs `sent_by_app` with
  `mission_key = mission:<id>:prd:<n>:run:<k>`, records one event per decision, sets `status`,
  `waiting_on` and `next_wake_at`, and ends `later` a minute on while running or waiting.
- A replay or two runs at once insert one job; Pause sends nothing; Delivered only when every PRD
  is merged. Tested on the ledger's fake store with a fixed clock.

### s4

- `POST /api/missions/<id>/start`, `/pause` and `/resume`: a member of the workspace only; Start
  moves a draft to running, Pause to paused, Resume back; Start and Resume call
  `background_job_wake` for the mission, and each records its event signed with the member's login.
- A runner job of a mission that reports its end, a stage change of one of its PRDs, and an answer
  given on one of its PRDs each wake the mission.
- Service tests on realistic rows and a fixed clock; a non-member is refused.

### s5 (`ui: yes`)

- `/app/fleet` reads tabs Operation room · Missions · Seats · Board; Board is today's fleet board,
  unchanged; Seats says it comes later.
- Missions lists each mission's goal, status, `<k> of <n> merged · <r> ready`, and each waiting PRD
  with what it waits on (approve, answer, merge) and its link; Start on a draft, Pause, Resume.
- The `fleet-frame` and `mission-start` draft screens and their mockups match; the word pass finds
  nothing.

### s6 (`ui: yes`)

- The Operation room shows five now lines (Engineer · agent while a job of it runs, else Idle; PM,
  Architect, QA and Reviewer read `A person does this today`), the clean-up line from PRD 2809's
  kept saves, and the ledger of mission events, newest first, each with time, role mark and name,
  one sentence, link and state, filtered by role and by mission in the address.
- A new row slides in at the top once, never on load, none under reduced motion.
- The `fleet-room` draft screen and its mockup match; the word pass finds nothing.

### s7

- `apps/omni-app/src/missions/mission.e2e.test.ts` runs a mission over two roadmaps with a blocker
  and two PRDs whose plans share a territory: Start sends the startable ones at once, the
  overlapping one waits, a Ready waits for a merge, a merge sends what it unblocks, a Held is sent
  again once, and the mission reads Delivered when every PRD merged; no model call.
