---
id: s1-01-summary-line-outside-territory
prd: 1796
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The plan asked the knowledge check to count contracts in its summary, but the line that prints the summary sits in a file this slice was not given. Should the slice change it anyway?

## The decision, in plain words

We changed it: the summary now counts contracts. We also made one small typing change in the harvest's classifier so the new kind of entry cannot slip into its list of rules.

## The intro, for fun

The plan drew a fence, then asked for a gate on the other side of it.

## The punchline, for fun

We stepped over, fixed the gate, and wrote down the footprints.

## The options, in plain words

A. Change both files in s1, as built, and record it here.
B. Undo both and leave the summary line to a follow-up slice, so s1 stays strictly inside its territory; the typecheck then needs the classifier fix elsewhere.

## What I had to decide

Whether slice s1 may change the two files outside its territory that the new kind forces: the summary line of omni check knowledge (kit/bin/commands/check.ts) and the type of the classifier's rule list (kit/lib/knowledge/classify.ts).

## What I did meanwhile

Both are changed: the summary reads '<p> principle(s), <r> rule(s), <i> invariant(s), <c> contract(s) across …', and the classifier's list of rules and invariants is typed so a contract can never enter it. Neither file is in any sibling slice's territory, so the wave has no collision.

## What it costs to change later

Two lines each; reverting either is a one-line edit with no stored shape involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan meant to list kit/bin/commands/check.ts in s1's territory and left it out by mistake (author)
