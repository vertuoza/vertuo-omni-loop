---
id: s19-01-retro-own-values-proven
prd: 976
slice: s19
rank: medium
bears-on: none
raised: 2026-10-02
wave: 4
---

## The question, in plain words

When the retro reads back a value it wrote itself earlier in the same run, does a check that the value is there still have to stay, or may it go?

## The decision, in plain words

Checks on values the retro wrote itself in the same run were removed as proven. Checks on what it reads back from an older retro file, from GitHub or from the model were kept, by saying in the code that those values may be missing.

## The intro, for fun

The retro kept checking that its own notes were still on the desk where it had just put them.

## The punchline, for fun

Now it only double-checks the notes that someone else handed it.

## The options, in plain words

A. Values the retro wrote itself in the same run are proven: their checks go; values read from outside keep theirs behind a widened type.
B. Keep every check, even on the retro's own values, by widening each type it reads to say the value may be missing.
C. Parse each saved step result with a schema where it is read back, and drop the checks only behind the parse.

## What I had to decide

Whether a value the retro produced earlier in the same run, then handed through a saved step, counts as proven, so the check on it may go.

## What I did meanwhile

The checks on the retro's own fact sheet, prose, gathered records and parsed config are gone; those on retro.json read back, on GitHub's answers and on the kinds given no pull requests stay, behind a widened type.

## What it costs to change later

Option B costs one small change per check put back: a widened type and the check as it was, in about thirty places across the retro's source. No stored shape moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- A step's saved result comes back from Inngest as JSON; if a deploy changed what a step returns between the merge run and the day-14 run, a removed check on that value would no longer catch it. (author)
