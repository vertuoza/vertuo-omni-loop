---
id: s1-01-uncomparable-read-point-is-stale
prd: 522
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

When the point a copied knowledge base was read at no longer exists in the other repository, for example after its history was rewritten, what should the targets list say?

## The decision, in plain words

It says the copy is stale and explains that the read point cannot be compared, so a person refreshes the copy with the sync run.

## The intro, for fun

A bookmark in a book that has since been reprinted.

## The punchline, for fun

When the page is gone, we call the copy stale and read it again.

## The options, in plain words

A. Stale, with a detail saying the read point cannot be compared: The sync run is the fix, and stale is what sends a person there.
B. Drifted: Treats it as the config no longer matching the repository.
C. Unreachable: Treats any failed reading as the repository being unreadable.

## What I had to decide

Whether a copy whose read point GitHub cannot find is reported as stale, drifted or unreachable.

## What I did meanwhile

It reads stale, with the detail 'readAt <short commit> cannot be compared with the default branch', and the command exits 1.

## What it costs to change later

One constant in the targets reader and one test; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names stale only for a moved head that changed an evidence file; this case is not in it (author).
