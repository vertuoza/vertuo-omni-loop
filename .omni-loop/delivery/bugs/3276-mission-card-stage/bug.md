# Bug 3276: a goal-only mission's card says Writing the roadmap and 0 decisions once its PRDs are planned and reviewed

## Triage

- **Domain:** missions: the fleet page's Missions tab (`apps/galaxy/src/missions/page`)
- **Risk:** medium — a person watching a goal-only mission at Works alone reads a stale stage and a zero decision count, so cannot tell the fleet planned and reviewed its PRDs; the mission's page and its events still show the truth (Jev, 0.72)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/missions/page/missions-tab.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected { …(2) } to deeply equal { …(2) }` — received `"progress": "Writing the roadmap"`, `"trust": "0 decisions by the fleet · 0 overturned"`, expected `"0 of 2 on main · 0 joined"` and `"3 decisions by the fleet · 0 overturned"`

## Fix

The tab read a mission's events by `mission_events.prd`, a repository PRD's number, so every event of a product PRD the PM wrote (`product_prd`, `prd` null) was filtered out and the card never knew the mission had PRDs. It also counted only the committee's `decided` events. It now reads `product_prd` beside `prd`, so the progress line counts the product PRDs, and adds the `plan` and `tech` decisions the fleet approved (`mission_decisions`, PRD omni-loop-26) to the trust line; an escalated one went to a person and is not counted.

## Guard

The reproduction, through the tab's service and repository on a fake database, plus a repository test that a product PRD's events are read by their id beside a repository PRD's number, and one that each mission counts only its own approved plan and tech decisions.

## Mutation

mutation: no changed core file against origin/main (d06e3181): nothing to mutate

## Still open

- The Missions tab lists a mission's waits only for a repository PRD (`PRD 2803: approve it`), so a product PRD's wait (`PRD omni-loop-27: the Architect left it to you: …`) gets no line of its own under Waiting on you.
