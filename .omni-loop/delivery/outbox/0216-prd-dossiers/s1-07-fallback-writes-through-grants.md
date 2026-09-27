---
id: s1-07-fallback-writes-through-grants
prd: 216
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The fallback slice may not add a database migration, yet it must create dossiers and add versions as the service account. What should this slice give it?

## The decision, in plain words

The service account may read both tables, create a dossier by its key and rename it, and add versions only through the version rule the kit's push uses. It may not delete anything or write a version directly.

## The intro, for fun

The night shift needed a key, and the building only had master keys.

## The punchline, for fun

We cut one that opens the front door and the mail slot.

## The options, in plain words

A. Table rights to read, create and rename, and the version rule for versions
B. One function for the fallback that finds or creates the dossier and adds its versions in one call
C. Nothing now: the fallback slice adds what it needs, outside its listed files

## What I had to decide

Give the fallback a few table rights plus the version rule, or one function that does its whole job.

## What I did meanwhile

The fallback slice can create dossiers with its table rights and call the version rule for each changed file.

## What it costs to change later

Moving to a single function later is one migration and a change in the fallback's script.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The fallback's exact reads are not designed yet; it may need a right this slice did not grant (author).
