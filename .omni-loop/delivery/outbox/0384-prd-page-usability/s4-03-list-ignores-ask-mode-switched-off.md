---
id: s4-03-list-ignores-ask-mode-switched-off
prd: 384
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 4
---

## The question, in plain words

If ask mode is switched off while a quick question is still waiting, should the list keep offering the one-click buttons until the question's time is up?

## The decision, in plain words

Yes for now: the list reads only whether the question is open and has time left, so buttons stay until it moves to the terminal, while the question's own page already says the session is closed.

## The intro, for fun

The shop put the closed sign up, but the side window still takes orders for a few minutes.

## The punchline, for fun

Nobody is at the counter to read them, though.

## The options, in plain words

A. A. Offer buttons on open questions with time left, as built: no extra read, a rare answer may land in a closed session.
B. B. Also read each question's session on the server and hide buttons once it is closed: one more read per page view.
C. C. Add the session's state to the database's question list: exact, but a migration, which this PRD rules out.

## What I had to decide

Whether the list must also know whether the question's session was switched off, which the list's data does not carry today.

## What I did meanwhile

A quick question of a session switched off keeps its buttons until its time is up; an answer sent then is recorded but nobody in the terminal reads it.

## What it costs to change later

Knowing it means the list reading each session's state, one more small read on the server, or one more column from the database's question list, which is a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How often ask mode is switched off while a question still waits on a page someone has open (author).
