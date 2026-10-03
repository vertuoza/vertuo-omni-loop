---
id: s1-02-fallow-knows-boundary-files
prd: 1030
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

The dead-code audit cannot see files the database check loads by name, so it would call every one of them unused. Who teaches it about them?

## The decision, in plain words

This slice changed the audit's settings, a file outside its own list, so the audit counts every boundary file and the check's fixtures as loaded, and accepts that they all export the same name.

## The intro, for fun

The dead-code audit only believes in files someone imports.

## The punchline, for fun

The boundary files now have a signed note from the script.

## The options, in plain words

A. Change the audit's settings in this slice so every later boundary file passes: the option built.
B. Leave the settings alone and let each wave-2 slice record the audit's findings as items of its own.
C. Name every boundary file in a single registry that imports them all, which the plan set out to avoid.

## What I had to decide

Whether the first slice may change the dead-code audit's settings, which no slice of the plan lists, so the wave-2 slices can add boundary files without each failing the audit.

## What I did meanwhile

Three entries were added to the audit's settings: the verify script as an entry, every boundary file and fixture as loaded at run time, and their shared export name accepted. Removing them is three lines.

## What it costs to change later

Three lines in a shared settings file outside the slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the plan's territory for this slice did not list the audit's settings, though its boundary convention needs them
