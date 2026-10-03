---
id: s1-03-boundary-reads-only-by-get
prd: 1030
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

The production check must read real rows without ever changing one, even with the most powerful database key. How is that guaranteed?

## The decision, in plain words

The check's database client refuses every request that is not a plain read before it leaves, and the database runs plain reads in a read-only transaction, so a registered read that tried to write would fail instead. A read that calls a database function must ask for it as a plain read.

## The intro, for fun

Lending the master key to a script calls for a very short leash.

## The punchline, for fun

This one can look at every room and open no door.

## The options, in plain words

A. Refuse every request but a plain read in the check's client: the option built.
B. Trust each registered read to only read, and review them by eye.
C. Run the production check with a read-only database role made for it, which needs a migration this feature rules out.

## What I had to decide

How the registered reads are kept to reading against production, and what the wave-2 slices must write for it: a database function read through the check has to be called as a plain read.

## What I did meanwhile

The client sends only plain reads; anything else fails with a line naming the refused request. The shared read description lives with the arcade's parsing helper, and says whether a read answers rows or one row.

## What it costs to change later

A database function whose arguments cannot travel in a web address cannot be registered as it is called today.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) not yet tried against production, which runs once before the feature is marked ready
- the App's own reads would import this description from the arcade's folder, as no shared package holds it
