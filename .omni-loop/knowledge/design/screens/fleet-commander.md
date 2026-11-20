---
screen: fleet-commander
status: draft
kind: page
mock: fleet-commander.html
implements: [apps/galaxy/src/virtual-fleets/commander/CommanderTab.tsx]
reads: [apps/galaxy/src/virtual-fleets/commander/commander.client.ts, apps/galaxy/src/dashboard/fleet/tabs.ts]
routes: [/app/fleet]
supersedes: null
---

## Purpose

The Commander tab of a Virtual Fleet (`?tab=commander`), inside `fleet-frame`: one thread per fleet,
shared by the workspace's members, where a member asks what the fleet is doing, answers the questions
waiting on a person from cards, and writes to the fleet. The Commander is an agent and signs as one.

## Regions

- **The status line:** missions running, waiting and paused (each a link), today's tokens, and
  **Notebooks · <n>**. Read from the database, never the model.
- **The thread** (left): day separators; a member's message signed by their login; a Commander reply
  signed with its glyph (not a face) and `Commander · agent`: a bold verdict, one row per claim with
  its source chip on the right, and a footer of what it read and what was removed.
- **The Waiting on you rail** (right, sticky): one card per question waiting on a person, built from
  its record: where it comes from, the question, its choices, `Answers as <login>`; an approval
  card links to the PRD's page. It needs no model.
- **The box:** `Ask` | `Message fleet`, the text, and its one primary button (**Ask** or **Send to
  fleet**).
- **The Notebooks drawer** (over the rail): the fleet notebook, then one per mission (delivered ones
  folded), each line dated with its events chip and **Delete**, Undo for 5 seconds.

## States

- **2.A A thread**, a card answered by another member, a message read by a job.
- **2.B The Notebooks drawer.**
- **2.C Tokens used up:** the notice in place of the box; the rail still answers.
- **2.D Off, no model key:** an empty state with a Settings link; the rail still answers.
- **2.E A first visit:** `Ask about this fleet.` and three suggested questions.
- **2.F Reading the record:** a pending row naming what it reads, the button disabled.
- **2.G Confirming an answer:** `Answer as <login>?`, Confirm and Cancel.

## Words

- `Commander`, `agent`, `Notebooks`, `Fleet notebook`, `Waiting on you`, `Answers as <login>`,
  `Answer as <login>?`, `Confirm`, `Answered by <login> · <time> · <choice>`, `Not sent: try again.`,
  `Nothing waits on you.`, `Ask`, `Message fleet`, `Ask the Commander`,
  `Agents read this at their next job`, `Send to fleet`, `To the fleet`, `Waiting for next job`,
  `Read by <role> · job <id>`, `No mission running: no agent will read this.`,
  `Read <n> events · <time>`, `<k> sentence removed: no link.`, `Reading the record`,
  `Ask about this fleet.`, `Tokens used up. Back at <time> UTC.`,
  `The Commander is off: no model key.`, `No answer: try again.`,
  `I could not find that in the fleet's record.`, `Delete`, `Undo`

## Refusals

- No first name, face or avatar for the Commander: a role glyph, as the Engineer and Reviewer have
  (never#10).
- No choice picked or answer written by the Commander: a card answers only on a member's confirm.
- No card built from the model's words, and no link written by the model.
- No sentence about the fleet without a source.

## Open questions

- Whether the empty thread suggests first questions.
- Whether a message to the fleet can be aimed at one mission rather than all running ones.
- Phone layout.

## Source

/omni:brainstorm, PRD 3107: .omni-loop/delivery/shipped/3107-fleet-commander/before-after.html
