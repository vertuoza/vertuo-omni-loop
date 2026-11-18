# Plan: A mission pauses and asks once it reaches its token budget

PRD #3040, its spec beside this plan (`spec.md`). The feature branch `feat/token-budget` goes into
`main` through one feature PR ("Closes #3040"); each slice is a sub-PR from
`feat/token-budget--<slice>` into the feature branch ("Part of #3040").

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A brief's mandate takes an optional `tokens` (1 to 10⁹), and `budget.ts` counts a job's tokens (input + output + cache writes) and decides `send`, `pause` (whose cap) or `wake-at` | `kit/lib/mission/brief` `kit/lib/mission/budget` | — | 1 | deep |
| s2 | The database keeps a fleet's optional `daily_tokens` (owner only, above 0), accepts a mandate's `tokens`, records each budget stop and its answer once, and adds a mission's and a fleet's last-24-hours counted tokens | `supabase/migrations/` `supabase/checks/token_budget.sql` `supabase/database.types.ts` `.github/workflows/supabase.yml` | — | 1 | deep |
| s3 | A mission reads both caps before it sends anything, records one stop and pauses over a cap, never cancels a running job, and acts on the answer: raised, resume tomorrow (a wake at the window's time) or stopped | `apps/omni-app/src/missions/` | s1, s2 | 2 | deep |
| s4 | The Missions tab shows the fleet's daily cap with `Change` for an owner, each mission's `412k of 2M tokens` or `No token budget`, `Paused: budget reached` with its actions, and the room's stop row; the routes set the caps and answer a stop | `apps/galaxy/src/missions/` `apps/galaxy/src/virtual-fleets/` `apps/galaxy/app/api/missions/` `apps/galaxy/app/api/virtual-fleets/` | s2, s3 | 3 | build |
| s5 | The guide's Missions page says what the two caps count, that both are off by default, and the three answers | `docs/guide/missions.md` | s3, s4 | 4 | light |

Shared ground: none. Each prefix is declared by one slice: s2 alone adds a migration, s3 alone
touches `apps/omni-app/src/missions/` and s4 alone the arcade's missions, virtual fleets and their
routes. s3 reads s1's `budgetNext()` and s2's functions, so it waits for both; s4 shows what s3
records. The built files (`kit/dist/`, `apps/omni-app/api/`) are rebuilt by each wave, never listed.

Law proofs: tests these slices extend may prove rules: the mission brief's tests (BR-PRODUCT-137,
BR-PRODUCT-138; s1) and `supervisor*.test.ts` (BR-PRODUCT-139; s3). None is a locked law, so no slice
carries a law mark, but a slice that changes one of these files records a high outbox item naming the
rule it proves and writes its account, so the feature's coverage gate finds every change accounted
for.

## Per slice: done when

### s1 (deep: the decision every mission run takes)

- `MissionBriefSchema`'s mandate accepts `tokens`, a whole number from 1 to 10⁹, and refuses 0, a
  negative or a fraction; a brief without it parses as today, with no budget.
- `spent(tokens)` adds input, output and cache writes, leaves cache reads out, and gives 0 for none.
- `budgetNext({ missionSpent, missionCap, fleetSpent24h, fleetCap, stop, answer, now, oldestEnd })`
  answers `send` under every cap or with none set (AC-1), `pause` naming the cap reached (AC-2, AC-3),
  nothing new once a stop is recorded (AC-8), and `wake-at` the time the oldest counted job leaves
  the 24 hours for `Resume tomorrow` (AC-6). Pure: no clock, no database.

### s2 (deep: a migration, owner rights and an answer written once)

- `supabase/migrations/20270125170000_token_budget.sql` (re-dated if `main` moved):
  `teams.daily_tokens bigint` null or above 0; `set_fleet_daily_tokens(workspace, fleet, n)` for an
  owner only, refusing 0 or a negative (AC-9); `mission_mandate_ok()` accepts the optional `tokens`;
  `mission_budget_stops` (mission or fleet cap, its value, what was spent, the missions it paused,
  the answer `raised | tomorrow | stopped`, who and when), the answer set once and never rewritten;
  `mission_tokens(mission)` and `fleet_tokens_24h(fleet)` adding input, output and cache writes of
  the ended jobs (24 hours by `ended_at`).
- `supabase/checks/token_budget.sql` proves each rule above, with its workflow step.
- `supabase/database.types.ts` regenerated.

### s3 (deep: the mission's run) (`ui: yes`)

- Before sending, the run reads both totals; over a cap it records one stop, sets the mission
  `paused` by `budget` and sends nothing (AC-2); a fleet's cap pauses every running mission of the
  fleet in one stop (AC-3); a running job is never cancelled (AC-4); a replay records no second stop
  (AC-8).
- `raised` resumes each mission the stop paused once it is under every cap (AC-5); `tomorrow` sets
  each one's wake at `wake-at` (AC-6); `stopped` ends it `stopped`, saying the budget stopped it
  (AC-7).
- A person's own Pause and Resume are unchanged; a budget pause resumed by hand while still over a
  cap is paused again by the same stop.
- One ledger event per stop, signed by the supervisor, and one when it is answered.

### s4 (`ui: yes`)

- The Missions tab shows `Tokens per day: No daily cap` or `1.3M of 2M`, with `Change` for an
  owner only; each row `412k of 2M tokens` or `No token budget` (AC-10), set on a draft for that
  mission alone.
- `Paused: budget reached` with what was spent and whose cap, `Raise the cap` and `Stop the mission`;
  the fleet's cap one notice above the list with `Resume tomorrow` and `Raise the cap`: drawn as
  `mission-start` 1.A, 1.B and 1.C.
- The room's stop row reads `Paused: this fleet's daily cap reached (2M)` (`fleet-room` 2.A).
- The routes set the fleet's cap (owner only), a mission's budget, and answer a stop once, each as
  the person's own action.

### s5 (light: docs only)

- `docs/guide/missions.md` says the two caps are off by default, what they count (cache reads left
  out), that running jobs finish, and the three answers.
