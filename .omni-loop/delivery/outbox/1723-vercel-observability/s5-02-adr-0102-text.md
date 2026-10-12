---
id: s5-02-adr-0102-text
prd: 1723
slice: s5
rank: high
bears-on: ADR-0102
raised: 2026-10-12
wave: 1
---

## The question, in plain words

A new decision record now says that watching the arcade and the App stays on Vercel, with its paid log option kept on behind a spending cap, and that Sentry, sending logs elsewhere and a ready-made logging tool were refused. Does it say what you decided, in words you accept?

## The decision, in plain words

The record was written from the spec's decisions, including the reasons you gave for refusing Sentry and for keeping the paid option on, and it adds no rule the spec does not hold.

## The intro, for fun

Someone wrote down what you decided, so now you get to check they heard you right.

## The punchline, for fun

Records are forever; typos only feel that way.

## The options, in plain words

A. A. Accept the record as written: Vercel only, the paid log option on behind a spending cap, one line per run through the repository's own logger (as built).
B. B. Reword the record, keeping the decision, with the words the person gives.

## What I had to decide

Answer A to accept the record as written, or B with the words to change.

## What I did meanwhile

The record stands as written and the conventions page points to it.

## What it costs to change later

Rewording it is an edit of one document; no code reads it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The record's alternatives give the agent's short reasons for refusing log forwarding and a logging tool; the spec names them as out of scope without a reason of the person's own.
