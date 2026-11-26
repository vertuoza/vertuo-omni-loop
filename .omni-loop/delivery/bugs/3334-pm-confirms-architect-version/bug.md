# Bug 3334: a mission waits on a person when the Architect pushed and approved a version after the PM's rounds were spent

## Triage

- **Domain:** missions — the fleet's plan and tech review of its product PRDs (`apps/omni-app/src/missions/tech.ts`, `reviewStateOf`)
- **Risk:** medium — a mission at alone stops and waits on a person for a step its PM can take itself (confirming the version the Architect pushed and approved); the workaround is a person approving the PRD on its page (Jev, 0.99)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/omni-app/src/missions/tech.recovery.test.ts`, `apps/omni-app/src/missions/job.tech.test.ts`
- **Level:** unit
- **Red:** `AssertionError: expected { state: 'waits', …(1) } to deeply equal { state: 'plan', again: true }`

## Fix

Once the PM's two rounds were spent, `reviewStateOf` sent a PRD whose latest plan version only the Architect had approved (a version the Architect pushed) to a person, although the flow's own last step is the PM approving that version. The PM's plan job is now sent for that confirmation even when its rounds are spent, but only while the Architect's approval of the latest version is the last decision, so it is sent once per such version: whatever the PM then decides (an approval of it, which builds; another version or an escalation, which goes to a person) ends it. BL-GATE-1 and the ROUNDS and FAILS caps are unchanged.

## Guard

The reproduction is the guard: `tech.recovery.test.ts` runs omni-loop-28's exact seven decisions from mission #3319 (red on main, green here) and pins the bound (the PM sent once: another version or an escalation goes to a person), and `job.tech.test.ts` runs the same history through the mission job up to the `/omni:ultra-yolo … --base-of …` build line.

## Mutation

mutation: no changed core file against origin/main (f899eef5): nothing to mutate
