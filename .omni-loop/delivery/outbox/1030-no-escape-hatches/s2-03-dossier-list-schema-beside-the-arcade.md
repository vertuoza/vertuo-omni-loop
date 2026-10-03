---
id: s2-03-dossier-list-schema-beside-the-arcade
prd: 1030
slice: s2
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The arcade now checks the workspace's dossier list when it reads it, but the shape of a dossier in that list belongs to the dossier pages, which another part of this feature reworks at the same time. Where does the check live?

## The decision, in plain words

The check lives with the arcade's own read and is held to the dossier pages' description of a dossier, so the compiler says when the two disagree. The dossier pages may grow a check of their own for the same list, and the two could then be merged into one.

## The intro, for fun

Two teams describing one dossier at the same time is how twins get different names.

## The punchline, for fun

This twin at least carries the other's birth certificate.

## The options, in plain words

A. A. A schema beside the arcade's read, held to the dossier layer's type: the option built.
B. B. Wait for the dossier layer's schema and import it, which ties this slice to another one of the same wave.
C. C. Write the schema in the dossier layer's folder, which belongs to another slice.

## What I had to decide

Whether the arcade's read of the dossier list gets its own schema, held to the dossier layer's type, while the dossier layer's slice may write one for its own read of the same function in parallel.

## What I did meanwhile

The schema sits beside the arcade's read and is declared as producing the dossier layer's own row type, so a change on either side that the other does not follow fails the type check.

## What it costs to change later

Possibly two schemas for one database function until someone merges them; merging is moving one constant and an import.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the dossier layer's slice was being built at the same time, so whether it wrote its own schema is not known here
