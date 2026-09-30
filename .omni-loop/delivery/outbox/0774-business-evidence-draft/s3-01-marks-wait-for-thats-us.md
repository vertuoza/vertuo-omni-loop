---
id: s3-01-marks-wait-for-thats-us
prd: 774
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

When a person taps Right or Wrong on one drafted row, should that row be saved at once, or wait for the That's us button?

## The decision, in plain words

It waits: Right and Wrong only mark the row on the page, and That's us saves every row at once, rejecting those marked Wrong and confirming the others. Leaving the page before That's us forgets the marks.

## The intro, for fun

Five rows, two buttons each, and one big button at the bottom.

## The punchline, for fun

Nothing is saved until the big button says so.

## The options, in plain words

A. Marks wait for That's us, and a reload forgets them
B. Each tap saves its row at once, and That's us confirms the rest
C. Marks wait, and are kept in the browser across a reload

## What I had to decide

Whether a tap on Right or Wrong on a drafted row should save that row straight away, or only mark it until That's us.

## What I did meanwhile

Right and Wrong mark the row on the page; the pill says nothing is saved yet; That's us saves them all in one call, and a reload forgets the marks.

## What it costs to change later

A few lines in the page to save each tap at once; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec gives each row Right and Wrong and says That's us confirms every row not marked Wrong, but not whether a single tap saves anything.
