---
id: s2-01-unreadable-outbox-means-unknown
prd: 426
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

While a PRD is being built, the page picks between Answer the outbox and Review and merge by looking at the open decisions. What should the header say when those decisions could not be read from GitHub?

## The decision, in plain words

The header says the stage is unknown, as it already does when any other part it needs could not be read, rather than offering Review and merge while a question might still be open.

## The intro, for fun

The page peeked into the outbox and found the lights off.

## The punchline, for fun

So it says it does not know, instead of waving everyone through.

## The options, in plain words

A. A. Unknown: the header names no stage until the outbox can be read again, within a minute.
B. B. Show the outbox stage with no button and the being-built caption, never Review and merge.
C. C. Ignore the failure and show the button as if nothing were open.

## What I had to decide

Whether an outbox read that failed should make the outbox stage unknown, or fall back to the button the page would show with nothing open.

## What I did meanwhile

Made the stage unknown when the outbox could not be read, consistent with the rule the stage already follows for the issue and pull requests. The Outbox tab says GitHub did not answer.

## What it costs to change later

One line in the stage function and one test; no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How often a single outbox read fails while the pull requests read fine, in practice (author).
