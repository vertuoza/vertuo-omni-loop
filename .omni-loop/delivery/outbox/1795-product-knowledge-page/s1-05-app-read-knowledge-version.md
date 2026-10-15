---
id: s1-05-app-read-knowledge-version
prd: 1795
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The phase-0 check must judge a spec again when a Legal entry changes. Where does it learn that something changed?

## The decision, in plain words

The business read the phase-0 check uses also answers the number of the product's newest knowledge change, so the check can key its stored verdict on it.

## The intro, for fun

A judge who never hears that the law changed keeps ruling by the old one.

## The punchline, for fun

Now the judge finds a note on the desk each morning.

## The options, in plain words

A. The phase-0 check's business read carries the newest knowledge change.
B. The phase-0 check asks for the newest knowledge change in a read of its own.

## What I had to decide

Answer A to keep the number in that read, or B to have the check ask for it separately.

## What I did meanwhile

The read the phase-0 check uses carries one more field beside the Legal entries and the glossary; the terminal's and agents' read does not.

## What it costs to change later

Moving it later is one function and the check's read; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How slice s7 will build its cache key; it is designed for this field but not yet built (author)
