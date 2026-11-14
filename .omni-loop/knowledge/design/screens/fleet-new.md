---
screen: fleet-new
status: draft
kind: page
mock: fleet-new.html
implements: []
reads: []
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
- **Icon,** the fleet mascots as tiles, the first selected.
- **Heroes,** the five roles (Engineer, QA, Reviewer, PM, Architect), each a yes/no switch, all on,
  each with one line on whether it works alone today.
- **The foot,** `Cancel` and `Create fleet`, the primary.

## States

- **Opened:** Name empty and focused; every switch on.
- **Name taken:** `Name taken: choose another` under the field; nothing else moves.
- **Every switch off:** Create fleet disabled.
- **Created:** the drawer closes on the new fleet's Operation room, its chip selected and marked
  virtual.

## Words

- `New virtual fleet`, `Name`, `Icon`, `Heroes`, `Cancel`, `Create fleet`, `Name taken: choose
  another`, `A person does this today`.

## Refusals

- No colour field: the colour is picked for it and changed in Settings › Fleets.
- No person's first name for a hero; no human face for an agent.

## Open questions

- Whether the icon list adds agent-like icons beyond the fleet mascots.

## Source

/omni:brainstorm, PRD 2842: .omni-loop/delivery/inbox/2842-missions/before-after.html
