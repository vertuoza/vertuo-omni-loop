---
id: s7-02-approved-knowledge-rule-writes-nothing
prd: 2410
slice: s7
rank: medium
bears-on: none
raised: 2026-10-23
wave: 5
---

## The question, in plain words

Approving a finding about the playbook or a register sends a job that writes nothing: the helper it starts refuses to write with nobody at the screen, and it does not write playbook or register rules at all. Is that acceptable for now, though the spec promises the rule gets written?

## The decision, in plain words

Approve sends the job as the spec says, and the card tells the member right after the click that, on a runner, it writes nothing yet and the rule still waits for a person to write it.

## The intro, for fun

The member said yes, the helper was called, and the helper only works when someone is watching.

## The punchline, for fun

So the yes is kept on file, and the rule waits politely for a human pen.

## The options, in plain words

A. Queue /omni:knowledge-add as the spec says; the card says it writes nothing on a runner yet (built).
B. Queue nothing: record the approval and say the rule waits for a person to write it.
C. Teach /omni:knowledge-add to propose a playbook or register rule with nobody at the screen, in a follow-up PRD.

## What I had to decide

Pick A to keep sending the job with the warning, B to send nothing and only record the approval, or C to give the helper a way to propose a playbook or register rule with nobody at the screen, in a follow-up PRD. Decided by: Jev (hardToRevert 0.48) · agent said true

## What I did meanwhile

A knowledge finding that names no glossary term (in backticks or quotes) and no Legal code (L-<CODE>) queues /omni:knowledge-add rewind of PRD <n>: <its fix> on a runner, sent by the member who approved. The skill stops at once under OMNI_UNATTENDED (settled item s6-01), and it only handles constituents, Legal entries and glossary terms, so nothing is written. The card's answer reads: Queued /omni:knowledge-add on a runner of the workspace, sent by you. On a runner it writes nothing yet: the rule still waits for a person to write it.

## What it costs to change later

B is one branch of the approval plan and one sentence of the card. C is a change to the knowledge-add skill (an unattended path that proposes a playbook or register rule for its owner, never writes it) and to the runner's docs, outside this PRD's territory; Approve itself would not change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec promises that Approve on a playbook or register finding gets the rule written; with the skill as it is, that promise is not kept on a runner, and the member is told so only on the card.
- (author) Whether an unattended knowledge-add should propose (wait for the section's owner) or apply was not asked.
