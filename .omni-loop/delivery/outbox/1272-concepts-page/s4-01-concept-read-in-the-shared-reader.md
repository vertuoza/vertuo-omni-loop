---
id: s4-01-concept-read-in-the-shared-reader
prd: 1272
slice: s4
rank: medium
bears-on: none
raised: 2026-10-08
wave: 4
---

## The question, in plain words

To know whether a concept is in review or in the inbox, the app must ask GitHub about it. Which part of the app does the asking?

## The decision, in plain words

The same part that already asks GitHub about each fix now asks about concepts too, with its own short memory, so no second connection to GitHub is built.

## The intro, for fun

The concept needed a messenger to GitHub, and one was already walking that road every day.

## The punchline, for fun

So it got one more letter to carry, not a second messenger.

## The options, in plain words

A. A. Ask GitHub about a concept through the part that already asks about fixes, as built.
B. B. Give concepts their own way of asking GitHub, repeating how the app signs in to GitHub.
C. C. Ask GitHub nothing about concepts, and show their state only from what the push sends.

## What I had to decide

Whether the concept's GitHub read goes in the shared GitHub reader (outside this slice's ground), or in a reader of its own inside it.

Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

apps/galaxy/src/dossier/github/reader.ts gains a ConceptReader: concept(ref, { priority }) reads the repository's branches.concept from its config and calls readConceptFacts (fix.ts), through its own 60-second cache; the fix and concept reads share one helper (numbered). apps/galaxy/src/dossier/github/server.ts widens dossierGithub()'s type to include it, and reader.test.ts covers the concept read. These three files are outside s4's territory: the token, the installation and the repository's config live only in reader.ts, so no read of a concept could be made from inside the territory without copying them.

## What it costs to change later

Moving the read later is one method and its test moved to another file; nothing is stored differently and no migration is involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names apps/galaxy/src/dossier/github/fix as the territory for the read, but the reader that holds the GitHub token and the config, reader.ts, is not in it.
