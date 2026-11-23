# Bug 3190: omni mission push prints a mission link that 404s

## Triage

- **Domain:** missions: the dossier push's reply (`apps/galaxy/src/dossier/api.ts`)
- **Risk:** medium — everyone who writes a mission follows the printed link to a 404; workaround: open the fleet's Missions tab by hand
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/dossier/api.test.ts`
- **Level:** unit
- **Red:** Expected: "https://omni.example/app/fleet?fleet=night-shift&tab=missions" Received: "https://omni.example/missions/m-dossier"

## Fix

The push answered every kind's page as `/<route>/<id>`, and a mission's route, `missions`, has no page in
the app. The store now returns the mission's fleet from its mission.md, and the push answers that
fleet's Missions tab, `/app/fleet?fleet=<fleet>&tab=missions`, which lists the mission and starts it.

## Guard

A test that every kind's page route left in `PAGE_ROUTES` has an `app/<route>/[id]/page.tsx`; it fails
with the old `missions` route, whose page does not exist.

## Mutation

mutation: no changed core file against origin/main (2270c4da): nothing to mutate
