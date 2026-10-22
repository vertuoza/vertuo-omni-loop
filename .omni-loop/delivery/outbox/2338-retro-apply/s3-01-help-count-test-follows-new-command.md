---
id: s3-01-help-count-test-follows-new-command
prd: 2338
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

Adding the retro command made a test that counts the kit's commands fail, and that test sits outside this slice's list of files: is bumping its count by one the right way to keep it green?

## The decision, in plain words

The count in the help test went from 62 to 63 commands, nothing else in that file changed.

## The intro, for fun

A new command walked in and the headcount noticed.

## The punchline, for fun

The counter now says 63 and has no further comment.

## The options, in plain words

A. A. Bump the count in the help test, which is the smallest change that keeps it green.
B. B. Leave the help test alone and let the wave change it once, after merging all slices.

## What I had to decide

Keep the one-number change in kit/lib/help/entries.test.ts (A), or leave the test red and let another slice change it (B).

Decided by: Jev (hardToRevert 0.80) · agent said false

## What I did meanwhile

The count is bumped on this slice's branch, so its preflight is green.

## What it costs to change later

Reverting is changing three numbers back in one test file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice lists the help entries file but not its test, and the spec does not say who owns the count.
