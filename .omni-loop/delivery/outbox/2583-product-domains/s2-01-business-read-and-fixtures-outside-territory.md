---
id: s2-01-business-read-and-fixtures-outside-territory
prd: 2583
slice: s2
rank: medium
bears-on: none
raised: 2026-11-02
wave: 2
---

## The question, in plain words

The page and the agents' business read both had to learn about domains, and the agents' read sits in files this slice does not own. Is it right that this slice made the small change there rather than leaving it for a later slice?

## The decision, in plain words

The agents' business read was made to accept the new domains fields, and three test fixtures were given an empty domains list so they still read as before. Without it, the read would have refused every answer once the database sends domains, for every terminal and agent.

## The intro, for fun

The glossary grew a new column and the back door had a strict bouncer.

## The punchline, for fun

A one-line note to the bouncer, and everyone gets in again.

## The options, in plain words

A. A. Keep the small changes made here, in the business read's schema and in one fixture line of the knowledge API test.
B. B. Have the owner of those files make them in a later slice, leaving the business read to refuse the database's answer until then.

## What I had to decide

Answer A to keep the two small changes made outside the slice's own files (the business read's schema and one fixture line in the knowledge API test); answer B to have them made by the slice that owns those files instead, accepting that the business read refuses the database's answer until then.

## What I did meanwhile

The business read accepts the optional domains fields, and the fixture lines are updated; every existing test still passes.

## What it costs to change later

Undoing it is removing one optional field from two schemas and one line from a fixture; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory for this slice names the product knowledge files and the migration, not apps/galaxy/src/business-api/ or apps/galaxy/src/knowledge-api/, yet the criterion that the business read carries the domains needs the first, and the typed glossary entry needs the second.
