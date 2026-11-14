---
id: s2-04-round-two-reasons-in-the-review
prd: 2871
slice: s2
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

In its second round the Reviewer settles each point it raised in the first, and must give its reason once. Where should that reason go, so a settled point is not handed to the product manager by mistake?

## The decision, in plain words

A point the Reviewer accepts as settled gets its reason in the second review's summary, not as a reply on its thread. A point it keeps is raised again in the second review, on the same line, saying why the answer did not settle it, and then a person decides.

## The intro, for fun

Round two: the Reviewer checks every answer it got to its first notes.

## The punchline, for fun

It nods in one place, and repeats itself only where it must.

## The options, in plain words

A. Settled points get their reason in the second review's summary, and kept points are raised again in the second review (built).
B. The Reviewer replies on each first-round thread with its reason, which hands every one of them, settled or not, to the product manager.

## What I had to decide

`omni care state` reads any comment after a care reply as a person's and lists the thread for the PM (`mark-asked`), even a resolved one (`kit/lib/care/state.ts`, `repliedThread`). So a Reviewer reply on a thread it accepts would send a settled thread to the PM. The verdict schema of s1 gives round 2 one `summary` line (500 characters at most) and 1 to 5 findings: resolved reasons go in the summary, and a kept finding is a round-2 finding on its round-1 line, its problem opening `Kept from round 1:`. A still-open thread the Reviewer accepts is resolved through GraphQL; it is the Reviewer's own thread, never a person's.

Decided by: Jev (hardToRevert 0.58) · agent said false

## What I did meanwhile

Built as option A in step 4 of the skill.

## What it costs to change later

A constant: replying on threads instead is a change to step 4 of the skill and to how care state reads a reply, with no stored data to move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether five resolved reasons fit the summary's 500 characters on a busy round, or the schema should give round 2 a field of its own.
