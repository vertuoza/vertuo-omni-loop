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

The Heroes tab of a Virtual Fleet: its Virtual Heroes, agents one per role, each listing every skill of
its role and which of them a runner runs with nobody at it. A skill reads `runs alone` once runners
take it (the runner's own list decides, PRD 2873), `needs a person` until then. (The tab was the concept's Seats tab; PRD 2842 names it
Heroes.)

## Regions

- **One row per hero:** its sprite in the fleet's colour (whole-number scale), its name and `Role · agent`,
  its count line, every skill of its role as the kit names them (`/omni:yolo`), each marked `runs alone`
  or `needs a person`, the ones that run alone first, its preferred agent and model (recorded: the
  runner's accounts still decide), and its limits in sentences.
- **The count line:** `Runs <k> of <n> skills alone`, or `A person does this today` when none of its
  skills runs alone. The Reviewer runs `/omni:review` alone since PRD 2871 (`Runs 1 of 2 skills
  alone`); its `/omni:tech-review` needs a person.
- **QA** (PRD 3001): `/omni:qa` runs alone (`Runs 3 of 4 skills alone`); its limits read `It never writes the branch.`,
  `It reports bugs to the Engineer.`, `It reports five bugs at most.`, `It checks two rounds at most.`
- **Six roles:** Engineer, QA, Reviewer, PM, Architect and Designer.
- **Remove,** on each row, for an owner of the workspace; a fleet's last hero cannot be removed.
- **The primary action:** `Add a hero`, for an owner, listing the roles the fleet lacks.

## States

- **An owner:** sees `Add a hero` and `Remove`.
- **A member:** sees the heroes and `Only an owner of the workspace adds or removes a hero.`
- **Every role held:** no `Add a hero`.
- **Refused or failed:** the refusal's words under the rows.
- **Could not load:** `Couldn’t load this. Reload in a moment.`

## Words

- `Heroes`, `Runs <k> of <n> skills alone`, `runs alone`, `needs a person`, `A person does this today`,
  `Add a hero`, `Remove`, `Every role held.`

## Refusals

- No first names, faces or human voices for agents: a hero is always `Role · agent`.
- No skill marked `runs alone` that the runner's list does not hold, and no third mark.

## Open questions

- Who may rename a hero or change its agent and model (recorded now, never routed).

## Source

/omni:think-big, concept #2800, crowned A on 2026-11-13: .omni-loop/delivery/inbox/concepts/2800-fleet-operation-room/vision.html
/omni:brainstorm, PRD 2842: .omni-loop/delivery/shipped/2842-missions/before-after.html
/omni:brainstorm, PRD 2871: .omni-loop/delivery/shipped/2871-reviewer/before-after.html
/omni:brainstorm, PRD 2873: .omni-loop/delivery/shipped/2873-heroes-every-skill/before-after.html
/omni:brainstorm, PRD 3001: .omni-loop/delivery/shipped/3001-qa-turn/before-after.html (QA's row)
