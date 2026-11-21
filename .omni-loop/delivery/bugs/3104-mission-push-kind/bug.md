# Bug 3104: the mission push drops the brief's kind, so the Omni Loop bug team cannot start

## Triage

- **Domain:** missions — the Omni page's mission push (`apps/galaxy/src/dossier/store.ts`, `briefOf`)
- **Risk:** high — an owner cannot start the Omni Loop bug team from its brief: the push is refused for an empty scope, with no workaround short of writing the mission row by hand; every other mission is unaffected (Jev, 0.85)
- **Regression:** new bug — no evidence this ever worked (the `omni-bugs` kind arrived with PRD 3088)

## Reproduction

- **File:** `apps/galaxy/src/dossier/store.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected { fleet: 'night-shift', …(4) } to match object { kind: 'omni-bugs', …(1) }

## Fix

`briefOf` built the brief it hands `mission_push()` from the fleet, goal, measures, scope and mandate only, so an `omni-bugs` brief arrived as an ordinary mission and its empty scope was refused. It now sends the brief's `kind` too, `prds` when the brief names none, which `mission_push()` already reads.

## Guard

The reproduction: a push of an `omni-bugs` mission.md whose brief reaches `mission_push()` without its kind fails it.

## Mutation

mutation: no changed core file against origin/main (9b4143ef): nothing to mutate
