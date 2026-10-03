---
id: s4-01-people-directory-narrow-port
prd: 1030
slice: s4
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

Three pages load the workspace's people directory with a database connection that only has the two abilities the directory uses. Who changes the directory so it accepts that connection without being told to trust it?

## The decision, in plain words

The people directory now says it needs only those two abilities, so the three pages hand it their connection as it is. The directory's folder belongs to no slice of this plan, so this slice changed it.

## The intro, for fun

The people directory asked for the whole toolbox and only ever used two tools.

## The punchline, for fun

Now it asks for the two tools, and everyone stops pretending.

## The options, in plain words

A. A. Narrow the loader's parameter in this slice: the option built.
B. B. Keep the loader as it is and make the three callers take a full client, widening their own ports instead.
C. C. Leave the three casts in place for a later slice that owns the people directory.

## What I had to decide

Whether this slice may change the people directory's loader, which sits in a folder no slice of the plan lists, so that the dossier page, the ask pages and the waiting list stop casting their client to call it.

## What I did meanwhile

The loader's parameter became the narrow port it already used (the database client's table read and function call). Nothing it does changed, and every caller that passed a full client still passes one.

## What it costs to change later

One line in the people directory's loader; widening it back is the same line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan's territory for this slice did not list the people directory, though three of its casts could only go by changing it
