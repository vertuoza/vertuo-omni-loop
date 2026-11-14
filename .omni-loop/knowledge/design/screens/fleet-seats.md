---
screen: fleet-seats
status: draft
kind: page
mock: fleet-seats.html
implements: []
reads: []
routes: []
supersedes: null
---

## Purpose

The fleet's five seats: who holds each, agent or person, what it runs today and its limits, written
as sentences. A seat moves from a person to an agent only once its skill runs on a runner with
nobody at it.

## Regions

- **One row per seat:** PM, Engineer, Architect, QA, Reviewer; its holder (`agent` or a member's
  name), the skills it runs, and its limits (`Reviewer sends work back at most twice, then asks
  you.`).
- **The seats a person holds today, and why:** the PM's brainstorm and roadmap need a person; the
  Architect has no skill that runs unattended yet.
- **The primary action:** `Save seats`, active only after a change.

## States

- **Agent:** runs on the fleet's runners.
- **A person does this today:** names the member.
- **Not on this fleet:** no runner can run it, and why.

## Words

- `Seats`, `A person does this today`, `Save seats`.

## Refusals

- No first names, faces or human voices for agents.
- No seat set to an agent whose skill cannot run unattended.

## Open questions

- PRD 2842 makes this the **Heroes** tab of a Virtual Fleet: one row per Virtual Hero (sprite in the
  fleet's colour, name, role, skills, preferred agent and model, limits, and `Works alone` or `A
  person does this today` with why), `Add a hero` its primary action; the tab is named Heroes, not
  Seats.

- Who may change a seat's holder (the workspace owner only, or the fleet's members).
- Whether QA may write the branch: the person said QA may fix a bug itself; the F-E Developer and
  B-E DEv personas want one writer per branch. The concept lets QA hold the branch while it fixes,
  then hand it back.

## Source

/omni:think-big, concept #2800, crowned A on 2026-11-13: .omni-loop/delivery/inbox/concepts/2800-fleet-operation-room/vision.html
/omni:brainstorm, PRD 2842: .omni-loop/delivery/inbox/2842-missions/before-after.html
