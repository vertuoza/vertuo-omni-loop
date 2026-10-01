---
id: s18-01-lock-time-read-as-text-only
prd: 725
slice: s18
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The status line keeps a small lock file while it refreshes the board in the background. When that file's time is written in an odd form, should it still be read, or count as unreadable?

## The decision, in plain words

Only a time written as text is read now; any other form counts as unreadable, so the file's own date on disk is used instead, as for a missing time. The tool only ever writes text, so nobody sees a difference in practice.

## The intro, for fun

A lock file with a strange clock walks into the status line.

## The punchline, for fun

It is told to use the date on its own envelope instead.

## The options, in plain words

A. A. Read only a time written as text; anything else falls back to the file's own date (built).
B. B. Keep reading any value as a time, as the untyped code did.

## What I had to decide

Whether a lock file whose time is not text should still have that time read, as the old code did by accident, or count as having no readable time.

## What I did meanwhile

The lock file is now read through a shape description: a time that is not text is dropped, and the file's own modification time stands in, exactly as for a lock with no time at all. Every lock the tool writes holds its time as text, so every real lock reads as before.

## What it costs to change later

A constant: widening the time back to any value is one line in the status line's shape description.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) No lock with a non-text time has ever been seen; the old reading of one (a number taken as a year) was an accident of the language, not a rule anyone wrote.
