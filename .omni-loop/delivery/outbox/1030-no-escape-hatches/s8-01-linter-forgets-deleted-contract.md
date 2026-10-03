---
id: s8-01-linter-forgets-deleted-contract
prd: 1030
slice: s8
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

The linter's settings still named the hand-written description of the galaxy map package after this work deleted it. Who removes that line, when the settings belong to no slice?

## The decision, in plain words

This slice removed the one line itself, since the file it pointed at no longer exists, and the linter reads every remaining file exactly as before.

## The intro, for fun

The linter kept a seat warm for a file that had already left.

## The punchline, for fun

The seat is gone now, and nobody noticed the chair.

## The options, in plain words

A. Remove the stale entry in this slice: the option built.
B. Leave the entry pointing at a missing file, and let the slice that removes the mechanism clean it.
C. Keep the entry and the comment, as a record of what the package used to publish.

## What I had to decide

Whether the slice that deletes packages/galaxy/src/index.d.ts may also drop its allowDefaultProject entry in eslint.config.ts, a file outside the slice's territory (packages/).

## What I did meanwhile

eslint.config.ts's projectService is now `true`: the allowDefaultProject entry for the deleted file and its defaultProject, which only served that entry, are gone, with the two comment lines that explained them. pnpm lint over packages/ and the config reads 0 findings.

## What it costs to change later

Two lines in a shared settings file; putting them back is a copy of the previous version.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan's territory for this slice lists packages/ only, though deleting the declaration file leaves the linter's settings naming it
