---
id: s3-03-function-list-outside-territory
prd: 1612
slice: s3
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

Registering the new check changed how many background functions the App serves, and a test outside this slice's ground counts them. Was it fine to update that test?

## The decision, in plain words

Yes: the test that lists the App's functions, and the comment that names them, were updated to include the two new ones. Nothing else outside the slice's ground changed.

## The intro, for fun

Adding two helpers meant someone had to update the head count.

## The punchline, for fun

The roll call now has eight names instead of six.

## The options, in plain words

A. A. Update the function list test and the entry's comment.
B. B. Fold the rerun into the check as one function, and still update the test.

## What I had to decide

Confirm the two edits outside the territory.

## What I did meanwhile

apps/omni-app/src/outbox-check/inngest-route.test.ts lists approvedCheck and approvedRerun (function_count 12, 8 functions on a preview); apps/omni-app/entries/inngest.ts's header comment names them.

## What it costs to change later

Two lines in a test and two in a comment.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) No gap beyond the territory itself.
