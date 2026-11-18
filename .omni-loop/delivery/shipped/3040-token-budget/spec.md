---
prd: 3040
title: A mission pauses and asks once it reaches its token budget
blocked-by: none
spec: file
phase0: server
---

## Problem

A mission spends tokens with no bound. Since PRD 3001 every runner job keeps what it spent
(`runner_jobs.tokens`), and the Operation room shows it on each row, but nothing reads the total: a
fleet left alone at night with an agent that loops, or one that goes rogue, keeps sending jobs until
a person notices. The repair budget of PRD 2980 bounds how often a failure is repaired, not what the
mission spends, and the provider's own limits are an account's, not a mission's.

The person wants a guard, off by default: no cap until real missions have run and shown what a
normal one spends, then a cap that pauses the work and asks, never one that loses it.

## Solution

### 1. Two caps, both off by default

- **The fleet's daily cap:** `Tokens per day`, on a virtual fleet's settings, across every mission
  of the fleet, over the last 24 hours (a rolling window, read from each job's end). Empty means no
  cap. An owner of the workspace sets it, as an owner sets the fleet's level (PRD 2896).
- **A mission's budget:** `Token budget for this mission`, over every job the mission ever sent,
  on top of the fleet's. Empty means no cap. It is the brief's mandate `tokens` (`mission.md`), and
  a draft mission's page sets it for that mission alone, as it sets its level; an owner can still
  raise it while the mission runs (section 3).

### 2. What counts

A job counts once it ended, by its kept tokens: **input + output + cache writes**. Cache reads are
left out: a long session re-reading its context does not fill a cap, while a loop, which writes and
outputs, does. A job with no tokens (`tokens unknown`) counts 0, and its row says so. A running job
counts nothing until it ends, so a cap can be passed by up to one job's worth: a job is never
stopped mid-way (**Decisions**).

### 3. At a cap: pause and ask once

At each mission run, before sending anything, the supervisor reads what the mission spent and what
its fleet spent in the last 24 hours.

1. **Over a cap:** it sends nothing new, records one **budget stop**, and sets the mission `paused`
   by `budget`. Running jobs finish; none is cancelled. The fleet's cap pauses every running mission
   of the fleet together, in one budget stop.
2. **It asks once,** on the mission's page and in the person's bell: `Paused: budget reached`, the
   cap and what was spent, whose cap it is (`this mission's budget` or `this fleet's daily cap`),
   and three actions:
   - **Raise the cap:** a new number, saved; each mission the stop paused goes back to `running`
     once it is under every cap.
   - **Resume tomorrow** (the fleet's cap only): each mission the stop paused wakes by itself once
     the fleet's last 24 hours are back under the cap, at the time the oldest counted job leaves the
     window, as a limit wait wakes (PRD 2949).
   - **Stop the mission:** it ends `stopped`, saying the budget stopped it.
3. A replayed run records no second stop for the same cap: one question per stop.
4. A person's own **Pause** and **Resume** stay as they are. A mission paused by the budget and
   resumed by hand while still over a cap is paused again at its next run, by the same stop.

### 4. On screen

- **The mission page:** under its level, `412k of 2M tokens`, or `No token budget`. Paused by the
  budget: `Paused: budget reached`, `2.0M of 2M tokens · this mission's budget`, and the three
  actions.
- **The fleet's settings:** `Tokens per day`, empty for no cap, and `1.3M of 2M in the last 24 hours`,
  or `No daily cap`.
- **The Operation room:** one ledger row per stop, `Supervisor · agent · Paused: this fleet's daily
  cap reached (2M)`, and one when a person answers it.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuoza/vertuo-omni-loop | migration | `20270125170000_token_budget.sql` | conventions › A new migration takes the next free version (after `20270125160000_qa_turn.sql`) |
| vertuoza/vertuo-omni-loop | column | `teams.daily_tokens` (bigint, null) | no written convention: follows `supabase/migrations/20270124090000_fleet_level.sql:24` (`teams.level`, a fleet's setting on `teams`) |
| vertuoza/vertuo-omni-loop | function | `set_fleet_daily_tokens(workspace, fleet, n)` | no written convention: follows `supabase/migrations/20270124090000_fleet_level.sql:76` (`set_fleet_level`) |
| vertuoza/vertuo-omni-loop | table | `mission_budget_stops` | no written convention: follows `supabase/migrations/20270125140000_mission_repairs.sql` (`mission_repairs`, a mission's rows in `mission_<things>`) |
| vertuoza/vertuo-omni-loop | functions | `mission_tokens(mission)`, `fleet_tokens_24h(fleet)` | no written convention: follows `supabase/migrations/20270122093000_missions.sql` (snake_case read functions) |
| vertuoza/vertuo-omni-loop | brief field | mandate `tokens` | no written convention: follows `kit/lib/mission/brief.ts` (mandate `parallel`, `level`, `hardToRevert`, `ownPrds`) |
| vertuoza/vertuo-omni-loop | kit module | `kit/lib/mission/budget.ts` | no written convention: follows `kit/lib/mission/` (one pure module per rule) |

## Decisions

- **Two caps** (asked): the fleet's, global and off by default, and a mission's on top of it, off
  by default. The person will set numbers once several missions have run; no default number ships.
- **The fleet's cap is per day** (asked), over a rolling 24 hours, to catch a loop within hours and
  reset by itself.
- **Pause and ask** (asked), over stopping for good or waiting it out: running jobs finish, nothing
  new is sent, and the person raises the cap, resumes tomorrow or stops.
- **Input + output + cache writes count** (asked); cache reads do not.
- **The voice's objection, not taken.** persona:Lead Engineer: "Pausing only between jobs
  means one runaway job can blow far past the cap before anything stops it, and a loop usually lives
  inside one long job. I'd want a job to be stopped once it alone goes past what's left." The person
  approved the design with caps checked between jobs only: the provider's limits and the repair
  budget already bound one job, and stopping a job mid-way can come after real runs.
- **The answer is kept beside its stop,** written once, never rewritten (BR-PRODUCT-12).
- **Proof video:** no (asked).

## User stories

- As a workspace owner, I set no cap at first, watch what missions spend, then set a fleet's daily
  cap and a mission's budget, so a looping agent cannot spend a night's worth of tokens.
- As the person a mission asks, I see what was spent against which cap and pick one of three
  actions, once.
- As anyone reading a mission's page, I see what it spent against its budget, or that it has none.

## Scope

In:

- `teams.daily_tokens` and `set_fleet_daily_tokens`, owner only;
- the mandate's optional `tokens`, in the brief and on a draft mission's page;
- `mission_tokens` and `fleet_tokens_24h`, and `kit/lib/mission/budget.ts`;
- `mission_budget_stops`, the pause, the three actions and the wake of **Resume tomorrow**;
- the mission page's, the fleet settings' and the room's lines;
- the guide: `docs/guide/missions.md` says what the caps do.

Out:

- stopping a job mid-way, and reporting tokens while a job runs;
- a monthly cap, and a cap in money;
- a default number for either cap;
- caps on work outside a mission (a person's own `/omni:yolo`).

## Test seams

Pure code first, then the database checks, with no GitHub, no network and no clock
(`omni kb show testing`).

- `kit/lib/mission/brief.ts`: the mandate's optional `tokens`, null or a whole number from 1 to
  10⁹; a brief without it parses as today.
- `kit/lib/mission/budget.ts`: `spent(tokens)` adds input, output and cache writes (0 for none);
  `budgetNext(state)` answers `send`, `pause` (whose cap) or `wake-at <time>`.
- `apps/omni-app/src/missions/supervisor.ts`: through the existing fakes: nothing is sent over a
  cap, one stop is recorded, a replay records none, and the three answers act as section 3 says.
- `supabase/checks/`: an owner alone sets the fleet's cap, 0 or a negative number is refused, an
  answer is written once, and the two read functions add the right counts.
- Render tests of the mission page, the fleet's settings and the room's row.

## Risks

- **What merging publishes.** One additive migration (a nullable column, a table, three
  functions), the supervisor reading the caps at every run, and two new settings, all empty. With
  no cap set nothing changes for any mission. Rolled back by reverting the feature PR: the column is
  nullable and the table only added.
- **A cap passed by one job's worth,** since a running job counts only once it ends (accepted).
- **The Legal entries.** L-GDPR-1: the stops and their answers are the workspace's, readable by its
  members only. L-GDPR-4: a stop records a decision, kept for good. L-AIACT-1: the room's row is
  signed `Supervisor · agent`; the person's answer is signed by the person.
- **The locked laws.** BR-PRODUCT-12: An answer never changes after it is given. If broken, nobody
  can tell what was decided; a stop's answer is written once and never rewritten. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub. N-PRODUCT-16: The game's ledger is
  only ever added to. If broken, history changes after the fact; budget stops and their room rows
  are only added. Changing it needs @pierrederval or @dervalp to approve the pull request on GitHub.
  BR-PRODUCT-59: Only the owner can see the workspace's stored AI key; untouched, the caps hold
  counts, never a key.
- **The rules.** BR-PRODUCT-138 (a pushed brief updates the mandate and never changes whether a
  mission runs) is kept: a pushed `tokens` changes the cap, and only the supervisor's next run
  pauses or wakes the mission by it. BR-PRODUCT-139 is kept: a repair job counts toward the caps
  like any job.
- **The business laws:** none touched.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: no cap changes nothing
  Given a fleet with no daily cap and a mission with no budget
  When the supervisor runs
  Then it sends the mission's next job as it does today
```

### AC-2 · test

```gherkin
Scenario: a mission reaching its budget pauses
  Given a mission whose budget is 1000 and whose ended jobs spent 600 input, 300 output, 200 cache-write and 5000 cache-read tokens
  When the supervisor runs
  Then it sends nothing new
  And the mission reads "Paused: budget reached" by "this mission's budget"
```

### AC-3 · test

```gherkin
Scenario: a fleet reaching its daily cap pauses all its missions in one stop
  Given a fleet whose daily cap is 1000 and two running missions whose jobs ended in the last 24 hours spent 1200 counted tokens
  When the supervisor runs
  Then both missions are paused
  And one budget stop names both
```

### AC-4 · test

```gherkin
Scenario: a cap cancels no running job
  Given a mission over its budget with one job running
  When the supervisor runs
  Then the running job is left to end
  And nothing new is sent
```

### AC-5 · test

```gherkin
Scenario: raising the cap resumes the mission
  Given a mission paused by its budget of 1000 after spending 1100
  When a person raises the budget to 5000
  Then the new budget is saved
  And the mission runs again at its next supervisor run
```

### AC-6 · test

```gherkin
Scenario: resume tomorrow wakes the fleet's missions once the window frees room
  Given missions paused by their fleet's daily cap
  When a person picks "Resume tomorrow"
  Then each mission wakes at the time the fleet's last 24 hours are back under the cap
```

### AC-7 · test

```gherkin
Scenario: stopping ends the mission
  Given a mission paused by a cap
  When a person picks "Stop the mission"
  Then the mission ends stopped, saying the budget stopped it
```

### AC-8 · test

```gherkin
Scenario: a stop is asked once
  Given a mission already paused by its budget
  When the supervisor runs again over the same state
  Then no second budget stop is recorded
```

### AC-9 · test

```gherkin
Scenario: only an owner sets the fleet's cap
  Given a workspace member who is not an owner
  When they set a fleet's daily cap
  Then it is refused
  And an owner setting 0 or a negative number is refused too
```

### AC-10 · test

```gherkin
Scenario: the mission page says what it spent
  Given a mission with a budget of 2000000 whose jobs spent 412000 counted tokens, and another with no budget
  When the mission page is drawn
  Then the first reads "412k of 2M tokens"
  And the second reads "No token budget"
```
