---
id: s8-01-docs-guard-knows-wait
prd: 1322
slice: s8
rank: medium
bears-on: none
raised: 2026-10-09
wave: 2
---

## The question, in plain words

The documentation check refused the guide because the new waiting command lives in a file named differently from the command. Should the check learn that, or should the command's file be renamed?

## The decision, in plain words

The documentation check now also accepts a command the command list registers under that name, so the guide can name the waiting command as it is typed.

## The intro, for fun

The guide named a command, and the checker swore it had never met it.

## The punchline, for fun

They have now been introduced.

## The options, in plain words

A. The guard also accepts a command the commands' index imports by that name (built).
B. Rename the waiting command's file after the command, and leave the documentation check as it was.

## What I had to decide

Whether the docs guard reads a command from the commands' index when its file has another name, or the wait command's file is renamed to match.

## What I did meanwhile

The guard accepts a command its index imports by that name; every other check is as before.

## What it costs to change later

Small either way: renaming the file later means one move and dropping the extra lookup.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None known: the guard's test covers both a command's own file and an import in the commands' index.
