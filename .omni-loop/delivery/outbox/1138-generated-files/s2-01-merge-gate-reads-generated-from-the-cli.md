---
id: s2-01-merge-gate-reads-generated-from-the-cli
prd: 1138
slice: s2
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

The merge check only knows which files are built if the command that runs it hands them over, and that command sat outside this slice's agreed files. Should the slice have changed it?

## The decision, in plain words

We changed that one command by a single line so it hands the repository's list of built files to the merge check; without it the merge check would never use the list.

## The intro, for fun

The gate learned a new rule, but nobody told the doorman.

## The punchline, for fun

So we slipped him a one-line note.

## The options, in plain words

A. A. Keep the one-line change to the merge command that hands it the list of built files (built).
B. B. Undo it and make that change in a later piece of work that owns the merge command.
C. C. Have the merge check find the list on its own, so the merge command changes nothing.

## What I had to decide

Whether the one-line change to the merge command, outside the slice's territory, stays as built.

## What I did meanwhile

The merge gate drops built files from its territory report when run here; a sub-PR in another repository is graded as before.

## What it costs to change later

Reverting is one line; the merge gate then reports rebuilt bundles as outside the territory again.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No test drives omni flow check merge with a generated section; the merge gate itself is tested with one. (author)
