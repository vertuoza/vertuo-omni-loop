---
id: s3-02-render-test-follows-the-new-link
prd: 384
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

The link to each question now says which PRD it was opened from, and one page test outside this slice's listed files still expected the old link. May this slice update that one expectation?

## The decision, in plain words

Yes: one line of that page test now expects the new link, since the plan's shared-files note lists it for this slice even though the slice table leaves it out.

## The intro, for fun

The sign on the door changed, and one inspector still had the old sign in the checklist.

## The punchline, for fun

The checklist got a one-word update.

## The options, in plain words

A. Update the one expected link: what was built; the test keeps checking the link, now in its new form.
B. Leave the test red for another slice to fix: no file outside the table touched, but the whole run stays red.

## What I had to decide

Whether a page test the slice table does not list for this slice, but its shared-files note does, may change to follow the new link.

## What I did meanwhile

That test now expects the link carrying the PRD it came from; nothing else in it changed.

## What it costs to change later

One line; undoing it is putting the old expected link back.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's slice table and its shared-files note disagree on whether this page test belongs to s3 (author).
