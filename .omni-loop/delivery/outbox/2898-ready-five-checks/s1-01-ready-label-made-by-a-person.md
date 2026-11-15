---
id: s1-01-ready-label-made-by-a-person
prd: 2898
slice: s1
rank: medium
bears-on: none
raised: 2026-11-15
wave: 1
---

## The question, in plain words

The new label that starts the full checks on a draft has to exist before a skill can put it on a pull request. Should the install create it with the other loop labels, or a person once per repository?

## The decision, in plain words

A person creates it, as for the label a runner puts on a dead claim. The setting may rename it and the kit reads the usual name when it is left out, so turning the gate on is one label to make by hand.

## The intro, for fun

A label nobody created is a sticker with no glue.

## The punchline, for fun

For now, a person brings the glue.

## The options, in plain words

A. A person creates the label once; the kit reads its usual name: what was built.
B. Create it at install with the other loop labels, with the yes of the locked install law's owner.

## What I had to decide

`labels.readyCheck` is new. Created at install, it needs a style in `kit/lib/init/labels.ts` and new names in `kit/bin/init.test.ts` and `kit/bin/update.test.ts`: none of them is in s1's territory, and `kit/bin/init.test.ts` proves the locked N-PRODUCT-13, whose file stays its owner's. PRD 2175 met the same choice for `labels.released` and made the key optional. Optional, `omni config labels` does not print it when it is not set, which s1's done-when listed.

## What I did meanwhile

`labels.readyCheck` is optional; `readyCheckLabel()` reads `DEFAULT_READY_CHECK_LABEL` (`omni:ready-check`) when it is left out. `omni init` does not create it. s4, which adds the label, may create it when it is missing, or name it as a human step.

## What it costs to change later

Creating it at install is a style line, the label in two install test lists (one of them a locked law's proof, so its owner's yes) and the key defaulted.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether s4 should create the label itself when it is missing, rather than name it as a human step
