---
id: s7-05-held-since-the-call-that-failed
prd: 1548
slice: s7
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

When the server cannot be reached, since when does the terminal say it has been unreachable?

## The decision, in plain words

Since the call that just failed: the terminal keeps no memory of an earlier failure, so the time is now.

## The intro, for fun

Held since when is an easy question with an awkward answer.

## The punchline, for fun

Since just now, every time.

## The options, in plain words

A. The time of the failed call, the option built.
B. The time of the first failure in a row, kept on this computer until a call works.

## What I had to decide

The time the held line names.

## What I did meanwhile

The time of the failed call, printed in the held line, and the command exits as held, not failed.

## What it costs to change later

Remembering the first failure would be a small local note and one change here.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the page's own held line, in a later slice, wants the two times to agree.
