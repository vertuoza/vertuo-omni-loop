---
id: s4-01-page-frame-hands-the-database-to-the-list
prd: 384
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 4
---

## The question, in plain words

The one-click buttons need to know where to send the answer, and the page frame that holds the question list is not among this slice's files. May this slice pass that along through the frame?

## The decision, in plain words

Yes: the page frame now hands the list the same connection it already gives the delete button, one added line, and nothing else in it changed.

## The intro, for fun

The buttons were ready to talk, but the phone line ran through a room they had no key to.

## The punchline, for fun

One extension cord later, the call goes through.

## The options, in plain words

A. A. Pass the connection through the page frame: what was built; one line, the list answers through the same connection as the delete button.
B. B. Carry the connection inside the page's computed view instead: no change to the frame, but settings would mix into what is meant to be plain page data.
C. C. Show no buttons until a later slice owns the frame: nothing outside the slice changes, but the one-click answer would not work.

## What I had to decide

Whether the page frame, which no slice of this wave declares for this work, may pass the database connection down to the question list.

## What I did meanwhile

The page frame passes its existing connection to the question list; with no database, as in the demo, the list shows no buttons.

## What it costs to change later

One line in the page frame; undoing it is removing the pass-through and finding another way to reach the list.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the question list and the one-click piece for this slice, but not the page frame between them, which slice s5 declared in wave 1.
