---
id: s1-01-persona-undo-keeps-the-row
prd: 799
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

When someone deletes a persona, should it be erased for good straight away, or kept out of sight so Undo can bring back exactly the same persona?

## The decision, in plain words

A deleted persona disappears for everyone at once, but it is kept out of sight so Undo brings it back as it was, in the same place in the list. Nothing erases it for good yet.

## The intro, for fun

Every cast has an actor who storms off the set and comes back five seconds later.

## The punchline, for fun

So the dressing room stays unlocked, just in case.

## The options, in plain words

A. Keep it hidden: Delete hides it, Undo shows it again, same place in the list. Hidden rows stay until a later cleanup.
B. Erase at once: Delete erases it; Undo adds it back from what the page still holds, at the end of the list.
C. Keep it hidden for a while: As the first, plus a daily job erasing personas hidden for more than a set time.

## What I had to decide

Whether a deleted persona is kept out of sight (Undo brings it back) or erased at once (Undo re-creates it from the page's copy).

## What I did meanwhile

Deleted personas are hidden from everyone, agents included, and kept in the database.

## What it costs to change later

Switching to erase-at-once is one follow-up change to the delete and restore functions and a cleanup of the hidden rows; no page or agent changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No rule yet on how long a hidden persona is kept before it is erased for good (author).
