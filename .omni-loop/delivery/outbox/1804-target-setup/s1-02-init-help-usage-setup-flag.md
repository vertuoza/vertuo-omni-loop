---
id: s1-02-init-help-usage-setup-flag
prd: 1804
slice: s1
rank: medium
bears-on: none
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The help page for the install command does not yet mention its new option for the preparation step. Who adds it?

## The decision, in plain words

That help text belongs to the other slice of this feature, so this slice left it as it was; the option works and the command's own usage line names it.

## The intro, for fun

A new switch arrived on the install command this morning.

## The punchline, for fun

Its help page has not heard the news yet.

## The options, in plain words

A. A. Leave the help entry to the feature branch after the wave merges (built: nothing changed here).
B. B. Add it in s2, whose territory holds the help entries.

## What I had to decide

Whether the --setup flag is added to omni help init's usage in kit/lib/help/entries.ts, by s2 or on the feature branch after the wave.

## What I did meanwhile

omni init accepts --setup and its usage error names it; omni help init still shows the usage without it.

## What it costs to change later

One line in kit/lib/help/entries.ts, plus its help test if one pins the usage.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives the help entries to s2 for the skills only; init's usage line there was not assigned to either slice (author).
