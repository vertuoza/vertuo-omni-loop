---
id: s7-03-glossary-or-legal-read-from-the-fix
prd: 2410
slice: s7
rank: medium
bears-on: none
raised: 2026-10-23
wave: 5
---

## The question, in plain words

A finding does not say in a field whether it is about a glossary word or a Legal entry, and a proposal needs the word and its meaning, or the code and the statement. How does Approve tell them apart and fill them in?

## The decision, in plain words

Approve reads the finding's fix for the word it names in quotes, or the Legal code it names, and files the fix's own words as the proposal for the owner to read. A finding that names neither goes to the knowledge helper instead.

## The intro, for fun

The finding said add this word, and left the robot to guess which word.

## The punchline, for fun

So it only files the ones that point at their word; the vague ones go to the helper.

## The options, in plain words

A. Read the word or the code from the fix, and file nothing when it names neither (built).
B. Give a finding explicit fields for its glossary word or Legal code, filled in by the rewind.
C. Ask the member for the word and its meaning, or the code and its statement, on Approve.

## What I had to decide

Pick A to keep reading the fix, B to give a finding explicit fields for the word and its meaning (or the code and statement) that the rewind fills in, or C to ask the member for them on Approve.

## What I did meanwhile

A knowledge finding whose fix names a Legal code (L-GDPR) files a Legal proposal under that code, its statement the fix cut to 400 characters, its source the rewind of the PRD and the evidence links; one whose fix says glossary and names a term in backticks or quotes files a glossary proposal, its meaning the fix cut to 400 characters. Both go through the product's own proposal function as the member, on the repository's product, for the kind's owner to decide. Any other knowledge finding queues /omni:knowledge-add.

## What it costs to change later

B is a new optional field in the finding's shape: the table, omni rewind push, the rewind skill and this plan change together, no data to move. C adds a small form to the card, which the voice objection asked to avoid.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The fix's words are the meaning or the statement as the rewind wrote them, the agent's closing line left out; the owner may find them wordier than a glossary meaning should be.
- (author) A Legal entry's source is meant to be the law it comes from; the rewind names none, so the source holds the PRD and the evidence links instead.
- (author) A glossary word that already exists makes the database refuse the proposal; the card then says it was not filed and to propose it on the Knowledge tab.
