# Plan: A Commander per Virtual Fleet

PRD #3107, its spec beside this plan (`spec.md`). The feature branch `feat/fleet-commander` goes
into `main` (Closes #3107); each slice is a sub-PR from `feat/fleet-commander--<slice>` into the
feature branch (Part of #3107).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A member asks in the Commander tab and the Commander answers with claims linked by references, signed `Commander · agent`, with the status line, the first visit, the reading row and the off and tokens-used-up states | `supabase/migrations/20270128090000_fleet_commander.sql` `supabase/checks/commander_` `apps/galaxy/src/virtual-fleets/commander/` `apps/galaxy/app/api/virtual-fleets/commander/` `apps/galaxy/src/dashboard/fleet/` | — | 1 | deep |
| s2 | The Waiting on you rail: one card per question waiting on a person, built from its record, answered on a member's confirm through the question's own answer route, with its answered and refused states, working without the model | `apps/galaxy/src/virtual-fleets/commander/` `apps/galaxy/app/api/virtual-fleets/commander/` | s1 | 2 | deep |
| s3 | Message fleet: a member's message is stored and tagged, a `messaged` event links to it, the next runner job of the fleet carries it and prints it under `From your people`, and the message shows which job read it | `supabase/migrations/20270128091000_commander_messaged.sql` `supabase/checks/commander_` `apps/galaxy/src/virtual-fleets/commander/` `apps/galaxy/app/api/virtual-fleets/commander/` `apps/galaxy/app/api/runners/next/` `apps/galaxy/src/runners/` `kit/bin/commands/session.ts` `kit/bin/session.test.ts` | s2 | 3 | build |
| s4 | The two notebooks: the notebook job writes dated mission lines daily and fleet lines when a mission ends, each citing its events, screened for instructions and repeats, and the Notebooks drawer shows them with Delete and Undo; the Commander reads them | `supabase/migrations/20270128092000_commander_notes.sql` `supabase/checks/commander_` `apps/omni-app/src/missions/notebook` `apps/galaxy/src/virtual-fleets/commander/` `apps/galaxy/app/api/virtual-fleets/commander/` | s3 | 4 | deep |
| s5 | The evals: `pnpm commander:eval` runs about 60 questions and the injection suite over recorded fixture fleets against the real model, a person runs it, and the feature PR's body carries its results | `scripts/commander-eval` `scripts/fixtures/commander/` `package.json` | s4 | 5 | build |

**Shared ground.**

- `apps/galaxy/src/virtual-fleets/commander/` and `apps/galaxy/app/api/virtual-fleets/commander/`:
  s1, s2, s3 and s4 each add to the Commander module, its tab and its routes; they run in waves 1 to 4,
  one after another, so each builds on the one before.
- `supabase/checks/commander_`: s1, s3 and s4 each add a check file for their table or event; waves
  1, 3 and 4.
- The migrations: one per slice, each dated after the one before (`20270128090000`, `…091000`,
  `…092000`), so each stays the newest when its sub-PR is ready (conventions › A migration stays the
  newest; re-date with `node scripts/migration-order.ts` if `main` moved past them). The spec named
  one migration; the plan cuts it per slice so every slice ships its own table.
- `kit/dist/` and `apps/omni-app/api/` are generated: s3 and s4 rebuild them only to test, and the
  wave rebuilds them after merging.

## Per slice: done when

### s1 (deep: the model call, the reference check and the workspace scope) (`ui: yes`)

- The Fleet page of a Virtual Fleet shows a fifth tab, **Commander**, after Board; an ordinary fleet
  is unchanged.
- `commander_messages` exists with row-level security for the workspace's members, a 90-day hourly
  purge, and a check in `supabase/checks/` proving a non-member reads and posts nothing (AC-9).
- A question posted to the route returns a reply signed `Commander · agent`: a verdict and claims,
  each claim kept only when every reference it cites was in this turn's context or tool results, its
  link built by the app; the footer says what was read and how many sentences were removed (AC-1,
  AC-2).
- The context holds only this fleet's missions, events, jobs and messages, capped as the spec says,
  with event text, titles and messages in delimited data blocks; a test with two workspaces proves
  nothing of the second is sent (AC-3).
- The model is a seam taking `fetch`; no test calls OpenRouter. The stable prompt carries the cache
  marker, and one message's input is capped at 40,000 tokens.
- The model's tokens count against `teams.daily_tokens`; with none left, no call is made and the tab
  says `Tokens used up. Back at <time> UTC.` (AC-10); with no key, `The Commander is off: no model
  key.` and the other tabs work (AC-11).
- The tab shows screens 2.A (thread part), 2.C, 2.D, 2.E and 2.F of the before/after page, a
  component test per state.

### s2 (deep: an answer can never be changed) (`ui: yes`)

- The rail lists one card per open question of this fleet (a runner job's question, a mission item,
  an outbox item, an approval), built from its record, never from the model (AC-13).
- A choice asks `Answer as <login>?`; Confirm checks the question is still open and calls its own
  answer route with the member's sign-in; the record names that member (AC-4).
- A question answered elsewhere is not answered twice and its card reads `Answered by` the other
  member (AC-12); a refused route reads `Not sent: try again.`
- With no model key, the rail is there and answers (AC-16); screen 2.G and the rail of 2.A, 2.C, 2.D
  are drawn, a component test per state.

### s3 (`ui: yes`)

- `mission_events.kind` accepts `messaged`, actor a member's login, holding no words of the message;
  a check proves it.
- In Message fleet, a sent message is tagged `To the fleet`, a `messaged` event is added to each
  running mission, and with no running mission the box says `No mission running: no agent will read
  this.` (AC-14).
- A runner job's claim carries the fleet's messages since that mission's previous job of the same
  role; `omni session start` prints them under `From your people`, each with its author and time,
  and prints no block when there are none (AC-5).
- The message reads `Waiting for next job`, then `Read by <role> · job <id>` once a job claimed it.

### s4 (deep: memory that an injection could poison) (`ui: yes`)

- `commander_notes` exists: a line of at most 300 characters, dated, with at least one event of the
  same fleet, refused otherwise (AC-6); members read, only the App writes, a deletion records who and
  when.
- The notebook job, on the App's job ledger, adds mission lines at most once a day per running
  mission, and fleet lines when a mission is delivered or stopped (AC-6, AC-7); a candidate line that
  reads as an instruction or repeats one is dropped (AC-15). A fake model and a fake store test it.
- The Notebooks drawer (2.B) shows the fleet notebook then one per mission, delivered ones folded;
  Delete with Undo for 5 seconds removes a line from the Commander's context (AC-8).
- The Commander's context carries the fleet notebook's last 50 lines that are not deleted.

### s5

- `pnpm commander:eval` runs over recorded fixture fleets with no secret in the fixtures, never in
  CI, and prints: kept references valid and of this fleet (100%), claims supported (at least 95%),
  rail matches open questions (100%), not-found on unanswerable questions (at least 95%), the
  injection suite (no card changed, no foreign link, no injected notebook line), latency p95 and
  tokens per message p50 and p95.
- The feature PR's body carries its last results.
