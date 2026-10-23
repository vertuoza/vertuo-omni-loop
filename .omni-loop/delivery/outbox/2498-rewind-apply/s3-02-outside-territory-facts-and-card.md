---
id: s3-02-outside-territory-facts-and-card
prd: 2498
slice: s3
rank: medium
bears-on: none
raised: 2026-10-23
wave: 3
---

## The question, in plain words

This step changed two small things the earlier step built, outside the ground it was given. May it?

## The decision, in plain words

Yes: what the kit prints of a finding now keeps its id and whether it is settled, so the agent finds its finding and never settles one twice. The card says the rule is being proposed only on findings sent to the agent, not on glossary or Legal ones.

## The intro, for fun

The new agent got its job and found the address book had torn out every name.

## The punchline, for fun

So it glued the names back in, and tidied the card on the way out.

## The options, in plain words

A. Change both here, each with its test, the option built.
B. Leave both as they were for a follow-up step: until then the skill cannot find its finding, and glossary and Legal cards keep the note.

## What I had to decide

Whether a step may change two files of the earlier step, each with its test, to finish its own job.

## What I did meanwhile

kit/lib/rewind/facts.ts keeps each finding's `id` and `outcome` in `omni rewind facts --json` (tested in kit/bin/rewind.test.ts); MainPane.tsx shows `Proposing the rule…` only when `proposesRule()` of rewind.approval.ts says Approve queued the skill (tested in MainPane.test.ts). This settles what s2-01 left for this step.

## What it costs to change later

Two lines of code and two tests; undoing either is a revert of its line, and no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan gives kit/lib/rewind/ and the Main tab's card to s2 only, but the skill cannot find its finding without the id, and s2-01 left the card's note for this step
