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
- **Repair rows** (PRD 2980): `Repair n of 3 started for PRD <n> · m left in this mission`
  (`Supervisor · agent`), `Retro: <the cause> · Cause <fingerprint>, in the code` or `in Omni Loop`
  (`Engineer · agent`), `Repair n of 3 ended: …` with its fix PR and `Fixed` or `Not fixed`, and
  `Reported Omni Loop bug #<n>, scrubbed` (`Supervisor · agent`).
- **Filters:** by role and by mission, kept in the address.
- **A Reviewer row, opened:** its verdict, `pass` or `changes`, its findings (at most five),
  and the round (`Round 1 of 2`).
- **A QA row** (PRD 3001): signed `QA · agent`, its verdict, the round and the bugs' issues
  (`2 bugs found · Round 1 of 2 · #3012 #3013`); the Engineer's fix rows `fixed #3012` or `not fixed #3013: <why>`.
- **Tokens** (PRD 3001): every job row ends with what it spent, `· 41k tokens`, or `· tokens unknown`.
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
- **Checking:** QA checks a PRD on its preview: `Checking PR <n> · round 1 of 2`, or `Waiting for the preview` (PRD 3001).
- **Decide the bugs:** a bug still there after QA's round 2: `Waits for you · Decide the bugs`, the bugs listed by issue, with
  `Send on to the Reviewer` or `Stop this PRD` (PRD 3001).
- **Resumed:** a runner went silent; the work carried on elsewhere from its last save, the minutes
  redone; work that could only stay on the lost runner is named.
- **Repairing** (PRD 2980): `Repairing (1 of 3) · 8 left`, the fix PR linked as the one action.
- **Stuck** (PRD 3065): a Supervisor row `Stuck: 5 jobs, nothing moved. Repairing (1 of 3) · 7 left in this mission.`, the fix PR
  linked; a milestone retro's row `Retro: roadmap #<n> delivered.` linking its file; a proposed change's row
  `Proposes a change to <id>.` reading `Waiting for you`, and the answer's row signed by the person.
- **Stopped:** why, which limit was hit, how to resume. After repairs (PRD 2980), a block under
  the now lines: the cause and its fingerprint, the repairs tried (each PR and its outcome), the
  proposed fix, `6 of 9 in this mission` left, **Resume** (`Resume: 3 more for this cause`) as the
  one action, and `Take it by hand`.
- **Waits on Omni Loop** (PRD 2980): `Waits on Omni Loop bug #3012`, linked, and how many missions
  met it; the issue holds none of the workspace's work.
- **Omni Loop bug fixed** (PRD 3088): a Supervisor row `Omni Loop bug #3102 is fixed in v0.0.690.`;
  the PRD's now line reads `PRD 412 · fixed in v0.0.690 · update kit` while the repository's kit is
  older, then `PRD 412 · resumed · bug #3102 fixed` once it is not; closed as not planned,
  `PRD 412 · bug #3102 won't be fixed`, stopped, with `take this PRD by hand` in the ledger.
- **The Omni Loop bug team** (PRD 3088, an `omni-bugs` mission, on the Omni Loop repository only):
  one now line per bug it holds, `Fixing #3102 · reported 7×` (its run linked as the one action),
  `#3097 · 4× · PR #3111 to merge` (`Waiting for a merge`), `#3090 · asked: not reproducible`
  (`Asked`); ledger rows `Took Omni Loop bug #3102, reported 7×.`, `Bug #3090 set aside: a person is
  asked once.`, `Omni Loop bug #3081 is fixed in v0.0.684.` It never names a workspace that reported
  a bug, only how often it was reported.
- **Idle:** nothing assigned.
- **Not on this fleet:** no runner can run the seat, and why.
- **Empty:** no mission has run yet; the page says so and points to Missions.

## Words

- `Reviewer · agent`, `Engineer · agent`, `QA · agent`, `Designer · agent`, `A person does this today`,
  `Nothing to clean up`, `Round 1 of 2`, `Waiting for room`, `Waiting until 09:00`, `Ready for review`, `Repairing (1 of 3)`,
  `8 left`, `Retro`, `Fixed`, `Not fixed`, `Waits on Omni Loop`, `Resume`, `Take it by hand`.
- Never `post-mortem`: the glossary's word is **Retro**.

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
- `Supervisor · agent` has no 16 px mark in the library yet: PRD 2980's page draws a ring as a
  stand-in.

## Source

/omni:think-big, concept #2800, crowned A on 2026-11-13: .omni-loop/delivery/inbox/concepts/2800-fleet-operation-room/vision.html
/omni:brainstorm, PRD 2842: .omni-loop/delivery/shipped/2842-missions/before-after.html
/omni:brainstorm, PRD 2871: .omni-loop/delivery/shipped/2871-reviewer/before-after.html
/omni:brainstorm, PRD 2873: .omni-loop/delivery/shipped/2873-heroes-every-skill/before-after.html (an idle hero with a skill that runs alone reads `Idle`; the Designer has a now line)
/omni:brainstorm, PRD 2949: .omni-loop/delivery/shipped/2949-limit-waits/before-after.html (the two waiting lines)
/omni:brainstorm, PRD 2980: .omni-loop/delivery/shipped/2980-mission-repairs/before-after.html (Repairing, Stopped after repairs, Waits on Omni Loop, the repair rows)
/omni:brainstorm, PRD 3001: .omni-loop/delivery/shipped/3001-qa-turn/before-after.html (QA rows, Checking, Decide the bugs, tokens on every row)
/omni:brainstorm, PRD 3040: .omni-loop/delivery/shipped/3040-token-budget/before-after.html (the budget stop row)
/omni:brainstorm, PRD 3065: .omni-loop/delivery/shipped/3065-mission-retros/before-after.html (the stuck, milestone-retro and proposed-change rows)
/omni:brainstorm, PRD 3088: .omni-loop/delivery/inbox/3088-omni-bug-team/before-after.html (the bug team's rows, Omni Loop bug fixed, update kit, won't be fixed)
