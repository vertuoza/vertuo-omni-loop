---
id: s4-02-undo-holds-the-delete
prd: 3107
slice: s4
rank: medium
bears-on: none
raised: 2026-11-20
wave: 4
---

## The question, in plain words

When a member deletes a notebook line, they can undo it for 5 seconds. Should the line be deleted at once and brought back on undo, or only deleted once the 5 seconds have passed?

## The decision, in plain words

The page waits 5 seconds before it deletes the line; undo simply cancels the wait. A line, once deleted, is never brought back, so the record of who deleted it is never erased.

## The intro, for fun

Every eraser comes with five seconds of second thoughts.

## The punchline, for fun

After that, the ink is gone and the name of the eraser stays.

## The options, in plain words

A. Hold the deletion 5 seconds on the page, then send it; the database never restores a line.
B. Delete at once, and let undo restore the line within 5 seconds, erasing the deletion record.
C. Delete at once, and let undo add a new restore record beside the deletion.

## What I had to decide

The drawer shows Deleted by <login> · <time> with Undo for 5 seconds, then calls commander_note_delete(); leaving the tab sends what waits at once. The database has no restore: a deletion is recorded once, never undone.

## What I did meanwhile

Deletion is one database call; undo is a timer on the page.

## What it costs to change later

Low: a restore function and an undo call can be added later without changing the stored lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says Delete with Undo for 5 seconds and that the deletion is recorded with who and when; it does not say whether undo restores a recorded deletion
- (author) A browser closed within the 5 seconds may not send the deletion
