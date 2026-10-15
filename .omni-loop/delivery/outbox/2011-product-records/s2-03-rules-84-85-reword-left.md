---
id: s2-03-rules-84-85-reword-left
prd: 2011
slice: s2
rank: high
bears-on: BR-PRODUCT-84
raised: 2026-10-15
wave: 2
---

## The question, in plain words

Two rules about roadmaps now have an exception: a row may name a product's PRD, and a repositories column may sit in a product roadmap. Who rewords them?

## The decision, in plain words

The code now lets a roadmap born on the server name a product's PRD in a row and requires a repositories column naming the product's own repositories. The wording of the two rules in the product rules register was not changed here, since the register is outside this slice.

## The intro, for fun

The code learned the new exception before the rulebook did.

## The punchline, for fun

Same rules, two footnotes still to write.

## The options, in plain words

A. A. Leave the register as it is for now and reword both rules in a change of their own (as built)
B. B. Reword both rules now, adding the register to a later slice's territory
C. C. Leave the rules as they are: they stay true of a roadmap born in git

## What I had to decide

Whether to reword the rule that a row's PRD is in the inbox or shipped folder, and the rule that a repositories column belongs to a plan repository, to name the product roadmap, and who does it.

## What I did meanwhile

Both rules still hold for a roadmap born in git, whose tests pass unchanged. The new behaviour is proved by the product roadmap tests of the kit and of the app.

## What it costs to change later

Two sentences in the rules register, in a change of their own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says each rule is reworded in the slice that changes its behaviour, but the register is outside this slice's territory.
