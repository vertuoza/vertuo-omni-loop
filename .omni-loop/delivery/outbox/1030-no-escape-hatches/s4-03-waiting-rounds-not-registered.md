---
id: s4-03-waiting-rounds-not-registered
prd: 1030
slice: s4
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The database check reads with the most powerful key, but that key may not read the asked questions at all: only the person signed in can. How is the waiting list's read of those questions checked against the database?

## The decision, in plain words

That one read keeps its check and its tests, but is not registered with the database check, because the check would always fail on it. The three other reads of this slice are registered and passed against a local database.

## The intro, for fun

Even the master key has a door it was never cut for.

## The punchline, for fun

So that room gets inspected from the hallway, with tests.

## The options, in plain words

A. A. Leave the read unregistered, its schema tested on fixtures: the option built.
B. B. Teach the database check to read some boundaries as a signed-in member of the seed.
C. C. Grant the service role a read of the questions table in a later feature.

## What I had to decide

Whether to register the waiting list's read of the asked questions with the database check, which reads with the service role, when that role has no grant on the questions table.

## What I did meanwhile

The read is parsed with its schema, tested on fixtures, and left out of the check's list with a line in its test saying why. The dossiers, the new documents and the voice cast are registered and parsed one real row each on a local stack.

## What it costs to change later

Registering it later needs the check to read as a signed-in person, or a read grant for the service role, which is a database change this feature rules out.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the local seed has no dossier, version or persona: the three registered reads will show as empty in CI until the seed holds one; they were proven here on rows inserted into a throwaway stack
