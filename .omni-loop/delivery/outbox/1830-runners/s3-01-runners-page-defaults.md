---
id: s3-01-runners-page-defaults
prd: 1830
slice: s3
rank: medium
bears-on: none
raised: 2026-10-13
wave: 2
---

## The question, in plain words

The Runners page design left two points open: which button stands out as the main one, and what a job that a machine has taken but not yet started is called.

## The decision, in plain words

Only the most recent Send again button stands out, and none does while nothing failed. A job a machine has taken but not started yet reads Starting.

## The intro, for fun

A control panel full of bright buttons looks like a fruit machine.

## The punchline, for fun

So only one button gets to glow, and the rest wear grey.

## The options, in plain words

A. A. The newest Send again is the one primary action, none while nothing failed; a claimed job reads Starting.
B. B. No primary action on the page at all; a claimed job reads Queued.
C. C. Every Send again is highlighted; a claimed job reads Running.

## What I had to decide

Keep one highlighted Send again (the newest failed or cancelled job) and the word Starting, or pick another main action and word.

## What I did meanwhile

apps/galaxy/src/runners/page/RunnersPage.tsx marks the first Send again in the list (the newest ended job that failed or was cancelled) as the page's one primary action; every other button is quiet. A claimed job's status reads Starting (apps/galaxy/src/runners/page/model.ts, statusWords).

## What it costs to change later

A line each in RunnersPage.tsx and model.ts, and their render tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The runners screen lists 'Is Send again the page's one primary action, or does the page have none while nothing failed?' as an open question; the mockup marks one Send again as primary.
- (author) The screen's Words list no word for a claimed job; Starting is new.
- (author) Whether a member sees jobs of fleets they are not in is decided by s1's board read, not by this page: the page shows every job the board returns.
