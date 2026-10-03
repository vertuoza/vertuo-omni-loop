---
id: s5-03-id-names-holding-other-things
prd: 1049
slice: s5
rank: medium
bears-on: none
raised: 2026-10-03
wave: 4
---

## The question, in plain words

A few places in the tool use an identifier's name for something that is not that identifier: a slot named slice that holds a branch name pattern, and one named prd that holds the name of a label. Should they be renamed, or keep their names and be typed by what they really hold?

## The decision, in plain words

They keep their names and stay plain text, as the earlier pieces of this work did for the same case. The upcoming check that forbids plain identifiers will see them, so it needs to know they are not identifiers.

## The intro, for fun

A field called slice turned out to be a pattern for branch names, not a slice at all.

## The punchline, for fun

We let it keep its name tag and wrote down who it really is.

## The options, in plain words

A. Keep the names, typed by what they hold, and leave them for s6 to settle (built).
B. Rename them now, to names off the guarded list, so no guard ever sees them.
C. Brand them anyway, with a brand for branch templates and one for labels.

## What I had to decide

How to type the kit's fields whose name is on s6's list but whose value is no ID of that kind.

## What I did meanwhile

Left typed as string, by what they hold: the branch templates named slice in kit/lib/ask/context.ts (prdOfBranch's branches), kit/lib/ask/heartbeat.ts (Branches) and kit/lib/board.ts (BoardConfig.branches), following s3-02's precedent for Config['branches'].slice; and CreditLabels.prd in kit/lib/credits/classify.ts, the name of the PRD label. fixVerdict's issue parameter became number (an issue's or a concept's), since omni concept grades through it. Fields named number that hold a question's position, not an ID, stay number.

## What it costs to change later

Renaming any of them is a local rename with no data or output change; teaching s6's guard about templates is a rule in scripts/.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's guard polices names, not what they hold, and says nothing of a name on its list that holds a branch template or a label; s6 has to decide between renaming these and an exception.
