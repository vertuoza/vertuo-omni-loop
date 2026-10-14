---
id: s4-01-unlisted-job-link-reads-nothing
prd: 1904
slice: s4
rank: medium
bears-on: none
raised: 2026-10-14
wave: 2
---

## The question, in plain words

When someone opens a shared Terminal link for a job the Runners page no longer lists, the spec does not say whether the panel should still try to read that job's log.

## The decision, in plain words

The panel opens and says the job's log was cleared, without asking the server for any line, since a job that left the page keeps no lines.

## The intro, for fun

An old link to a job that has since left the building.

## The punchline, for fun

The panel waves politely at the empty room and says so.

## The options, in plain words

A. A. Say the log was cleared and read nothing (as built).
B. B. Read the server anyway, and say cleared only when it answers no line.
C. C. Not open the panel at all, and drop the parameter from the address.

## What I had to decide

Keep A, or choose B to read the server anyway and show whatever it answers.

## What I did meanwhile

A link to a job no longer listed opens the panel with the cleared line and no reads.

## What it costs to change later

One condition in the panel; changing it is a one-line edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None: the spec says an unlisted job holds no lines, and the screen says Cleared when the job is no longer listed.
