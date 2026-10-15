---
id: s4-01-product-roadmap-read-command
prd: 2011
slice: s4
rank: medium
bears-on: none
raised: 2026-10-15
wave: 3
---

## The question, in plain words

The drive skills now tell the agent to read a product roadmap's rows from the server, but the command that reads one does not exist yet. Who adds it, and in which slice?

## The decision, in plain words

The drive and mega-drive skills name a read of a product roadmap's file from the server, the same way a product PRD's plan is read. The command that does it is not built, because the commands are outside this slice, so the skills describe it ahead of the code.

## The intro, for fun

The skill learned to ask for the roadmap before anyone taught the shop to hand it over.

## The punchline, for fun

A recipe is ready, the pantry is still being stocked.

## The options, in plain words

A. A. Name the read in the skills now and add the command later (as built)
B. B. Add the read to the command in a follow-up slice of this landing
C. C. Have drive read the roadmap through its own new command instead

## What I had to decide

Add a roadmap read to omni dossier get (and the app route behind it) in a slice that owns the kit commands, or change the skills to name another read.

## What I did meanwhile

The skills are written and tested as text. A drive of a product roadmap cannot run end to end until the read exists; a roadmap born in git is unchanged.

## What it costs to change later

Small: one more kind accepted by the existing get command and one route that returns the latest roadmap file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Which slice or landing owns the read command (author)
