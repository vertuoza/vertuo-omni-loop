---
id: s4-01-worth-a-law-missing-reads-as-today
prd: 1342
slice: s4
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

When the harvest reads an answer about a rule that does not say whether the rule is worth a test, what should happen to that rule?

## The decision, in plain words

It is written as it was before this change: kept as a rule with no test named. Fresh answers always say it; only answers saved before this change, or from the hosted harvest until its own update, can lack it.

## The intro, for fun

A rule shows up at the door without its ticket, the one that says whether it deserves a test.

## The punchline, for fun

We let it in the old way: it got in before tickets were printed.

## The options, in plain words

A. Read an answer without the field the old way: written with no test named, no law issue (built).
B. Refuse an answer without the field, so the model is asked again and the rule is not placed if it still leaves it out.
C. Treat a missing field as worth a law, so a law issue is opened for it.

## What I had to decide

Whether an answer without the new 'worth a law?' field is refused, or read the old way.

## What I did meanwhile

The field is optional in the answer's shape and asked for in the question to the model on every rule and invariant; an answer without it is written unenforced, exactly as before, and no law issue is opened for it.

## What it costs to change later

A constant: one optional flag in the answer's shape and one branch in the writer, plus their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says the contract 'has worthALaw on every rule and invariant reply' without saying whether a reply missing it is refused.
- (author) The hosted harvest (a later slice) and its saved steps still send answers without the field until that slice lands; refusing them would break its tests and saved runs now.
