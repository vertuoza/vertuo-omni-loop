---
screen: fleet-frame
status: draft
kind: shared
mock: fleet-frame.html
implements: []
reads: []
routes: []
supersedes: null
---

## Purpose

The structure every page of a fleet shares: the fleet's header and its tabs, so a person moves
between the fleet's room, its missions, its seats and its board without leaving the fleet. It sits
inside the app shell, under the sidebar's existing Fleet entry.

## Regions

- **The header:** the fleet's name, its colour and its mascot, drawn once.
- **The tabs:** Operation room · Missions · Heroes · Board, the current one marked.
- **The page area:** the tab's own screen (`fleet-room`, `mission-start`, `fleet-seats`, or
  today's fleet board).

## States

- **One fleet:** the header names it; no picker.
- **Several fleets:** which fleet the person sees is an open question.

## Words

- `Operation room`, `Missions`, `Heroes`, `Board`.

## Refusals

- No colour per role and no palette of its own: the fleet's colour appears once, in the header.
- No tab named Team: the glossary keeps "team" out.

## Open questions

- The routes: whether the Operation room becomes `/app/fleet` and today's board moves to a tab,
  or each tab gets its own path.
- How a person with several fleets picks one.
- Whether Missions replaces the sidebar's Loop entry (the panel's view) or sits beside it.

## Source

/omni:think-big, concept #2800, crowned A on 2026-11-13: .omni-loop/delivery/inbox/concepts/2800-fleet-operation-room/vision.html
/omni:brainstorm, PRD 2842: .omni-loop/delivery/inbox/2842-missions/before-after.html
