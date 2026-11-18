---
id: s4-03-milestone-retros-run-and-shape
prd: 3065
slice: s4
rank: medium
bears-on: none
raised: 2026-11-18
wave: 2
---

## The question, in plain words

How does a delivered mission still get its retros, and how is a proposed rule change written down for the mission page to show?

## The decision, in plain words

A delivered mission keeps being checked until each retro it sent is written down, one retro at a time, and one over its token budget skips the ones it never sent. A proposed change names what it changes in plain words that start with law, rule or the form's name, so the page can tell them apart.

## The intro, for fun

The party is over, but someone still has to write the thank-you notes.

## The punchline, for fun

The supervisor stays behind with the pen, one note at a time.

## The options, in plain words

A. A. Keep watching a delivered mission until its retros are written, one milestone retro at a time, and keep a target as plain words with its kind first.
B. B. Also hold a milestone retro back while a stuck repair works, so only one retro of any kind runs per mission.
C. C. Keep an item's target as separate fields (its kind, its id, its form and section) in a follow-up migration.

## What I had to decide

Confirm how milestone retros run and how an item's target is kept, or pick another. The run is apps/omni-app/src/missions/milestone.ts and milestone-run.ts; the target words are targetWords there, which the mission page (s5) reads.

## What I did meanwhile

Built A: a delivered mission's job keeps running while a milestone retro it sent is not recorded yet, then ends; the roadmaps' retros go first and the mission's last, never two at once, while a stuck repair or a PRD's repair may run beside one. A delivered mission over a cap keeps each milestone it did not send as skipped, `budget reached`. An item's target is kept as `law <id>`, `rule <id>` or `the <form> form: <section>`; its file is kept empty, since the retro's record line names no file per item; a retro's file the database would refuse is kept empty too.

## What it costs to change later

Low: the target words are text in mission_items, read by the mission page alone; a different shape is one function and the rows written so far, which a short follow-up can rewrite before any person answers one.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's 'one retro at a time per mission' could also hold a milestone retro back while a stuck repair works; this slice reads it as one milestone retro at a time.
- (author) A mission delivered before this change, whose job runs again, sends its mission retro then: nothing in the spec says to leave such missions out.
