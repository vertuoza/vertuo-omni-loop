---
id: s1-02-outcome-note-shape
prd: 2498
slice: s1
rank: medium
bears-on: none
raised: 2026-10-23
wave: 1
---

## The question, in plain words

How long may the words of an outcome be: the name of the rule that already says it, and the question asked?

## The decision, in plain words

The name of a rule is one line of at most 200 characters. A question may take up to 2000 characters, on several lines if it needs them, so it can carry the option the agent would take.

## The intro, for fun

A rule's name should fit on a sticky note; a good question sometimes needs the whole napkin.

## The punchline, for fun

So the rule gets the sticky note, and the question gets the napkin.

## The options, in plain words

A. A rule of one line, 200 characters at most; a question of 2000 characters at most, on several lines, the option built.
B. Both one line of at most 500 characters, as a rejection's reason.
C. No limit beyond the column's 2000 characters for either.

## What I had to decide

The limits on the note of an outcome: the rule that already says it, and the question.
Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

rewind_finding_outcome() trims the note; an already said takes one line of at most 200 characters, a question at most 2000 characters on any number of lines; anything longer is refused (22023, note). The column refuses more than 2000 either way.

## What it costs to change later

A constant in the function and one column check; a follow-up migration changes either.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) no written rule says how long a rule's id or a question to a person may be; 200 and 2000 follow the rewind's own limits (a reason of 500, a finding's text of 4000)
