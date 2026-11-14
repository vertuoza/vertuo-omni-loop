---
screen: fleet-seats
status: draft
kind: page
mock: fleet-seats.html
implements: [apps/galaxy/src/virtual-fleets/heroes/HeroesTab.tsx, apps/galaxy/src/virtual-fleets/heroes/heroes.ts, apps/galaxy/src/virtual-fleets/heroes/heroes.css]
reads: [apps/galaxy/src/virtual-fleets/heroes/heroes.contract.ts, kit/lib/virtual-fleet/roles.ts, apps/galaxy/src/dashboard/fleet/FleetScreen.tsx]
routes: [/app/fleet]
supersedes: null
---

## Purpose

The Heroes tab of a Virtual Fleet: its Virtual Heroes, agents one per role, and what each does alone
today. A hero is a role with its skills; it moves from `A person does this today` to `Works alone` only
once its skill runs on a runner with nobody at it. (The tab was the concept's Seats tab; PRD 2842 names it
Heroes.)

## Regions

- **One row per hero:** its sprite in the fleet's colour (whole-number scale), its name and `Role · agent`,
  whether it works alone, its skills as the kit names them (`/omni:yolo`), its preferred agent and model
  (recorded: the runner's accounts still decide), and its limits in sentences.
- **Whether it works alone, and why:** `Works alone`, or `A person does this today` with the reason (the
  PM's brainstorm and roadmap need a person; the Architect's plan needs one; the Reviewer's skill is not
  built yet).
- **Remove,** on each row, for an owner of the workspace; a fleet's last hero cannot be removed.
- **The primary action:** `Add a hero`, for an owner, listing the roles the fleet lacks.

## States

- **An owner:** sees `Add a hero` and `Remove`.
- **A member:** sees the heroes and `Only an owner of the workspace adds or removes a hero.`
- **Every role held:** no `Add a hero`.
- **Refused or failed:** the refusal's words under the rows.
- **Could not load:** `Couldn’t load this. Reload in a moment.`

## Words

- `Heroes`, `Works alone`, `A person does this today`, `Add a hero`, `Remove`, `No skill yet`.

## Refusals

- No first names, faces or human voices for agents: a hero is always `Role · agent`.
- No hero set to work alone whose skill cannot run unattended.

## Open questions

- Who may rename a hero or change its agent and model (recorded now, never routed).
- Whether QA may write the branch: the person said QA may fix a bug itself; the F-E Developer and
  B-E DEv personas want one writer per branch. The concept lets QA hold the branch while it fixes,
  then hand it back.

## Source

/omni:think-big, concept #2800, crowned A on 2026-11-13: .omni-loop/delivery/inbox/concepts/2800-fleet-operation-room/vision.html
/omni:brainstorm, PRD 2842: .omni-loop/delivery/inbox/2842-missions/before-after.html
