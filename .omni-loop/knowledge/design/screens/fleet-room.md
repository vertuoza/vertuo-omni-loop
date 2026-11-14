---
screen: fleet-room
status: draft
kind: page
mock: fleet-room.html
implements: []
reads: []
routes: []
supersedes: null
---

## Purpose

The Fleet's Operation room: who is doing what, when, as a ledger. A person opens it after a night
with the laptop closed and sees in seconds what moved, what waits on them and whether anything is
left to clean up. Every row is a real row of the job ledger, signed by its role, never narration:
an agent is not a person.

## Regions

- **Now lines:** one line per seat (PM, Engineer, Architect, QA, Reviewer): who holds it, agent or
  person, and one sentence of what it is doing, or its state.
- **The clean-up line:** `Nothing to clean up`, or what is kept, by whom, until when, how big.
- **The ledger:** newest first; each row has its time, the role's mark and name
  (`Reviewer · agent`), one sentence, the PRD or pull request as a link, and a state word.
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
- **Waiting for room:** the fleet is full, or a provider limit holds, until when; no tokens spent.
- **Resumed:** a runner went silent; the work carried on elsewhere from its last save, the minutes
  redone; work that could only stay on the lost runner is named.
- **Stopped:** why, which limit was hit, how to resume.
- **Idle:** nothing assigned.
- **Not on this fleet:** no runner can run the seat, and why.
- **Empty:** no mission has run yet; the page says so and points to Missions.

## Words

- `Reviewer · agent`, `Engineer · agent`, `QA · agent`, `A person does this today`,
  `Nothing to clean up`, `Round 1 of 2`, `Waiting for room`, `Ready for review`.

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
/omni:brainstorm, PRD 2842: .omni-loop/delivery/inbox/2842-missions/before-after.html
