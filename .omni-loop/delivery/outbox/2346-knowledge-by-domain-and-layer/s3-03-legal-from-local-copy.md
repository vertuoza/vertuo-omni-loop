---
id: s3-03-legal-from-local-copy
prd: 2346
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 3
---

## The question, in plain words

The lookup now lists the product's legal entries for every change. Should it read them from the copy the last session start saved, or ask the Omni page each time?

## The decision, in plain words

It reads the saved copy and never calls the page, as the knowledge graph already does. With no copy saved yet, it lists no legal entry and says nothing about it.

## The intro, for fun

The legal entries live on the page, but the lookup runs in the terminal.

## The punchline, for fun

So it reads the copy in its pocket instead of phoning home every time.

## The options, in plain words

A. Read the saved copy, with no network call, and say nothing when there is none (built).
B. Read the saved copy, and print one line when there is none, pointing at omni kb legal.
C. Ask the Omni page on each call, falling back to the copy when it cannot be reached.

## What I had to decide

Where omni kb laws --paths and --slice read the Legal entries from: the local copy every session start refreshes, or the Omni page on each call; and what it says when there is no copy.

Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

The lookup reads the Legal entries from the product knowledge copy under .omni-loop/local/, written by omni kb legal and the session start, and makes no network call. No copy, or one that does not read, lists no Legal entry and prints no line about it.

## What it costs to change later

A line in the command: read the page through the same call omni kb legal makes, or print one line when the copy is missing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says every Legal entry prints under Global, not where the lookup reads them; whether a missing copy deserves a line is not settled.
