---
id: s2-01-two-shared-files-touched-outside-the-slice
prd: 627
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Building the fix pages meant changing two places the plan did not give this piece of work: the shared description of a stored version, and two checks that pin the menu.

## The decision, in plain words

A stored version may now be any of the five kinds, and the two menu checks now expect Bug Fixes and Visual Updates after PRDs. Nothing else in those places changed.

## The intro, for fun

The plan drew a fence; the menu grew two entries right on the line.

## The punchline, for fun

Two gates opened, the rest of the fence still stands.

## The options, in plain words

A. A. Keep both changes here: the version kind widened, the two menu checks updated (built).
B. B. Keep the shared description as it was and give the fix pages a type of their own.
C. C. Also make the dossier's kind required everywhere, updating every test row that builds one.

## What I had to decide

Whether the change to the shared description of a stored version and to the two menu checks may stay in this piece of work.

## What I did meanwhile

Widened the kind of a stored version to the five kinds the database already accepts, and added the two new menu entries to the two checks that list the menu. A dossier read without a kind is still read as a PRD, so older rows and test data keep working.

## What it costs to change later

A constant: reverting is two lines in the shared description and two in the checks, and the fix pages would then need their own version type.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says the sidebar's tests are only touched by this slice, but names only the two in the menu folder; two more checks elsewhere pin the same menu.
- (author) The earlier slice left the dossier's own kind optional; it stays optional, because making it required would change test data in folders no slice of this plan owns.
