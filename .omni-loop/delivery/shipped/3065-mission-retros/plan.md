# Plan: A mission runs a retro when it is stuck or reaches a milestone

PRD #3065, its spec beside this plan (`spec.md`). The feature branch `feat/mission-retros` goes into
`main` through one feature PR ("Closes #3065"); each slice is a sub-PR from
`feat/mission-retros--<slice>` into the feature branch ("Part of #3065").

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The kit checks a milestone retro (`MissionRetroSchema`: went well and to change, 1 to 5 cited sentences each) and a mission item (`MissionItemSchema`: a target, a wording, cited evidence), and reads `"trigger":"stuck"` and a `null` PRD in the `omni repair:` line and the new `omni retro:` line | `kit/lib/mission/retro` `kit/lib/mission/item` `kit/lib/repair/line` | — | 1 | build |
| s2 | The database keeps a repair's `trigger` (a stuck repair inside the same 3 and 9), each milestone retro, each mission item with its answer written once through `answer_mission_item`, the pause by `stuck`, and the five event kinds | `supabase/migrations/` `supabase/checks/mission_retros.sql` `supabase/database.types.ts` `.github/workflows/supabase.yml` | — | 1 | deep |
| s3 | `/omni:repair --stuck --jobs …` reads the last 5 jobs and takes the same four ways; `/omni:mission-retro` writes a milestone retro, commits it and its items on the mission branch (page only at `with-you`) and ends on its `omni retro:` line; runners may run it | `kit/plugin/skills/repair/` `kit/plugin/skills/mission-retro/` `kit/lib/runner/line` `kit/lib/virtual-fleet/roles` `kit/lib/help/entries` | s1 | 2 | build |
| s4 | The supervisor counts ended jobs since something moved and sends one stuck repair at 5, pauses by `stuck` and asks once, sends one milestone retro per delivered roadmap and one for the mission, holds both under a token cap, and records the retros and items it reads | `apps/omni-app/src/missions/` | s1, s2 | 2 | deep |
| s5 | The mission page shows `Stuck: 5 jobs, nothing moved`, `Paused: stuck` with Resume and Stop, the Retros cards and the Questions cards with Adopt and Decline, and the room's new rows; a route answers an item | `apps/galaxy/src/missions/` `apps/galaxy/app/api/missions/` | s2, s4 | 3 | build |
| s6 | The guide's Missions page gains **Retros**: what triggers each retro, what it writes, and where a proposed rule change goes | `docs/guide/missions.md` | s4, s5 | 4 | light |

Shared ground: none. Each prefix is declared by one slice: s1 alone the two new kit modules and the
repair line, s2 alone a migration, s3 alone the two skills and the runner's skill list, s4 alone
`apps/omni-app/src/missions/`, s5 alone the arcade's missions and their routes. s3 and s4 share wave
2 with no common prefix. The built files (`kit/dist/`, `apps/omni-app/api/`) are rebuilt by each
wave, never listed.

Law proofs: tests these slices extend may prove rules: `supervisor*.test.ts` and `repair.test.ts`
(BR-PRODUCT-139; s4), `kit/lib/repair/line.test.ts` (s1). None is a locked law, so no slice carries a
law mark, but a slice that changes one of these files records a high outbox item naming the rule it
proves and writes its account, so the feature's coverage gate finds every change accounted for.

## Per slice: done when

### s1

- `MissionRetroSchema` accepts a retro with 1 to 5 sentences under went well and under to change,
  each citing an event, a PRD, a pull request or a repair, and refuses an uncited sentence naming it
  (AC-10), an empty side, a sixth sentence and a log-excerpt shape.
- `MissionItemSchema` accepts a target (a rule or law id, or a playbook form and section), a wording
  and cited evidence, and refuses an item missing any of them.
- The `omni repair:` line reads `"trigger":"stuck"` with a `null` PRD, and a line without `trigger`
  reads as `failure`; the `omni retro:` line reads its retro, its file (or `null`) and its items.

### s2 (deep: a migration, a cap shared with PRD 2980 and an answer written once)

- `mission_repairs.trigger` defaults to `failure`; a stuck row may have no PRD; the 4th repair of
  one fingerprint in a round and the 10th of a mission are refused whatever the trigger (AC-3).
- `mission_retros` and `mission_items` take inserts from the service role only, are read by the
  mission's workspace members only, and are never updated or deleted, save an item's answer.
- `answer_mission_item` writes an answer once as the signed-in member; a second answer is refused
  (AC-8); anyone outside the workspace is refused.
- `mission_events.kind` takes the five kinds; `supabase/checks/mission_retros.sql` proves all of it
  and runs as its own step of the `supabase` workflow.

### s3

- `/omni:repair` with `--mission --stuck --jobs` reads the five jobs, writes the retro and fingerprint
  as for a failure, takes the way of its class, and ends on a line with `"trigger":"stuck"`; its old
  input still works.
- `/omni:mission-retro --mission <m> --milestone <roadmap n | mission>` writes a retro the kit's
  schema accepts, commits `retros/<k>-<milestone>.md` and each item under `outbox/` on the mission
  branch above `with-you` (nothing at `with-you`), never touches the default branch, a rule, a law or
  a form, and ends on its `omni retro:` line.
- A runner accepts `mission-retro` as a skill it runs, and `omni help mission-retro` describes it.

### s4 (deep: the decision every mission run takes, and a cap a supervisor bug must not loop)

- `stuckNext()` resets on a new step, ready, a join, a merge or an unblock, and not on a hold, a
  resume, a flake retried or a retro job; at 5 it sends one stuck repair first in line, and no second
  while it runs (AC-1); a healthy build, QA, QA fix, QA, Reviewer chain sends none (AC-2).
- A stuck repair's class acts as PRD 2980's; `person`, a spent cause or the spent 9 pause the mission
  by `stuck` and ask once, and a replay asks no second time (AC-4); Resume opens a new round and
  restarts the count.
- `milestoneNext()` sends one `/omni:mission-retro` per roadmap of the scope once all its PRDs are
  merged or joined, and one for the delivered mission (AC-5, AC-6); over a token cap it sends none
  until the mission is under every cap (AC-9), and a delivered mission reads
  `Retro skipped: budget reached`.
- The `omni retro:` line's retro and items become `mission_retros` and `mission_items` rows and their
  events (AC-7); a line that cannot be read records `Retro skipped: <why>`.

### s5 (`ui: yes`)

- The Missions tab draws the five states of the before/after page (1.A to 1.E) and the room its rows
  (2.A), with the words of the spec.
- Adopt and Decline call the route, which calls `answer_mission_item`; once answered, the card shows
  who answered and the line that applies it, and no button (AC-8).
- Render tests hold each state's words, counts and links.

### s6 (light: docs only)

- `docs/guide/missions.md` says what makes a mission stuck, what a milestone is, what each retro
  writes and where, that a rule change waits for a person, and that retros count toward the repair
  budget and the token caps.
