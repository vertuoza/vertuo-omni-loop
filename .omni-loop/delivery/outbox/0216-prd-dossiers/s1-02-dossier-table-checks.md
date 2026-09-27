---
id: s1-02-dossier-table-checks
prd: 216
slice: s1
rank: high
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The spec sketches the two dossier tables. Should the database also keep the repository name in lower case, and refuse a few inconsistent rows the sketch does not mention?

## The decision, in plain words

Yes: the home repository is kept in lower case, so the kit and the fallback, which may spell a name differently, reach the same dossier. The tables also refuse a numbered dossier with no numbering date, a version read from GitHub with no commit, and a malformed hash.

## The intro, for fun

Two spellings of one repository walked into the database and asked for the same table.

## The punchline, for fun

They got one spelling and one table.

## The options, in plain words

A. Store the repository in lower case and refuse the inconsistent rows
B. Store the repository as sent, and match names ignoring case in every lookup
C. Store it as sent and match exactly, as the sketch reads

## What I had to decide

Keep repository names as sent and match them exactly, or store them in one case with a few extra rules on each row.

## What I did meanwhile

The migration stores names in lower case and checks each dossier and version as described. The fallback slice must lower-case its names too, or go through the functions that do.

## What it costs to change later

A follow-up migration relaxes a rule; names already stored stay in lower case, which GitHub treats as the same repository.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The original spelling of a repository name is not kept; nothing in the spec needs it (author).
