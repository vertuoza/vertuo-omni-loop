---
id: s5-03-roadmap-closed-date-and-links
prd: 1665
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The Omni page does not say when a change was closed, nor give a link to each comment, but the roadmap page shows both: where should they come from?

## The decision, in plain words

A closed change counts as closed when it was last updated, a merged one when it merged, and a comment's link is built from the issue's address and the comment's number.

## The intro, for fun

The calendar lost the closing date, so it trusted the last time anyone touched the door.

## The punchline, for fun

Close enough, and usually exactly the same minute.

## The options, in plain words

A. A. Keep the dates and links as built.
B. B. Add a closing date and a comment link to the loop's contract, and read them.
C. C. Send no end date and no comment link when the page does not give them.

## What I had to decide

How kit/lib/roadmap/push.ts fills a feature PR's closedAt and a clarification comment's url when the loop contract's Change has no closedAt and its Comment no url.

## What I did meanwhile

featurePrOf takes closedAt from mergedAt for a merged change and from updatedAt for a closed one; issueComments links each comment as https://github.com/<repo>/issues/<n>#issuecomment-<id>, as the push already builds the roadmap issue's own address. Tested in kit/lib/roadmap/push.test.ts.

## What it costs to change later

Adding closedAt to the contract's Change, or url to its Comment, is a field on both sides and one line here each.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A closed change edited after it closed would show a later end date than it really had.
