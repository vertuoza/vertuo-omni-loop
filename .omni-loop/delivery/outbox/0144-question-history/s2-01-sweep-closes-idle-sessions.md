---
id: s2-01-sweep-closes-idle-sessions
prd: 144
slice: s2
rank: high
bears-on: ADR-0030
raised: 2026-09-26
wave: 2
---

## The question, in plain words

Now that questions are kept for good, the hourly clean-up deletes nothing; should it still close a session left idle for twelve hours, which an earlier decision said it would never do?

## The decision, in plain words

Yes: the hourly job now marks a session closed once it has sat idle for twelve hours, dated twelve hours after it went quiet, and deletes nothing. The old clean-up that deleted week-old sessions is gone.

## The intro, for fun

The hourly janitor used to throw old questions away; now it only turns off the lights.

## The punchline, for fun

Everything stays on the shelf, just in a darker room.

## The options, in plain words

A. Replace the deleting job with one that closes a session idle for twelve hours and deletes nothing
B. Drop the hourly job entirely: nothing is deleted, and an idle session keeps reading as closed without being rewritten

## What I had to decide

Keep the hourly job closing idle sessions, or drop it and let an idle session only read as closed, as before.

## What I did meanwhile

Idle sessions are closed by the hourly job, which deletes nothing; a closed session shows the same to everyone as before.

## What it costs to change later

Going back is one small migration that unschedules the job; sessions it already closed stay closed, which the pages already show them as.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the function ask_sweep() and says it still closes idle sessions, while the function in the database was ask_expire(), which only deleted and never closed; I read the spec as asking for a job that closes and deletes nothing (author)
- The earlier decision record on expiry says idle sessions are never rewritten; this slice cannot edit that record, which sits outside its files (author)
