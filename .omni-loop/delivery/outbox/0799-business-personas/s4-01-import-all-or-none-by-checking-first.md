---
id: s4-01-import-all-or-none-by-checking-first
prd: 799
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

The import must add all the personas of a file or none of them. How is that kept when the database adds them one at a time?

## The decision, in plain words

Every row is checked before anything is written, so a bad file writes nothing. If the connection fails halfway, running the import again adds only the missing personas, because a persona whose name is already on its product is left alone.

## The intro, for fun

All or nothing sounds simple until the database takes one persona at a time.

## The punchline, for fun

So the import checks everything first, and a second run just finishes the job.

## The options, in plain words

A. A. Check every row first, add one by one, skip a name already on the product so a rerun completes.
B. B. Add a database function that adds the whole file in one transaction.
C. C. Check first and add one by one, but add every row again on a rerun, even a same name.

## What I had to decide

Whether all-or-none needs one database transaction for the whole file, or whether checking every row first plus a safe rerun is enough.

## What I did meanwhile

The import checks every row as the database does, then adds them one by one; a persona already on its product under the same name is skipped, so a rerun never adds it twice.

## What it costs to change later

A constant change in the import script; a true single transaction would need a new database function, a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says all or none but the database offers one add per persona; a one-call bulk add was outside this slice's territory. (author)
- Whether two personas may share a name on one product is not settled; the import treats a same name as the same persona. (author)
