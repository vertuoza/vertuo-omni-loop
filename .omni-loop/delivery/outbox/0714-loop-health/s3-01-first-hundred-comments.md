---
id: s3-01-first-hundred-comments
prd: 714
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

When the board looks for the loop's status note on a pull request, how far down the conversation should it look?

## The decision, in plain words

It looks at the first hundred comments only. The loop writes its status note when it starts on a pull request, so it sits near the top.

## The intro, for fun

The board goes looking for one sticky note in a very long conversation.

## The punchline, for fun

It reads the first hundred and trusts the note was stuck on early.

## The options, in plain words

A. A. Read the first hundred comments and take the first status note (what was built).
B. B. Read the last hundred comments instead, which misses a note posted early on a very long conversation.
C. C. Page through every comment, which costs more of the shared GitHub budget on long conversations.

## What I had to decide

How many comments of a pull request the collector reads to find the loop's status comment, and from which end.

## What I did meanwhile

The collector reads the first 100 comments of each open signed pull request into a main branch and takes the first one carrying the status marker.

## What it costs to change later

One constant (COMMENTS_READ) and first/last in apps/omni-app/src/pr-stats/github.mjs; a changed pull request picks the new reading up at its next update.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How many comments a feature pull request collects before its status comment is posted was not measured.
