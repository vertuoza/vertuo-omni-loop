---
id: s1-03-legal-proof-reads-variants
prd: 3375
slice: s1
rank: high
bears-on: BR-PRODUCT-113
raised: 2026-11-27
wave: 1
---

## The question, in plain words

The check that proves a rule about Legal entries now also checks the Legal entries a product's law variants name. Does the rule's owner agree its proof still holds?

## The decision, in plain words

The check reads the Legal entries the variants name together with those the rules serve, in one read of the product, and treats both the same way; what it did for the rules is unchanged.

## The intro, for fun

One read of the product page now answers two questions instead of one.

## The punchline, for fun

The first question still gets the very same answer.

## The options, in plain words

A. Keep the variants' Legal check in the same read as the rules', as built and as the spec asks.
B. Move it to a file of its own, leaving the rule's proof file exactly as it was.

## What I had to decide

Whether the online Legal read of `omni check knowledge`, the file named in BR-PRODUCT-113's `Enforced by:` line, may also verify the `legal` ids of `product/law-variants.json`, as the spec asks, or whether that check moves to a file of its own and leaves the proof file as it was.

Decided by: Jev (hardToRevert 0.48) · agent said false

## What I did meanwhile

`kit/lib/knowledge/check-knowledge-legal.ts` verifies a variant's Legal id as it verifies a served one (`<file>: variants[i].legal[j] — names L-…, which product … does not hold.`), notes it with the served ones when the page cannot answer, and adds the 512 KiB warning to its notes. A served id's messages and notes are unchanged: `kit/bin/knowledge.test.ts` and `kit/bin/kb-business-laws.test.ts` pass untouched.

## What it costs to change later

Moving the variants' read out is one new file beside the check and a few lines in `kit/bin/commands/check.ts` to call it; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) BR-PRODUCT-113 is about the source line of a Legal entry; the file its Enforced by line names only reads the product's active Legal entries, so the coverage guard flags this change by file, not because the rule's behaviour moved.
