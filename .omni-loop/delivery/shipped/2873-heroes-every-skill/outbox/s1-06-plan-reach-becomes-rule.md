---
id: s1-06-plan-reach-becomes-rule
prd: 2873
slice: s1
rank: high
bears-on: BR-ACCESS-8
raised: 2026-11-15
wave: 3
---

## The question, in plain words

Should your answer to question 1 become a written rule of the product: a build sent from a product's plan repository reaches that product's repositories, even when the product does not list the plan repository among its own?

## The decision, in plain words

Yes: your answer is written down as a rule of the access area, proved by the two runner tests that check what a build's token reaches.

## The intro, for fun

An answer given once now has a home of its own.

## The punchline, for fun

It moved from a comment into the rule book.

## The options, in plain words

A. A. Keep the new rule as written (built).
B. B. Drop the rule and keep the answer in the settled ledger only.

## What I had to decide

The settle step writes an agreed answer back as knowledge; s1-01's answer became the new rule BR-ACCESS-8 in .omni-loop/knowledge/domains/access/rules.md, enforced by apps/galaxy/src/runners/runners.github-repositories.test.ts and apps/galaxy/src/runners/runners.ultra.test.ts.

## What I did meanwhile

The rule is in the access register on the feature branch, and its two tests are green.

## What it costs to change later

Removing the rule is one paragraph in the register; the code keeps working as built.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether every agreed answer should become a rule, or only some (author)
