---
id: s6-03-database-rules-govern-every-migration
prd: 1726
slice: s6
rank: medium
bears-on: none
raised: 2026-10-13
wave: 4
---

## The question, in plain words

Rules proven against the database read every migration, since a later migration may redefine a function. Should each such rule govern the whole migrations folder, rather than the few migration files it names today?

## The decision, in plain words

Yes: each rule proven against the database governs its own test and the whole migrations folder, so any new migration shows an agent every database rule. Rules proven by code alone govern only that code and its test.

## The intro, for fun

Twenty-one database rules were asked which migrations they care about.

## The punchline, for fun

All of them, they said, including the ones not written yet.

## The options, in plain words

A. Govern the whole migrations folder.
B. Govern only the migration files each test names, and accept that a later redefinition is missed.

## What I had to decide

How wide the governed paths of the rules proven against the database are: BR-PRODUCT-12, 27 to 29, 35, 39 to 41, 46, 47, 59, 62 to 65, 67, 70, 74, 78, 81 and N-PRODUCT-10. Their tests read the newest definition of a function from any migration, so a narrower list would miss a later redefinition.

## What I did meanwhile

Each of them governs its own test file and every migration. An agent writing a migration therefore sees these twenty-one database rules, and no more.

## What it costs to change later

Narrowing one later is editing one line of its entry.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Which migration first defines each function was not traced file by file; the width follows how the tests read the folder.
