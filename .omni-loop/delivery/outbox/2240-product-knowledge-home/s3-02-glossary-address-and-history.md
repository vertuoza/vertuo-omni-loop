---
id: s3-02-glossary-address-and-history
prd: 2240
slice: s3
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

A term's page is addressed by its stable id rather than its words, and its history lists only when it was added and last changed, because the database keeps no event feed for Legal and Glossary: is that enough?

## The decision, in plain words

A glossary entry opens at an address made from its id, so renaming a term never breaks a link. An entry's history shows who added it and when, and when it last changed; there is no list of past edits because none is stored.

## The intro, for fun

A term can change its words, but its address keeps the name it was born with.

## The punchline, for fun

Its history is short: born, maybe edited, and that is all the diary holds.

## The options, in plain words

A. A. Entry id in the address, history limited to added and last changed dates (built).
B. B. The term's words in the address, which breaks a link when a term is renamed.
C. C. Add stored edit events for Legal and Glossary in a later migration and list them.

## What I had to decide

Use the entry id in the address and show the created and updated dates as the history. A fuller history needs the database to store edit events, which is a migration outside this slice.

## What I did meanwhile

Both pages read and sort correctly, and the history section shows the dates the database already returns.

## What it costs to change later

Switching the address to the term's words is one function; adding event history needs a migration and a read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a history is shown where one is kept, and the read holds none for Legal or Glossary.
