---
id: s2-02-snapshot-outside-territory
prd: 902
slice: s2
rank: medium
bears-on: none
raised: 2026-10-05
wave: 2
---

## The question, in plain words

The new stored copy of GitHub needed two files the slice was not listed to change: the description of the database tables the code reads, and the automatic check list that proves who may read the new table. Was it right to change them here?

## The decision, in plain words

I added the new table to the description of the database and its access check to the automatic check list, as the repository's own rules ask for every new table and check. The sync, which a later slice owns, was left untouched and still asks GitHub itself for its recount until then.

## The intro, for fun

The new table showed up without a name tag or a bouncer.

## The punchline, for fun

So it got both, even though they hang on a door down the hall.

## The options, in plain words

A. A. Change both here, with the table, as the conventions ask (built)
B. B. Leave them for a follow-up slice that owns them, with the table unchecked until then

## What I had to decide

Whether a slice may change the shared table description and the check list when it adds a table, or the plan should name them in its territory.

## What I did meanwhile

The check runs on every pull request and the table description matches the change; the sync's recount reads GitHub directly until the later slice rewires it.

## What it costs to change later

A constant: two additions that any later slice could have made instead; nothing to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan left these two files out on purpose is not known (author).
