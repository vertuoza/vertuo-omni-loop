---
prd: 3065
title: A mission runs a retro when it is stuck or reaches a milestone
blocked-by: none
spec: file
phase0: server
---

## Problem

Since PRD 2980 a mission runs a retro on a runner when a step fails: `/omni:repair` names the cause,
fingerprints it and repairs it, 3 times per cause and 9 times per mission. Two kinds of trouble get
no retro:

- **A mission that stops moving without failing.** Jobs end, are held, resumed or sent again, yet no
  PRD gets further. Nothing fails, so no repair starts, and the fleet keeps spending tokens until a
  person happens to look. PRD 3040's caps bound the spend, but not the waste, and they never say why.
- **A mission that reaches a milestone.** A roadmap in its scope is delivered, or every PRD of the
  mission is. Nobody writes down what went well and what to change, so the next mission repeats the
  same mistakes.

When a retro finds that a rule or a playbook form is wrong, nothing receives that finding: a mission
has no outbox of its own, and an outbox item today always belongs to a PRD.

This is area `mission-retro-repair` of concept #2800, the "no progress" and "milestone" triggers and
the rule-change items PRD 2980 left out (its **Scope**).

## Solution

### 1. Stuck: 5 jobs in a row where nothing moved

The supervisor counts, per mission, the jobs that ended since something last **moved**. Something
moved when, after a job ended, a PRD of the mission:

- reached a new step (build → QA → Reviewer → ready, or its fix round), or
- read ready, joined the mission branch (PRD 2896), was merged, or was unblocked.

A step sent again (a hold, a stop mid-way, a resume, a provider limit, a flake retried) is not a new
step. A retro job (section 2 or 3) counts toward nothing. Time spent waiting on a person counts
nothing: the counter only grows when a job ends.

At **5** ended jobs in a row with nothing moved, the mission is **stuck**: the supervisor sends one
stuck repair (section 2), first in line, and the counter starts again from 0. While a stuck repair
runs, no second one is sent.

### 2. A stuck repair: `/omni:repair --stuck`

`/omni:repair` takes `--mission <m> --stuck --jobs <j1>,…,<j5>` in place of `--prd <n> --job <job>`.
It reads the five jobs (their logs, saved work and steps), writes the same retro checked by
`RepairRetroSchema`, the same fingerprint, and takes the same way by class as PRD 2980:

- `code`: a bug fix into the mission branch; the App lands it, as it lands a repair's fix.
- `flake`: nothing to fix; the mission carries on.
- `omni-loop`: the scrubbed report, filed once per fingerprint on the Omni Loop repository.
- `person`: only a person can decide (section 4).

Its record line is PRD 2980's, `omni repair: {…}`, with `"trigger":"stuck"` and `"prd"` the PRD the
cause sits in, or `null` when the cause is the mission's own (its scope, its brief, its branch).

**The budget is PRD 2980's.** A stuck repair is a row of `mission_repairs` with `trigger = 'stuck'`
and counts toward the same caps: 3 per cause (fingerprint) in a round, 9 per mission across rounds,
held in the database. A stuck repair spends one of the 9 whatever it finds, so a mission that is
stuck again and again cannot retro for free.

### 3. A milestone retro: `/omni:mission-retro`

A new skill, `kit/plugin/skills/mission-retro/SKILL.md`, run on a runner, never by hand, sent as
`/omni:mission-retro --mission <m> --milestone <roadmap n | mission>`:

- **When:** once for each roadmap in the mission's scope, when every PRD of it is merged or on the
  mission branch; and once for the mission, when it is delivered. A mission whose scope is one
  roadmap gets one retro for that roadmap and one for the mission.
- **What it reads:** the mission's events, its repairs and their retros, the PRDs' plans, outbox
  items and Reviewer and QA verdicts, and the jobs' durations and tokens, for that milestone only.
- **What it writes:** a retro checked by `MissionRetroSchema` (`kit/lib/mission/retro.ts`): what went
  well and what to change, 1 to 5 sentences each, every sentence citing an event, a PRD, a pull
  request or a repair; never a log excerpt, a credential or a person's words.
- **Where it is kept:** above `with-you`, the skill commits it as
  `<mission folder>/retros/<k>-<roadmap n | mission>.md` on the mission branch, signed, and the
  mission's pull request into the default branch carries it for a person to merge. At `with-you`
  there is no mission branch: the retro is kept on the mission page only, which says so.
- **Its record line,** the skill's last output, read by the App from the job's log:
  `omni retro: {"v":1,"mission":<m>,"milestone":"<roadmap n | mission>","retro":{…},"file":"<path>"|null,"items":[…]}`.

A milestone retro never pauses anything and never sends a repair.

### 4. Paused by stuck: ask once

When a stuck repair's class is `person`, or a stuck mission finds its cause's 3 or the mission's 9
spent, the supervisor sets the mission `paused` by `stuck`. Running jobs finish, nothing new is sent,
and it asks once, on the mission page and in the bell of the person who started it:
`Paused: stuck`, the cause in one sentence, the repairs tried (each with its pull request and
outcome), the proposed fix, and two actions:

- **Resume:** a new round, as PRD 2980's Resume: each cause gets 3 again, the mission's 9 stay
  counted, and the stuck counter starts from 0.
- **Stop the mission:** it ends `stopped`, saying it was stuck.

A replayed run asks no second time for the same stuck repair.

### 5. Rule changes: the mission's own outbox

When a stuck repair or a milestone retro finds a rule, a law or a playbook form wrong, it never
changes it. It proposes the change as a **mission outbox item**, always high, holding: what it
proposes to change (a rule or law by its id, or a playbook form and its section), the wording it
proposes, and its evidence as sentences citing the retro. The kit checks it with
`MissionItemSchema` (`kit/lib/mission/item.ts`).

- Above `with-you`, each item is a file in `<mission folder>/outbox/` on the mission branch, beside
  the retro that raised it. At `with-you`, it is a row on the mission page only.
- The App keeps every item as a row of `mission_items`, read on the mission page under **Questions**.
- A member answers it once there: **Adopt** or **Decline**, with an optional note. The answer is
  written once and never rewritten (BR-PRODUCT-12).
- **Adopt applies nothing.** The card then shows the one line that applies it: for a law,
  `/omni:knowledge-add amend <id>` (only its owner approves); for a rule or a playbook form, the
  docs pull request a person opens and merges. No agent edits a rule, a law or a form on its own.
- An open mission item never pauses the mission and never holds its pull request.

### 6. Tokens

Every retro is a runner job the mission sent, so `mission_tokens()` and `fleet_tokens_24h()` (PRD
3040) count it like any job. Over a cap the supervisor sends nothing new, retros included. A stuck
repair waits for the mission to be resumed. A milestone retro a cap held back is sent once the
mission is under every cap again. On a delivered mission, nothing is sent any more: the page reads
`Retro skipped: budget reached`.

### 7. On screen

- **The mission page:**
  - Stuck, a repair running: `Stuck: 5 jobs, nothing moved · repairing (1 of 3) · 7 left in this
    mission`, with the cause in one sentence once its retro is read.
  - Paused by stuck: section 4's question.
  - **Retros:** one card per milestone retro, `Roadmap #<n> delivered` or `Mission delivered`, with
    *Went well* and *To change*, and a link to its file (none at `with-you`).
  - **Questions:** one card per mission item, with Adopt or Decline, and once answered the line that
    applies it.
- **The Operation room:** one ledger row per stuck repair, per milestone retro, per item proposed and
  per answer: `Supervisor · agent · Stuck: 5 jobs, nothing moved`,
  `Supervisor · agent · Retro: roadmap #<n> delivered`, `Supervisor · agent · Proposes a change to
  <id>`, `<login> · Adopted the change to <id>`.
- **The guide:** `docs/guide/missions.md` gains **Retros**, saying what triggers each retro, what it
  writes and where a proposed rule change goes.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuoza/vertuo-omni-loop | migration | `20270126110000_mission_retros.sql` | conventions › A new migration takes the next free version (after `20270126100000_token_budget.sql`) |
| vertuoza/vertuo-omni-loop | column | `mission_repairs.trigger` (`failure` \| `stuck`) | no written convention: follows `supabase/migrations/20270125140000_mission_repairs.sql` (`outcome`, a text column with a check) |
| vertuoza/vertuo-omni-loop | table | `mission_retros` | no written convention: follows `supabase/migrations/20270125140000_mission_repairs.sql` (`mission_repairs`, a mission's rows in `mission_<things>`) |
| vertuoza/vertuo-omni-loop | table | `mission_items` | no written convention: follows `supabase/migrations/20270126100000_token_budget.sql` (`mission_budget_stops`, an answer written once beside its row) |
| vertuoza/vertuo-omni-loop | function | `answer_mission_item(item, answer, note)` | no written convention: follows `supabase/migrations/20270126100000_token_budget.sql` (`answer_mission_budget_stop`) |
| vertuoza/vertuo-omni-loop | event kinds | `stuck`, `stuck-answer`, `milestone-retro`, `item-proposed`, `item-answered` | no written convention: follows `supabase/migrations/20270126100000_token_budget.sql` (`budget-stop`, `budget-answer`) |
| vertuoza/vertuo-omni-loop | skill | `/omni:mission-retro` | no written convention: follows `kit/plugin/skills/` (one verb or noun per folder; `retro-apply`) |
| vertuoza/vertuo-omni-loop | record line | `omni retro: {…}` | no written convention: follows `kit/plugin/skills/repair/SKILL.md` (`omni repair:`) |
| vertuoza/vertuo-omni-loop | kit modules | `kit/lib/mission/retro.ts`, `kit/lib/mission/item.ts` | no written convention: follows `kit/lib/mission/` (one pure module per rule) |
| vertuoza/vertuo-omni-loop | app modules | `apps/omni-app/src/missions/stuck.ts`, `milestone.ts` | no written convention: follows `apps/omni-app/src/missions/repair.ts` (pure decisions, a `-run.ts` beside for reads and writes) |
| vertuoza/vertuo-omni-loop | folders | `<mission folder>/retros/`, `<mission folder>/outbox/` | no written convention: follows a PRD's folder (`outbox/` beside its spec) |

## Decisions

- **Stuck is 5 ended jobs in a row with nothing moved** (asked), over 3 jobs or 12 hours.
- **A new step counts as moving** (asked). The voice's objection, accepted: persona:B-E DEv, "A
  normal PRD already takes build, QA, a QA fix, QA again, then review: five jobs before it's ready.
  On a one-PRD mission your stuck counter fires on healthy work and burns one of my 9 repairs for
  nothing." Moving now also includes a PRD reaching its next step.
- **A milestone is a roadmap of the scope delivered, and the mission delivered** (asked), not each
  roadmap wave.
- **A stuck retro is a repair** (asked, approach 1 of 3): `/omni:repair --stuck` reuses PRD 2980's
  retro, fingerprint, four ways and budget; a milestone retro is a new skill. A copy of the four ways
  in a new skill, and a pause with no retro, were set aside.
- **A stuck repair spends one of the 9 whatever it finds**, so being stuck over and over cannot loop
  for free.
- **A milestone retro is kept on the mission page and as a file on the mission branch** (asked); at
  `with-you`, with no mission branch, on the page only (asked).
- **Rule changes go to the mission's own outbox** (asked), as files on the mission branch and rows
  on the page; at `with-you`, rows only.
- **Adopt records the answer and shows the line that applies it; it never applies it** (asked).
- **One retro at a time per mission**, as one retro at a time per repository (ADR-0034).
- **Proof video:** no (asked).

## User stories

- As a person whose mission spun all night without failing, I find it paused in the morning with
  `Paused: stuck`, the cause in one sentence and what was tried, and I resume or stop it.
- As the same person, when the cause was code, I find a fix landed on the mission branch and the
  mission moving again, without a question.
- As a product manager, when a roadmap of my mission is delivered, I read what went well and what to
  change on the mission page, and again in the mission's pull request.
- As a lead engineer, when a retro thinks a playbook form is wrong, I get one question with the
  wording it proposes and its evidence, and nothing changes unless I adopt it and apply it.
- As a back-end developer, every stuck repair is a `mission_repairs` row with its trigger, so a
  mission still never runs more than 9 repairs.

## Scope

In:

- the stuck counter and the stuck repair in the supervisor (`stuck.ts`);
- `/omni:repair --stuck --jobs …`, and `"trigger"` in its record line;
- the milestone trigger (`milestone.ts`) and the `/omni:mission-retro` skill, with
  `MissionRetroSchema`;
- the mission's outbox: `MissionItemSchema`, the files on the mission branch, `mission_items` and
  `answer_mission_item`;
- `mission_repairs.trigger`, `mission_retros`, five event kinds, the pause by `stuck`;
- the mission page's stuck line, question, Retros and Questions; the room's rows; the guide.

Out:

- applying an adopted change by an agent (a person applies it);
- a retro per roadmap wave, and a retro outside a mission (a terminal `/omni:yolo` keeps its own
  retro PR);
- a new budget: retros live inside PRD 2980's repairs and PRD 3040's caps;
- a mission team that fixes the reported Omni Loop bugs.

## Test seams

Pure code first, then the database checks, with no GitHub, no network, no model and no clock
(`omni kb show testing`).

- `apps/omni-app/src/missions/stuck.test.ts`: the counter over a list of job ends: a new step, a
  ready, a join, a merge or an unblock resets it; a hold, a resume, a flake retried or a retro job
  does not; at 5 it answers `stuck`; waiting on a person adds nothing.
- `apps/omni-app/src/missions/supervisor.stuck.test.ts`, on the fake store and fake runners: a stuck
  mission sends one stuck repair first in line and no second while it runs; `code` lands a fix and
  the counter restarts; `person` pauses by stuck and asks once; a spent cause or a spent 9 pauses; a
  replay records nothing twice; Resume opens a new round.
- `apps/omni-app/src/missions/milestone.test.ts`: a roadmap delivered sends its retro once; the
  mission delivered sends one more; a cap holds it back and the delivered mission reads
  `Retro skipped: budget reached`.
- `kit/lib/mission/retro.test.ts` and `item.test.ts`: the schemas refuse an uncited sentence, an
  empty side, more than 5 sentences, a log excerpt shape, and an item with no target or wording.
- `kit/lib/repair/line.test.ts`: the record line reads `"trigger":"stuck"` and a `null` PRD.
- `supabase/checks/mission_retros.sql`, a step of the `supabase` workflow: a stuck repair counts
  toward the 3 and the 9; an item's answer is written once; a member of another workspace reads no
  retro and no item; nobody deletes one.
- Render tests of the mission page's stuck line, question, Retros and Questions, and the room's rows.

## Risks

Merging publishes one additive migration (a column with a default, two tables, a function, five
event kinds), a supervisor change, a skill and a changed one, and new parts of the mission page. It
acts only on missions that run. Rolled back by turning the stuck count off in the supervisor
(`STUCK_JOBS = 0`) and sending no milestone retro, then reverting the feature PR; the column
defaults to `failure` and the tables are only added.

- **A stuck count that fires on healthy work** spends repairs for nothing: a new step counts as
  moving, and the 9 bound it.
- **A retro that reads as slop** (the concept's F-E Developer's fear): each sentence must cite an
  event, a PRD, a pull request or a repair, or the schema refuses it.
- **A rule changed behind people's backs:** no retro edits a rule, a law or a form; Adopt only
  records, and a law's change still needs its owner.

The Legal entries it touches:

- L-AIACT-1: retros, items and room rows are signed `Supervisor · agent`, never as a person.
- L-GDPR-1: retros and items are the workspace's, readable by its members only; they hold no login,
  email or log excerpt.
- L-GDPR-2: no retro or item holds a log excerpt, so no credential; the stuck repair's report keeps
  PRD 2980's scrub.
- L-GDPR-4: an item's answer records a decision and is kept for good.

The locked laws:

- BR-PRODUCT-12: An answer never changes after it is given. If broken, nobody can tell what a person
  decided on a proposed rule change; an item's answer is written once and never rewritten. Changing
  it needs @pierrederval or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-16: The game's ledger is only ever added to. If broken, a mission's history could change
  after the fact; retros, items and their room rows are only added. Changing it needs @pierrederval
  or @dervalp to approve the pull request on GitHub.
- N-PRODUCT-15: Only a person merges into the main branch. If broken, a retro or a fix would reach
  every user unreviewed; retro files and items land on the mission branch only. Changing it needs
  @pierrederval or @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-63: An agent link reads only repositories in its own workspace. If broken, a retro could
  read another team's work; a retro reads its own mission only. Changing it needs @pierrederval or
  @dervalp to approve the pull request on GitHub.
- BR-PRODUCT-28, BR-PRODUCT-64, BR-PRODUCT-29, BR-PRODUCT-39 and BR-PRODUCT-59 sit in the database
  files this change adds to and are kept: no membership, agent link, ask session or AI key is read or
  written. Changing any needs @pierrederval or @dervalp to approve the pull request on GitHub.

The rules: BR-PRODUCT-139 is kept (a stuck repair is a repair, inside the same 3 and 9).
BR-PRODUCT-138 is kept (a pushed brief never pauses or resumes a mission; only the supervisor pauses
by stuck).

The business laws:

- BL-APPROVALS-1: An approval covers exactly the files the approver read; kept. A retro's file and
  items land on the mission branch, and the mission's pull request is approved as any other: no
  approval is read or written.
- BL-ASK-1: An answer a person gave is never changed afterwards; kept. An item's answer is written
  once, and an adopted change is applied by a person, never reworded by an agent.
- BL-GATE-1: A check that ends without deciding says "not judged"; kept. A retro that could not be
  read, or a milestone retro a cap held back, reads `Retro skipped: <why>`, never as done.

## Acceptance criteria

### AC-1 · test

```gherkin
Scenario: A mission that stops moving gets a stuck repair
  Given a running mission whose last 5 ended jobs moved no PRD to a new step, to ready, onto the mission branch, to merged or out of its blockers
  When the supervisor reads the fifth end
  Then it sends one stuck repair first in line, the page reads Stuck: 5 jobs, nothing moved, and the counter starts again
```

### AC-2 · test

```gherkin
Scenario: A healthy chain is never stuck
  Given a one-PRD mission whose jobs are its build, QA, a QA fix, QA again and the Reviewer, each reaching its next step
  When the supervisor reads each end
  Then no stuck repair is sent
```

### AC-3 · test

```gherkin
Scenario: A stuck repair spends from the repair budget
  Given a mission that has run 8 repairs and is stuck
  When the stuck repair's retro reads class flake
  Then the mission's repair count reads 9, and the next time it is stuck it pauses by stuck instead of repairing
```

### AC-4 · test

```gherkin
Scenario: A stuck mission a person must decide pauses and asks once
  Given a stuck repair whose retro reads class person
  When the supervisor reads its record line, and reads it again on a replayed run
  Then the mission is paused by stuck, asks once with the cause, the repairs tried, the proposed fix, Resume and Stop, and no second question is recorded
```

### AC-5 · test

```gherkin
Scenario: A roadmap delivered gets one milestone retro
  Given a mission whose scope holds a roadmap whose last PRD just joined the mission branch
  When the supervisor runs twice
  Then it sends one /omni:mission-retro for that roadmap, and its record line adds a Retros card with went well and to change, linking its file on the mission branch
```

### AC-6 · test

```gherkin
Scenario: At with-you the retro stays on the page
  Given a with-you mission that is delivered
  When its milestone retro ends
  Then the Retros card reads Mission delivered with no file, saying it is kept on this page only
```

### AC-7 · test

```gherkin
Scenario: A retro proposes a rule change and changes nothing
  Given a milestone retro whose record line holds an item proposing new wording for a playbook form
  When the App reads it
  Then the mission page shows one question with the form, the wording and the evidence, and no file of the knowledge or the playbook changed
```

### AC-8 · test

```gherkin
Scenario: An item's answer is given once
  Given an open mission item
  When a member adopts it, and then tries to decline it
  Then the first answer is kept, the second is refused, and the card shows the line that applies the change
```

### AC-9 · test

```gherkin
Scenario: Retros count toward the token caps
  Given a mission over its token budget whose roadmap was just delivered
  When the supervisor runs
  Then no milestone retro is sent until the mission is under every cap again
```

### AC-10 · test

```gherkin
Scenario: A retro is never written from words it cannot cite
  Given a milestone retro whose went well holds a sentence citing no event, PRD, pull request or repair
  When the kit checks it
  Then MissionRetroSchema refuses it, naming the sentence
```
