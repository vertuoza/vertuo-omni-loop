---
screen: fleet-room
status: draft
kind: page
mock: fleet-room.html
implements: [apps/galaxy/src/missions/room/RoomTab.tsx, apps/galaxy/src/missions/room/room.ts, apps/galaxy/src/missions/room/room.css]
reads: [apps/galaxy/src/missions/room/room.repository.ts, kit/lib/virtual-fleet/roles.ts, apps/galaxy/src/dashboard/fleet/FleetScreen.tsx]
routes: [/app/fleet]
supersedes: null
---

## Purpose

The Fleet's Operation room: who is doing what, when, as a ledger. A person opens it after a night
with the laptop closed and sees in seconds what moved, what waits on them and whether anything is
left to clean up. Every row is a real row of the job ledger, signed by its role, never narration:
an agent is not a person.

## Regions

- **Now lines:** one line per seat (Engineer, QA, Reviewer, PM, Architect, Designer): who holds it,
  agent or person, and one sentence of what it is doing, or its state. A hero with a skill a runner
  runs alone reads `Idle` when it has nothing to do (the Reviewer, since PRD 2871 runs `/omni:review`
  alone); a hero with none reads `A person does this today` (PRD 2873).
- **The clean-up line:** `Nothing to clean up`, or what is kept, by whom, until when, how big.
- **The ledger:** newest first; each row has its time, the role's mark and name
  (`Reviewer · agent`), one sentence, the PRD or pull request as a link, and a state word.
- **A mission branch row** (PRD 2896): one row each, signed `Supervisor · agent`, for a PRD that joined the
  branch (`Joined`), a drop asked (`Drop asked`) and made (`Dropped`), and a landing (`Landed`), each linking its
  pull request. A rebase of the branch is a row of its own once the App records one.
- **Filters:** by role and by mission, kept in the address.
- **A Reviewer row, opened:** its verdict, `pass` or `changes`, its findings (at most five),
  and the round (`Round 1 of 2`).
- **A ready row:** `PR <n> ready for review · 5 of 5 checks`, opening `ready-checks`.

## States

- **Working:** on what, since when.
- **Handing off:** to which seat, and what it hands over (a QA turn hands the branch back to the
  Engineer).
- **Waiting on a seat:** which one.
- **Waiting for you:** one question, one action.
- **Waiting for room:** every runner of the fleet is busy or paused: `All runners are busy · waiting for room`,
  the queued job linked, `tokens spent waiting 0` (PRD 2949).
- **Waiting for a limit:** a provider limit holds: `Provider limit reached until 09:00 · waiting until 09:00`,
  `(guessed)` when the provider gave no time, the account that ran out named and its job linked,
  `tokens spent waiting 0 · next try 09:00` (PRD 2949).
- **Resumed:** a runner went silent; the work carried on elsewhere from its last save, the minutes
  redone; work that could only stay on the lost runner is named.
- **Stopped:** why, which limit was hit, how to resume.
- **Idle:** nothing assigned.
- **Not on this fleet:** no runner can run the seat, and why.
- **Empty:** no mission has run yet; the page says so and points to Missions.

## Words

- `Reviewer · agent`, `Engineer · agent`, `QA · agent`, `Designer · agent`, `A person does this today`,
  `Nothing to clean up`, `Round 1 of 2`, `Waiting for room`, `Waiting until 09:00`, `Ready for review`.

## Refusals

- No standup, no summary voice, no first names for agents.
- No five role colours: roles are told apart by their name and one 16 px mark.
- No bars sized in hours, no forecast on this page.
- One motion only: a live hand-off row slides in at the top, never on load, and reduced motion
  turns it off.

## Open questions

- PRD 2842 builds this tab with the Engineer seat as the one agent: the Reviewer seat reads `A person does this
  today` until the Reviewer PRD; the ledger's rows are mission events (`Supervisor · agent` for the
  mission's own decisions).

- "Reviewer" is an avoided word in the glossary today (it points to Approver, a person); the person
  named the seat Reviewer and its glossary entry is part of concept #2800's area
  `room-and-reviewer`. Until then the word pass flags it.
- Whether the ledger shows one fleet's missions or every fleet's.
- Paul and Irisa asked for a summary of what waits on them on top; the person refused a standup.
  Whether a plain count line (`2 moved · 1 ready for review · 1 waits on you`) belongs here is
  undecided.
- How long the ledger keeps rows, and what an older row links to.

## Source

/omni:think-big, concept #2800, crowned A on 2026-11-13: .omni-loop/delivery/inbox/concepts/2800-fleet-operation-room/vision.html
/omni:brainstorm, PRD 2842: .omni-loop/delivery/shipped/2842-missions/before-after.html
/omni:brainstorm, PRD 2871: .omni-loop/delivery/shipped/2871-reviewer/before-after.html
/omni:brainstorm, PRD 2873: .omni-loop/delivery/shipped/2873-heroes-every-skill/before-after.html (an idle hero with a skill that runs alone reads `Idle`; the Designer has a now line)
/omni:brainstorm, PRD 2949: .omni-loop/delivery/shipped/2949-limit-waits/before-after.html (the two waiting lines)
