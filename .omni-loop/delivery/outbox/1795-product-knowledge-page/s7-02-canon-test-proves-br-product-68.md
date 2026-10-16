---
id: s7-02-canon-test-proves-br-product-68
prd: 1795
slice: s7
rank: high
bears-on: BR-PRODUCT-68
raised: 2026-10-16
wave: 2
---

## The question, in plain words

The spec check now also judges a spec against the product's legal entries, under the rule "it turns red only when it quotes the spec and names the Never line or Statement broken". Should that rule's words also name legal entries?

## The decision, in plain words

A legal entry is held to the same rule: red only with a word-for-word quote and a live entry, never a retired one. The rule's words were left as they are.

## The intro, for fun

The guard learned a new rulebook to read from.

## The punchline, for fun

It still won't shout without a quote.

## The options, in plain words

A. Keep the rule's words, and hold legal entries to it in the code and its tests (what was built)
B. Reword the rule to name legal entries beside Never lines and Statements, in a follow-up change
C. Give legal entries a rule of their own

## What I had to decide

Whether judging a spec against Legal entries in the canon gate, proven in BR-PRODUCT-68's own test file (`apps/omni-app/src/canon/canon.test.ts`), needs that law's text to change.

## What I did meanwhile

Five new tests: a red finding needs a word-for-word quote and a live `L-<CODE>-<n>`, a retired entry is never cited, and a changed entry changes the cache key. No existing test was changed or removed.

## What it costs to change later

Rewording the law is a knowledge-only change; the code already follows the stricter reading.

## What I could not know

(author) Whether the law's owner wants its words to name Legal entries.
