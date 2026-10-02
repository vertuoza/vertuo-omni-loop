---
id: s16-02-unparsed-answers
prd: 976
slice: s16
rank: medium
bears-on: none
raised: 2026-10-02
wave: 3
---

## The question, in plain words

The database's answers are trusted by their declared shape, so the linter calls the arcade's safety checks on them useless. Should those checks go, or stay?

## The decision, in plain words

The checks stay. Each answer is read through three small helpers that take it as it really comes, possibly empty or of any kind, so every check keeps doing its job and nothing the arcade shows changes.

## The intro, for fun

The linter swore the database always tells the truth, and the arcade kept its seatbelt on anyway.

## The punchline, for fun

Three tiny helpers now say out loud what the arcade always quietly assumed.

## The options, in plain words

A. Read each unparsed answer through small helpers that widen it, keeping every check.
B. Parse every answer with a schema per table, which is more code and new failure messages.
C. Delete the checks the declared shape says are useless, which the spec forbids.

## What I had to decide

How to clear the linter's 'this check can never fail' findings on answers read from the database without parsing them, when the rules forbid deleting a check on the type's word alone.

## What I did meanwhile

A new data helper module reads a list that may be missing, a number and a text from an unparsed answer; the reads in the data, home and stages folders go through it, and a few rows are widened where they are read.

## What it costs to change later

A constant: the helpers are three one-line functions; a schema per table could replace them later, call by call.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the database's answers should instead be parsed by a schema at each read is not settled by the spec, which allows either widening or parsing (author)
