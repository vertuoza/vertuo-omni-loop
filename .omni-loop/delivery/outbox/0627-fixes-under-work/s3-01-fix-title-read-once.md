---
id: s3-01-fix-title-read-once
prd: 627
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When the Omni page makes a page for a fix it found in a repository, what name does it give it, and does the name follow later changes to the request?

## The decision, in plain words

The page is named after the request's title, without its Visual or Bug prefix, read once when the page is made; if the request cannot be read, it is named after the fix's folder. A later rename of the request is not followed.

## The intro, for fun

Three fixes walk in with a folder name and a request title.

## The punchline, for fun

The title wins the first handshake, and keeps it.

## The options, in plain words

A. Read the title once, when the page is made (built).
B. Read it on every run and rename the page when it changed.
C. Name every page after its folder, and let only the kit's push give the request's title.

## What I had to decide

Whether the background sync reads a fix's request title on every run to follow renames, or once when it opens the fix's page.

## What I did meanwhile

The sync reads the title only when it opens a fix's page, so a run with nothing new asks GitHub nothing more; a failed read falls back to the folder name and is logged.

## What it costs to change later

A constant: reading the title on every run and renaming when it differs is a few lines in the sync, no stored change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the title (the request's, without its prefix) but not whether the background sync must follow a later rename.
- (author) A page the kit pushed first keeps the kit's title; the sync never renames a fix's page.
