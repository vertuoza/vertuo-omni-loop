# Plan: AI Fleet, its own menu entry and the runners each fleet runs on

PRD #3233, its spec in `spec.md` beside this plan. The feature branch `feat/ai-fleet` goes into `main`
through the feature PR (`Closes #3233`); each slice is a sub-PR from `feat/ai-fleet--<slice>` into the
feature branch (`Part of #3233`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | Each job knows its mission and role: `missionId` and `role` on `Job`, the role from `mission_key` through `missionJobRole`, held equal to `public.mission_job_role` | `apps/galaxy/src/runners/` | — | 1 | build |
| s5 | Nobody reads "Virtual Fleet": the skills, help, guide, missions, Commander, Heroes and drawer words say AI Fleet, and mission links point at `/app/ai-fleet` | `apps/galaxy/src/missions/` `apps/galaxy/src/virtual-fleets/commander/` `apps/galaxy/src/virtual-fleets/heroes/` `apps/galaxy/src/virtual-fleets/drawer/` `apps/galaxy/src/virtual-fleets/ai-fleet-words` `apps/omni-app/src/missions/` `kit/plugin/skills/mission/` `kit/plugin/skills/committee/` `kit/lib/help/` `kit/lib/virtual-fleet/` `kit/lib/mission/` `docs/guide/` | — | 1 | light |
| s2 | The fleet's runners view: its own runners, the Shared runners running its work, the jobs waiting for a slot, each job with its role, status and time, and every edge state's words | `apps/galaxy/src/virtual-fleets/runners/runners-view` | s1 | 2 | build |
| s3 | AI Fleet in the main menu and its list at `/app/ai-fleet`; an AI fleet's page moves there, Fleet keeps the players' fleets, old links redirect | `apps/galaxy/src/nav/sidebar` `packages/design/src/sprites` `apps/galaxy/app/app/ai-fleet/` `apps/galaxy/app/app/fleet/` `apps/galaxy/src/virtual-fleets/list/` `apps/galaxy/src/dashboard/fleet/` | s2, s5 | 3 | build |
| s4 | The Runners tab and the Runs on line on an AI fleet's page | `apps/galaxy/src/virtual-fleets/runners/RunnersTab` `apps/galaxy/src/virtual-fleets/runners/RunsOn` `apps/galaxy/src/virtual-fleets/runners/runners-tab` `apps/galaxy/src/dashboard/fleet/` `apps/galaxy/app/app/ai-fleet/` | s3 | 4 | build |

Shared ground: `apps/galaxy/src/dashboard/fleet/` (the tabs, `FleetScreen`, the picker) and
`apps/galaxy/app/app/ai-fleet/` are declared by s3 and s4; s4 waits for s3 (waves 3 and 4). s5 renames
the words of the drawer s3 then places on the list: s3 waits for s5, so the button lands already
renamed. `apps/galaxy/src/virtual-fleets/runners/` is split by file prefix between s2 (the view) and
s4 (the tab and the line). The generated `kit/dist/` and `apps/omni-app/api/` are rebuilt by the wave,
never committed by a slice.

## Per slice: done when

**s1** (`ui: yes`)
- `Job` carries `missionId: string | null` and `role` (`pm`, `engineer`, `qa`, `reviewer`, `architect`,
  `supervisor`, or `null`); the repository selects `mission_key`; a job of no mission reads both as `null`
  (AC-7).
- `missionJobRole` returns the role for every key shape `public.mission_job_role` names, and a test
  reading the migration's `case` fails when the two drift.
- The Runners page and the terminal's reads still pass their tests unchanged.

**s5** (light: wording and two link builders) (`ui: yes`)
- A test (`virtual-fleets/ai-fleet-words.test.ts`) finds no "Virtual Fleet" (any case) in the app's
  screens and messages, the skills' text, the help or the guide; past PRDs and migrations are not
  searched (AC-9).
- The New virtual fleet drawer reads `New AI fleet`; the Commander, Heroes, Missions and room words say
  AI fleet.
- A mission's answer link (`apps/omni-app/src/missions/landing.ts`) and the Commander's and rail's links
  are built on `/app/ai-fleet?fleet=…`, the rest of the query unchanged.
- The commands and what the skills do are unchanged. The glossary entry (AI Fleet, avoid Virtual Fleet)
  is written on the product's page by a person through `/omni:knowledge-add`, not by this slice.

**s2** (`ui: yes`)
- A pure `fleetRunnersView(board, fleet, missionIds, now)` returns its own runners (with state, slots,
  repositories, health and the fleet's jobs), the Shared runners running a job of its missions with
  `n for <fleet>` and `No runner of <fleet> holds <repo>`, and its queued jobs with their reason.
- A job is the fleet's when it was sent to the fleet or belongs to one of its missions.
- Each edge state reads its words: `No runner of its own.`, `No runner in this workspace.`,
  `Offline, <n> ago` with `<k> jobs wait for <runner>.`, `Waits for <runner>: <used> of <slots> busy`,
  `Out of tokens until hh:mm`, `Cannot run: <reason>`.
- A demo board in the same file family gives the render tests of s3 and s4 their Orion, Nova and Atlas.

**s3** (`ui: yes`)
- The sidebar shows AI Fleet right under Inbox, with the `menu-ai-fleet` sprite and no badge;
  `/app/ai-fleet` falls under it and its trail reads `AI Fleet`, a fleet's `AI Fleet › <name>` (AC-1).
- `/app/ai-fleet` lists every AI fleet with its heroes, mission line, waits on you and Runs on, from one
  read of the board (AC-2), and shows `No AI fleet yet.` with `New AI fleet` when there is none.
- `/app/ai-fleet?fleet=<name>` shows today's tabs of the fleet; `/app/fleet`'s picker lists only the
  players' fleets, with no New virtual fleet button; `/app/fleet?fleet=<an AI fleet>` redirects there
  with every other query kept (AC-8).
- The page matches screens 1.A, 2.A, 2.B, 3.A and 3.B of `before-after.html`.

**s4** (`ui: yes`)
- An AI fleet's tabs read Operation room · Missions · Heroes · Runners · Board · Commander; `?tab=runners`
  opens the Runners tab.
- The Runners tab draws the s2 view: its own runners, Shared runners running its work, Waiting for a
  slot, each job with role, PRD, status and time, `Answer` on a job waiting on the viewer opening the
  Need human drawer, and `Terminal` on each runner (AC-3, AC-4, AC-5, AC-6).
- The Runs on line shows under the fleet's name on every tab, each runner linking to the Runners tab.
- The tab matches screens 4.A to 4.E of `before-after.html`.
