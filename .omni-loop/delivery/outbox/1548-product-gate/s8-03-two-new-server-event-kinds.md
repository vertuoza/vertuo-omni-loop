---
id: s8-03-two-new-server-event-kinds
prd: 1548
slice: s8
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

How does the web app tell the GitHub app that a question of a product PRD was raised or answered, so both checks on its pull requests follow?

## The decision, in plain words

Through the same signed message the approval already sends, with two new kinds, a question opened and a question settled (an adoption counts as settled), naming the PRD's own record. The GitHub app then runs every check a push would run again on each open pull request of that PRD, so both checks follow, and the third check, on a PRD's design files, runs again too.

## The intro, for fun

The two apps already pass notes, so we added two new words to their secret language.

## The punchline, for fun

Opened and settled: short enough to whisper, clear enough to act on.

## The options, in plain words

A. Two new kinds, opened and settled, on the same message (built).
B. One kind for any change to the outbox.
C. Name the PRD by its short name rather than its record.
D. A message of its own that runs only the two checks, which changes a test that proves a rule of the gate.

## What I had to decide

The names of the two new kinds of message, what each one carries, and which checks a message posts again.

## What I did meanwhile

Built as described. The answer screen built beside this slice can send the settled kind the same way once it settles a question.

## What it costs to change later

Renaming a kind is a constant on each side, sent and read in the same release.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether an adoption should rather send a kind of its own; it holds no question open, so it changes nothing a check shows unless it closes one already open.
- (author) Running the design-files check again costs a few more GitHub calls per pull request; a message of its own would avoid that, but it changes the test that proves how the gate reads its settings, which takes a question ranked high.
