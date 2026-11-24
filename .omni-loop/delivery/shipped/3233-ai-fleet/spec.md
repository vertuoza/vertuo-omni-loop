---
prd: 3233
title: AI Fleet, its own menu entry and the runners each fleet runs on
blocked-by: none
spec: file
phase0: server
---

## Problem

The fleets that agents make up (Virtual Fleets in the code, PRD 2842) live inside Dashboard › Fleet,
mixed in the picker with the players' fleets of the season. A member who wants to follow them opens a
page built for the game, picks the fleet among the players' ones, and reads tabs that never say where
its work runs.

That last question has no answer on any fleet screen. The Operation room's now line says
`Engineer · agent: building PRD n` (`apps/galaxy/src/missions/room/room.ts:253`): no runner, no job.
To learn which runner builds a fleet's PRD, the member goes to Runners, scans the Runner table for the
fleet's name, then the Jobs table for the PRD in Line, matched against Where ("fleet label · runner
name", `apps/galaxy/src/runners/page/model.ts:192`). Each time.

And the fleet's own runners are not the whole story. A mission job goes to the fleet's runners only
when one of them holds the repository; otherwise it is queued for any Shared runner, one with no fleet
(`apps/omni-app/src/missions/store.ts:785`, the claim rule in
`supabase/migrations/20270125140000_mission_repairs.sql:242`). So "the runners whose fleet is X" hides
part of X's work.

The browser cannot tell either: a job's mission (`mission_id`, read but dropped by `jobOf`,
`apps/galaxy/src/runners/runners.service.ts:382`) and its role (`mission_key`, never selected) never
reach it.

## Solution

1. **AI Fleet, a main-menu entry.** The sidebar gains `AI Fleet`, right under Inbox, in the Inbox's
   unlabelled group, at `/app/ai-fleet`, with its own 16×16 sprite `menu-ai-fleet` (the robot head the
   mockup draws, in `@omni/design`). It carries no badge: the Runners entry already counts the jobs that
   wait for an answer. Dashboard › Fleet stays, for the players' fleets only.
2. **The AI Fleet list** (`/app/ai-fleet`, no `?fleet=`): the page's title `AI Fleet`, the line
   `<k> of <n> fleets wait on you`, and the `New AI fleet` button (today's New virtual fleet drawer,
   renamed). Under it, one row per AI fleet of the workspace:
   - **AI fleet:** its mascot and name in its colour, its heroes' roles;
   - **Mission:** the running mission's title, its progress bar and line (`3 of 6 merged · 2 ready`),
     `Goal only: PM writing PRDs` for a goal-only one, or `No mission yet.`;
   - **Waits on you:** the count and kind (`1 answer`, `1 approval`), or `Nothing`;
   - **Runs on:** each runner of the fleet's runners view (item 4) with its state dot, name and slots, a
     Shared runner marked `Shared`, and the view's one warning line when it has one (`No runner of its
     own`, `Its only runner is offline`);
   - **Open**, to the fleet.
   Under the list, `Players' fleets: Fleet`, linked. With no AI fleet, the page shows `No AI fleet yet.`
   and the button as its main action, as Fleet does today. The season place and rank are not shown:
   they belong to the players' fleets.
3. **An AI fleet's page** is `/app/ai-fleet?fleet=<name>` with today's tabs (`?tab=`), plus **Runners**,
   after Heroes: Operation room · Missions · Heroes · Runners · Board · Commander. The trail reads
   `AI Fleet › <name>`. Under the fleet's name, its mission line (title, `<k> of <n> merged`, `<k> waits on
   you`), then, on every tab, a **Runs on** line lists the view's runners (state dot, name, slots or
   `Shared, n job`), each linking to the Runners tab.
4. **The fleet's runners view** (new, pure, `virtual-fleets/runners/`), computed from the Runners board
   (`board()`, members only) and the fleet's mission ids:
   - **Its own runners:** every runner whose fleet is this fleet, each with its state, `used of slots`,
     its repositories, its health gauges and the fleet's jobs it runs now;
   - **Shared runners running its work:** every runner of another or no fleet that runs a job of one of
     the fleet's missions, marked `Shared`, `n for <fleet>` beside its slots, with the reason
     `No runner of <fleet> holds <repo>`;
   - **Waiting for a slot:** the fleet's queued jobs, each with its reason in a few words: `Waits for
     <runner>: <used> of <slots> busy`, `Waits for <runner>.` when it is offline, `Both runners paused`
     or `Every runner paused`, or `Cannot run: <reason>` (`cannotRunReason`).
   A job of the fleet is one sent to the fleet (`toFleet`) or one of its missions (`missionId`). Each job
   row shows its role (`Engineer`, `QA`, `Reviewer`, `PM`, `Architect`, `Supervisor`), its PRD or pull
   request with its title, its status in the Runners page's words and colours (`Running`, `Queued`,
   `Waiting on answers`, `Need human`), and how long it has been in that status. A job waiting on the
   viewer carries `Answer`, which opens today's Need human drawer; every runner row carries `Terminal`.
   Under the tab, `Give it a runner: Runners`, linked.
5. **The Runners tab's edge states,** in a few words each (the design form's word pass holds them to
   seven at rest), the runner states in the Runners page's own words (`stateWords`):
   - no runner of its own: `No runner of its own.`, then the Shared runners running its work;
   - no runner in the workspace: `No runner in this workspace.`, `Start one:` and
     `omni runner --name <name> --repos <dir>` (`START_COMMAND`);
   - its runners offline: `Offline, <n> ago`, muted, and `<k> jobs wait for <runner>.`;
   - every slot busy (`Waits for <runner>: <used> of <slots> busy`), every runner out of tokens (`Out of
     tokens until hh:mm`, from `waitingWords`' reset), and a job no runner can take (`Cannot run:
     <reason>`).
6. **Each job knows its mission and role.** The repository selects `mission_key` beside `mission_id`;
   `jobOf` adds `missionId` and `role` to `Job`, the role worked out from the key by `missionJobRole`, a
   TypeScript copy of `public.mission_job_role`, held equal to it by a test. A job of no mission reads
   both as `null`. No migration.
7. **Players' fleets stay on Fleet.** `/app/fleet`'s picker lists only the players' fleets, and its New
   virtual fleet button moves to AI Fleet. `/app/fleet?fleet=<an AI fleet>` (any `tab` kept) redirects to
   `/app/ai-fleet?fleet=<name>`, so every link written before still lands.
8. **The name.** "Virtual Fleet" becomes "AI Fleet" wherever a person reads it: the product's glossary
   (`AI Fleet`, avoid `Virtual Fleet`), the app's screens and messages, the skills' text and help, the
   guide. The code's names (`virtual-fleets/`, `VirtualOf`…), the database value `kind = 'virtual'` and
   every migration keep theirs.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | app | route `/app/ai-fleet` | no written convention: follows `/app/fleet` ← apps/galaxy/app/app/fleet/page.tsx:1 |
| vertuo-omni-loop | app | sidebar id `ai-fleet`, sprite `menu-ai-fleet` | no written convention: follows `SidebarId` and the `menu-*` sprites ← apps/galaxy/src/nav/sidebar.ts:19 |
| vertuo-omni-loop | app | tab id `runners` | no written convention: follows `FLEET_TABS` ← apps/galaxy/src/dashboard/fleet/tabs.ts:5 |
| vertuo-omni-loop | app | `Job.missionId`, `Job.role` | no written convention: follows `JobSchema`'s camelCase fields ← apps/galaxy/src/runners/runners.contract.ts:446 |
| vertuo-omni-loop | app | `missionJobRole(key)` | no written convention: copies `public.mission_job_role` ← supabase/migrations/20270128091000_commander_messaged.sql:174 |
| vertuo-omni-loop | app | `virtual-fleets/list/`, `virtual-fleets/runners/`, `FleetRunnersView` | no written convention: follows `virtual-fleets/heroes/` and `HeroesView` ← apps/galaxy/src/virtual-fleets/heroes/heroes.ts:47 |
| vertuo-omni-loop | design | glossary term `AI Fleet` (avoid `Virtual Fleet`) | `omni kb glossary` |

## Decisions

- **AI Fleet is an entry of its own, under Inbox** (asked, the person's words: "the Virtual Fleet should
  now be in the main menu and no more in the Fleet"). It sits in the Inbox's unlabelled group, since it
  is neither a board of the Dashboard nor a kind of Work.
- **No badge on AI Fleet** (taken alone, reversible): what waits on a person is already counted by Inbox,
  and the jobs waiting for an answer by Runners; a third count of the same things would double them.
- **The fleet's runners include the Shared runners running its work** (the senior AI engineer's
  finding): a mission job falls back to Shared runners when no runner of the fleet holds its
  repository, so the fleet's own runners alone would hide work.
- **The rename covers the words people read, not the code** (asked): the glossary, screens, messages,
  skills, help and guide say AI Fleet; code names, the database value and migrations stay. A later PRD
  may rename the code.
- **The voice objected** (persona:Lead Engineer, neutral: "If the screens say AI Fleet but the code, the
  database and the folders still say virtual, my team will keep using both names, and the confusion
  comes back through the code."). Settled `none`: the person kept the words-only rename; the glossary
  marks Virtual Fleet as the word to avoid, which is where the team reads it.
- **Old links redirect** (taken alone, reversible): `/app/fleet?fleet=<AI fleet>` redirects rather than
  breaking, so links in pull requests, missions and notifications keep working.
- **No proof video** (asked).
- **The approved mockup** is the before/after page's after; the screens follow the drafts `app-shell`,
  `fleet-frame` and `runners` of the screen library, none locked.

## User stories

- As a member, I open AI Fleet from the menu and see every AI fleet of the workspace, its mission, what
  waits on me and the runners it runs on, without opening Fleet or Runners.
- As a member following a fleet's mission, I read on the fleet's page which runner runs each of its jobs,
  in which role, for how long, and why a job waits.
- As a member, I see when a fleet's work runs on a Shared runner, and why.
- As a player, Fleet shows me the players' fleets of the season, and no fleet of agents.
- As a workspace owner, I learn from the fleet's page that it has no runner of its own, or that its runner
  is offline, and where to give it one.

## Scope

In: the sidebar entry and its sprite; `/app/ai-fleet` (the list, and a fleet's page with today's tabs and
the new Runners tab); the Runs on line; the fleet's runners view; `missionId` and `role` on `Job`; the
picker of `/app/fleet` and its redirect; the rename in the glossary, the app's words, the skills' text and
help and the guide; the screen library's drafts it draws.

Out: renaming code, folders, the database value or migrations; any change to how jobs are routed or
claimed; giving a runner to a fleet from the AI Fleet pages (it stays on Runners, owners only); the
Runners page itself, beyond its jobs carrying the two new fields.

## Test seams

- `apps/galaxy/src/runners`: `missionJobRole` against every key shape `public.mission_job_role` names, and
  a test that reads the migration's `case` and fails when the two drift; `jobOf` carries `missionId` and
  `role` (null for a job of no mission).
- `apps/galaxy/src/virtual-fleets/runners`: the pure view on fixture boards: own runners with their jobs;
  a Shared runner running a mission job, with its reason; a queued job with its reason; each edge state
  (no own runner, no runner at all, offline, every slot busy, out of tokens, cannot run).
- `apps/galaxy/src/virtual-fleets/list`: one row per AI fleet from fixtures (on a mission, goal only, no
  mission; waiting answers and approvals; runners) and the empty page.
- `apps/galaxy/src/nav/sidebar.ts`: AI Fleet under Inbox, `/app/ai-fleet` falls under it, the trail reads
  `AI Fleet › <name>`, and `badgeOf('ai-fleet')` is null.
- Render tests of the list, the Runs on line and the Runners tab, on the demo world.
- `/app/fleet`: the picker leaves AI fleets out, and an AI fleet's address redirects, its `tab` kept.
- A text test that no screen, message, skill or guide page the change touches says "Virtual Fleet".
- No test calls GitHub or needs `.env.local` (testing form).

## Risks

- **What merging publishes:** the arcade on Vercel (new route, sidebar, tab), and the kit's skill and
  help text through the next release. Rollback: revert the feature PR; nothing is stored or migrated,
  and the redirect goes with it, so old links read Fleet again.
- **A fleet's links move:** `/app/fleet?fleet=<AI fleet>` becomes a redirect. A link built by the Omni
  App (notifications, mission links) keeps landing through it; changing those builders to the new address
  is part of the change.
- **The Runners board is read once more,** for the list and the fleet's page. It is the members-only read
  the Runners page already makes (`board()`), so no new data is exposed; the list reads it once for every
  fleet, never once per row.
- **The Legal entries:** L-GDPR-1 (only a workspace's members read its personal data): the runners view
  is built from `board()`, which refuses a non-member, so another workspace's runners and jobs are never
  read. L-AIACT-1 (content an agent makes says so): every job row names its role as an agent's, never a
  person.
- **The locked laws:**
  - N-PRODUCT-15: if broken, unreviewed work reaches every user and nobody chose to ship it. Kept: the
    change adds screens and merges nothing. Changing it needs @pierrederval or @dervalp to approve the
    pull request on GitHub.
- **The business laws:**
  - BL-APPROVALS-1 (an approval covers exactly the files the approver read): kept; the change shows
    runners and jobs and touches no approval.
  - BL-ASK-1 (a person's answer is never changed or reworded afterwards): kept; `Answer` opens today's
    Need human drawer, which adds an answer and rewrites none.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: AI Fleet is its own menu entry
  Given a member of a workspace with two AI fleets
  When they open the app's menu
  Then AI Fleet is right under Inbox
  And opening it lists both AI fleets
  And Fleet's picker lists only the players' fleets
```

### AC-2 · test

```gherkin
Scenario: A row of the list says where the fleet runs
  Given the AI fleet Orion has runner orbit-1, busy with 3 of 3 slots
  And one job of Orion's mission runs on the Shared runner shared-mac-3
  When a member opens AI Fleet
  Then Orion's row shows orbit-1 "Busy, 3 of 3" and shared-mac-3 marked Shared
```

### AC-3 · test

```gherkin
Scenario: The Runners tab shows which runner runs each job
  Given Orion's Engineer builds PRD 412 on orbit-1 since 18 minutes
  When a member opens Orion's Runners tab
  Then orbit-1 is under Its own runners
  And its row shows Engineer, PRD 412, Running and 18 min
```

### AC-4 · test

```gherkin
Scenario: Work on a Shared runner says why
  Given no runner of Orion holds acme/storefront-api
  And Orion's job for that repository runs on shared-mac-3
  When a member opens Orion's Runners tab
  Then shared-mac-3 is under Shared runners running its work, with "1 for Orion"
  And the reason names acme/storefront-api
```

### AC-5 · test

```gherkin
Scenario: A fleet with no runner of its own
  Given the AI fleet Nova has no runner of its own
  When a member opens Nova's Runners tab
  Then it reads "No runner of its own."
  And box-west is under Shared runners running its work
```

### AC-6 · test

```gherkin
Scenario: A fleet whose only runner is offline
  Given the AI fleet Atlas's only runner atlas-1 was last seen 2 hours ago
  And Atlas has 2 queued jobs
  When a member opens Atlas's Runners tab
  Then atlas-1 reads "Offline, 2 h ago"
  And the tab reads "2 jobs wait for atlas-1."
```

### AC-7 · test

```gherkin
Scenario: A job knows its mission's role
  Given a job of a mission whose key ends in ":qa:1"
  When the Runners board is read
  Then the job carries its mission's id and the role qa
  And a job of no mission carries neither
```

### AC-8 · test

```gherkin
Scenario: An old fleet link still lands
  Given a link to /app/fleet?fleet=orion&tab=missions, Orion being an AI fleet
  When a member follows it
  Then they land on /app/ai-fleet?fleet=orion&tab=missions
```

### AC-9 · test

```gherkin
Scenario: Nobody reads Virtual Fleet any more
  Given the app's screens, its messages, the skills' text and the guide
  When they are searched for "Virtual Fleet"
  Then none is found
  And the glossary lists AI Fleet, with Virtual Fleet as the word to avoid
```
