---
id: s1-04-push-rule-keeps-versions
prd: 2011
slice: s1
rank: high
bears-on: BR-PRODUCT-81
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The rule that any member may push a roadmap, replacing its document and rows, now also covers roadmaps born on the server, which keep every push as a version: who rewords the rule, and does its proof stay sound?

## The decision, in plain words

A roadmap born on the server is pushed by any member of its workspace, its document and rows replaced and the last pusher recorded, exactly as the rule says, and on top of that each push keeps a version of what changed. The rule's proof gained checks for this, and its old checks are untouched; the rule's words were not changed here.

## The intro, for fun

The rule said replace; the new roadmaps also remember.

## The punchline, for fun

Same rule, longer memory, and the words still to catch up.

## The options, in plain words

A. Keep the rule's words for now and add the versions line when the kit's push lands (as built)
B. Reword the rule now, in a change of its own
C. Leave the rule as it is: replacing the document stays true, and the versions need no rule

## What I had to decide

Whether to reword BR-PRODUCT-81 to say a roadmap born on the server also keeps every push as a version, as the spec asks of the slice that changes it, and who does it: the rules register is outside this slice's territory, so it was left as it is.

## What I did meanwhile

The roadmaps check that proves BR-PRODUCT-81 keeps every check it had and gains a section for product roadmaps: any member pushes one, the roadmap records who pushed last, its rows are replaced, and each push adds a version only of what changed. The rule's text in the product rules register still reads as before, and is still true of every roadmap.

## What it costs to change later

A constant: one line added to the rule's text in the register, in any later change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks that BR-PRODUCT-81 be reworded in the slice that changes its behaviour, but no slice's territory lists the rules register (author)
