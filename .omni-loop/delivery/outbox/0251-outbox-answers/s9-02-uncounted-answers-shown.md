---
id: s9-02-uncounted-answers-shown
prd: 251
slice: s9
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When someone GitHub does not list as a member of the repository answers a question, should the Outbox tab show that answer?

## The decision, in plain words

It shows it, marked as an answer the fix-up run will not read, unless a member answered the same question: then the member's answer is the one shown, even if the other came later.

## The intro, for fun

A stranger shouted an answer from the back of the room.

## The punchline, for fun

We wrote it down, in pencil.

## The options, in plain words

A. Show the member's answer when there is one, else the outsider's, marked as not read by the fix-up run.
B. Show only the answers the kit would read, and nothing from outsiders.
C. Show the latest answer whoever wrote it, marked when it will not be read, even over a member's earlier one.

## What I had to decide

The spec asks for each pending answer and whether its author counts, and says the latest reply per number wins. The kit's reply reader only reads replies from owners, members and collaborators, so an answer from anyone else never settles anything. The spec does not say which answer the tab shows when a counted one and a later uncounted one answer the same number.

## What I did meanwhile

The reader runs the kit's reply reader twice, once as the kit does and once as if every author counted. A number the kit would settle shows the kit's answer; a number only an uncounted author answered shows that answer, marked as one the fix-up run will not read.

## What it costs to change later

A constant: which of the two readings wins is one line in the reader; hiding uncounted answers altogether is dropping the second reading.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether showing an outsider's answer on the page could mislead a person into thinking the question is settled.
