---
id: s3-01-how-a-decision-shows-its-level
prd: 2416
slice: s3
rank: medium
bears-on: none
raised: 2026-10-23
wave: 2
---

## The question, in plain words

When the decision list also holds records from the plan repository or the workspace settings, how does each record show where it comes from, and what happens to the repository's own numbering?

## The decision, in plain words

A record is tagged with its level in the list only once another level contributes one, so a repository with no other level prints exactly what it printed before. The repository's own records keep the next free number and are never renumbered by a record from above.

## The intro, for fun

A family album is easier to read when every photo says whose shelf it came from.

## The punchline, for fun

The tag only appears once there is a second shelf.

## The options, in plain words

A. A. Tag only when another level contributes, the repository's own untagged and without a level key: the option built.
B. B. Always tag every record, including a repository alone, and add a level key to every record in the JSON.
C. C. List other levels' records in a separate section under the repository's list.

## What I had to decide

Built: readDecisions returns the repository's records first, then each higher level's records whose number nothing nearer holds. A record read from another level carries a level key; the repository's own carries none, so the JSON of a repository alone is unchanged. The list prints a bracketed level after each title only when some record comes from another level. The repository's own records are cut to the latest 20 and every inherited one is listed. The shared numbers and the next free number stay the repository's own.

## What I did meanwhile

Everything is derived live from the folders; nothing is stored. Other readers of the records (the knowledge graph, the classifier) now also see inherited records when a copy exists.

## What it costs to change later

A change of mind is a few lines in the decisions reader and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the knowledge graph and the classifier should see inherited records or the repository's own only (author)
- whether a record from above that shares a repository record's number should be listed as shadowed instead of hidden (author)
