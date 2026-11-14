---
screen: fleet-new
status: draft
kind: page
mock: fleet-new.html
implements: [apps/galaxy/src/virtual-fleets/drawer/NewVirtualFleet.tsx, apps/galaxy/src/virtual-fleets/drawer/new-fleet.ts, apps/galaxy/src/virtual-fleets/drawer/new-fleet.css]
reads: [apps/galaxy/src/runners/page/need-human.css, apps/galaxy/src/virtual-fleets/virtual-fleets.contract.ts, kit/lib/virtual-fleet/roles.ts, apps/galaxy/src/dashboard/fleet/FleetScreen.tsx]
routes: [/app/fleet]
supersedes: null
---

## Purpose

The drawer that creates a Virtual Fleet from the Fleet section: a fleet of Virtual Heroes, agents one
per role, that missions are given to. Any member of the workspace opens it with `+ New virtual
fleet`.

## Regions

- **The page behind,** the Fleet section, dimmed.
- **The drawer,** on the right, 560 px, the whole width on a phone (the Need human drawer's
  pattern): its title, `New virtual fleet`.
- **Name,** first and focused, its placeholder an example name.
- **Icon,** the fleet mascots as tiles, in the library's order, the first (the beaver) selected.
- **Heroes,** the five roles (Engineer, QA, Reviewer, PM, Architect), each a yes/no switch, all on,
  each with one line on whether it works alone today: `Builds PRDs alone`, `Proves the work alone`,
  or `A person does this today`.
- **The foot,** `Cancel` and `Create fleet`, the primary; a refusal of the whole form above them.

## States

- **Opened:** Name empty and focused; every switch on.
- **Name taken:** `Name taken: choose another` under the field; nothing else moves.
- **Every switch off, or no name:** Create fleet disabled.
- **Creating:** the primary reads `Creating…`, disabled.
- **Refused for the form:** the cap of 12 active fleets, or a failure, above the foot's buttons.
- **Created:** the drawer closes on the new fleet in the Fleet section, its chip selected and marked
  `Virtual` (its Operation room once the Fleet's tabs exist, PRD 2842 s6).

## Words

- `+ New virtual fleet`, `New virtual fleet`, `Name`, `Icon`, `Heroes`, `Cancel`, `Create fleet`,
  `Creating…`, `Name taken: choose another`, `Builds PRDs alone`, `Proves the work alone`,
  `A person does this today`, `Virtual`.

## Refusals

- No colour field: the colour is picked for it and changed in Settings › Fleets.
- No person's first name for a hero; no human face for an agent.

## Open questions

- Whether the icon list adds agent-like icons beyond the fleet mascots.

## Source

/omni:brainstorm, PRD 2842: .omni-loop/delivery/inbox/2842-missions/before-after.html
