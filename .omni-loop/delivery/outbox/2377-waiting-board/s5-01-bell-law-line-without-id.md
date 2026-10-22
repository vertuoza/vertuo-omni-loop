---
id: s5-01-bell-law-line-without-id
prd: 2377
slice: s5
rank: medium
bears-on: none
raised: 2026-10-22
wave: 4
---

## The question, in plain words

The bell's Reviews line for a held law reads just Law, not Law with the law's name, because the waits table does not store which law holds the pull request. Should the sync also record the law's name so the line can say it?

## The decision, in plain words

The line says Law and opens the pull request, where the held law is named by its check. Adding the name later means one more column and a sync change, which is a later slice.

## The intro, for fun

A bell that rings for a law without saying which one.

## The punchline, for fun

The law is in the building; its name tag is in another table.

## The options, in plain words

A. A. Keep the line as built: Law, opening the pull request.
B. B. Record the law ids in a new waits column in a later slice, and say Law <id> in the line.

## What I had to decide

The spec asks for Law <id>, but the waits table (s1, the spec's section 2) holds no law id, and this slice's territory is the bell and the route, not the sync or the migration. Built: the line reads Law. A different answer costs one constant in the bell's line and a column in the waits table.

## What I did meanwhile

The line reads Law and links to the pull request, where the law-locked check names the law.

## What it costs to change later

A person who holds several laws cannot tell which one from the bell alone.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the escalation record's law ids should be stored on the wait (author)
