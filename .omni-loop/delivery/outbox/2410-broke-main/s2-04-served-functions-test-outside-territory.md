---
id: s2-04-served-functions-test-outside-territory
prd: 2410
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

May this piece change a test outside the files it was given, when that test lists every job the app runs?

## The decision, in plain words

Yes: the test that lists every job the app runs now includes the new watch. Without it the full test run stays red, and the change is one line of the list and two counts.

## The intro, for fun

A new job joined the app, and the roll call in another room still had the old headcount.

## The punchline, for fun

One name added to the roll call, two numbers bumped, nobody else moved a chair.

## The options, in plain words

A. Update the list of the app's jobs in that test (built).
B. Leave the file to a later piece, with that test red until then.

## What I had to decide

Whether s2 edits `apps/omni-app/src/outbox-check/inngest-route.test.ts`, outside its territory, to add `MAIN_WATCH_FUNCTION_ID` to the functions `/api/inngest` serves, `function_count` 18 to 19 and the preview's 13 functions to 14. Decided by: Jev (hardToRevert 0.72) · agent said false

## What I did meanwhile

Built as option A: the three expectations follow `appFunctions`, which now serves `mainWatch`, and nothing else in the file changed.

## What it costs to change later

Three lines of one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan names `apps/omni-app/src/functions.test.ts` but not this second list of the served functions
