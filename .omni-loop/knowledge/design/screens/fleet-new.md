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
- **Heroes,** the six roles (Engineer, QA, Reviewer, PM, Architect, Designer), each a yes/no switch,
  all on, each with its count line: `Runs <k> of <n> skills alone`, or `A person does this today`
  (PRD 2873). The PM's reads `Runs 6 of 7 skills alone`: runners take its four writing skills for a
  mission at Works alone, and `mission` stays a person's (PRD 2896).
- **Level,** one choice of three, `Reviews with you` selected: `Reviews with you` (`You merge each PRD`),
  `Own branch` (`You land the mission`), `Works alone` (`Asks you when needed`).
- **The foot,** `Cancel` and `Create fleet`, the primary; a refusal of the whole form above them.

## States

- **Opened:** Name empty and focused; every switch on.
- **Not a workspace owner:** only `Reviews with you` can be chosen; the two others are disabled, and one line under the choice reads `Only an owner of the workspace chooses the two others.`
- **Works alone without a PM, an Architect or a Reviewer:** `Works alone` is disabled until all three
  switches are on, and one line under the choice reads `Works alone needs a PM, an Architect and a Reviewer.`; switching one off while it is chosen moves the choice to `Own branch`.
- **Name taken:** `Name taken: choose another` under the field; nothing else moves.
- **Every switch off, or no name:** Create fleet disabled.
- **Creating:** the primary reads `Creating…`, disabled.
- **Refused for the form:** the cap of 12 active fleets, or a failure, above the foot's buttons.
- **Created:** the drawer closes on the new fleet in the Fleet section, its chip selected and marked
  `Virtual` (its Operation room once the Fleet's tabs exist, PRD 2842 s6).

## Words

- `+ New virtual fleet`, `New virtual fleet`, `Name`, `Icon`, `Heroes`, `Cancel`, `Create fleet`,
  `Creating…`, `Name taken: choose another`, `Runs <k> of <n> skills alone`,
  `A person does this today`, `Virtual`, `Level`, `Reviews with you`, `You merge each PRD`, `Own branch`,
  `You land the mission`, `Works alone`, `Asks you when needed`,
  `Only an owner of the workspace chooses the two others.`,
  `Works alone needs a PM, an Architect and a Reviewer.`.

## Refusals

- No colour field: the colour is picked for it and changed in Settings › Fleets.
- No person's first name for a hero; no human face for an agent.

## Open questions

- Whether the icon list adds agent-like icons beyond the fleet mascots.
- What a member who is not an owner reads beside the two disabled levels.

## Source

/omni:brainstorm, PRD 2842: .omni-loop/delivery/shipped/2842-missions/before-after.html
/omni:brainstorm, PRD 2873: .omni-loop/delivery/shipped/2873-heroes-every-skill/before-after.html
/omni:brainstorm, PRD 2896: .omni-loop/delivery/inbox/2896-fleet-alone/before-after.html
