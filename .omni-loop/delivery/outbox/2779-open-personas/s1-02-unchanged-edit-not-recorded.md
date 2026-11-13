---
id: s1-02-unchanged-edit-not-recorded
prd: 2779
slice: s1
rank: medium
bears-on: none
raised: 2026-11-13
wave: 1
---

## The question, in plain words

When someone saves a persona without changing any of its fields, should the knowledge history still get a line saying it was edited?

## The decision, in plain words

No line is added when nothing changed. A save that changes at least one field adds one line, with the persona before and after, as Legal and Glossary changes already do.

## The intro, for fun

Saving a persona you did not touch is a very calm afternoon.

## The punchline, for fun

The history writes down changes, not sighs.

## The options, in plain words

A. A. A save that changes no field adds no line to the history.
B. B. Every save adds a line, even when nothing changed.

## What I had to decide

Keep A when the history should hold real changes only, as it does for Legal entries and terms. Pick B when every save must be on record, even one that changed nothing.

## What I did meanwhile

Adding, deleting and bringing back a persona always add a line; an edit adds one only when a field changed.

## What it costs to change later

B drops one comparison in the database's edit function and one line of its check.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says an edit appends an edited event, and does not say what a save with no change does (author).
- Legal and Glossary edits already skip a save that changed nothing, which this follows.
