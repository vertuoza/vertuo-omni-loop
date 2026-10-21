---
id: s3-01-s3-repo-reader-lists-folders
prd: 2313
slice: s3
rank: medium
bears-on: none
raised: 2026-10-21
wave: 2
---

## The question, in plain words

The runner skills list needs to read a folder of a repository on GitHub, and the shared GitHub reader only reads files. May the slice add a small folder read to that reader, outside its own territory?

## The decision, in plain words

The shared GitHub reader gained two small reads, the folders under a path and the repository's default branch name, so the block can list a repository's skills and say which branch an allowed skill left. Nothing existing changed.

## The intro, for fun

The skills were on the shelf, but the reader could only open files.

## The punchline, for fun

So the reader learned to open folders, one small door at a time.

## The options, in plain words

A. A. Add the two reads to the shared reader, as built.
B. B. Copy the GitHub call into the repositories folder, so no file outside the territory changes.

## What I had to decide

Whether the shared reader in apps/galaxy/src/business/draft/github.ts may carry these two reads, or the block should carry its own copy of the GitHub call. Decided by: Jev (hardToRevert 0.54) · agent said false

## What I did meanwhile

Built as a pair of added methods on the existing reader, which no other code calls.

## What it costs to change later

Undone by deleting the two methods and moving them into the repositories folder, a small change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan lists no file outside the repositories folder for this slice (author).
