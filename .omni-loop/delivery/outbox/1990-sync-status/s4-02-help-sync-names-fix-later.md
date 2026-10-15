---
id: s4-02-help-sync-names-fix-later
prd: 1990
slice: s4
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

The help page of the sync tool does not mention its new fix option yet, because another part of this work owns that page right now: who adds the line?

## The decision, in plain words

This part left the help page alone and the command's own usage line names the fix option; the sentence in the help page is left for the last, wording-only part of this work, or for the wave once its parts are merged.

## The intro, for fun

A new button arrived before its label did.

## The punchline, for fun

The label maker is busy next door until the next round.

## The options, in plain words

A. A. Leave it to s7 or to the wave: one usage line and one sentence after s5 merges.
B. B. Widen this slice's territory to the sync help entry now, against s5's ownership of the file in wave 2.

## What I had to decide

Who adds --fix to omni help sync: the wording slice (s7) or the wave after merging, since kit/lib/help/entries.ts is s5's alone in wave 2 and outside s4's territory.

## What I did meanwhile

kit/bin/commands/sync.ts USAGE reads 'usage: omni sync [--json | --quiet | --background | --fix] [--strict]'; the sync entry in kit/lib/help/entries.ts still lists '[--json | --quiet | --background] [--strict]' and its detail says nothing of --fix.

## What it costs to change later

One usage line and one sentence in the sync help entry.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s7's territory should gain kit/lib/help/entries.ts for this was not planned (author).
