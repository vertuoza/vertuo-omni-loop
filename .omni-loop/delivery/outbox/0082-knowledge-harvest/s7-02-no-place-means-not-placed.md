---
id: s7-02-no-place-means-not-placed
prd: 82
slice: s7
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

In a repository with no knowledge folder and no folder for decision records, what should the harvest say about each decision, since there is nowhere to write it?

## The decision, in plain words

It asks no model and lists every decision as not placed, saying the repository has no place for knowledge. It never marks one as staying where it is on its own.

## The intro, for fun

A librarian with no shelves still has to say something about every book.

## The punchline, for fun

Ours says: no shelf yet, so this book waits on the cart.

## The options, in plain words

A. List every decision as not placed, asking no model.
B. Write a fixed 'Stays here' line on every entry, asking no model.
C. Ask the model anyway, allowing only stays-here and covered.

## What I had to decide

The spec says that with neither folder every candidate is stays-here or covered and no call is made, but a stays-here line needs a reason and a covered line needs an entry to point at, and without a model call nothing supplies either.

## What I did meanwhile

classifyCandidate returns no reply, with the reason 'this repository has no knowledge folder and no decision-record folder', when the repository allows only covered and stays-here; finishHarvest lists the candidate as not placed and writes no ledger line.

## What it costs to change later

One branch in classifyCandidate: writing a fixed 'Stays here:' line instead is a constant and a test, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Which reason text a 'Stays here:' line would carry when no model was asked; the spec gives none.
