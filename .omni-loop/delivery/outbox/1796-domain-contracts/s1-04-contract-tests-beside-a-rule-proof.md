---
id: s1-04-contract-tests-beside-a-rule-proof
prd: 1796
slice: s1
rank: high
bears-on: BR-PRODUCT-95
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The tests for the new contract checks went into the same file that proves an existing rule about the knowledge check. Is it fine to grow that file, as long as the rule's own tests stay as they are?

## The decision, in plain words

We added the contract tests to that file, as the spec's test plan asked, and left the rule's own tests exactly as they were.

## The intro, for fun

A new neighbour moved into the building where a rule keeps its proof.

## The punchline, for fun

Nobody touched the rule's flat, but the doorbell rang anyway.

## The options, in plain words

A. Keep the contract tests in the file that proves the rule, as built.
B. Move them into a test file of their own, so the rule's proof file stays only about the rule.

## What I had to decide

Whether slice s1's contract tests may live in kit/lib/knowledge/check-knowledge.test.ts, the file BR-PRODUCT-95's Enforced by: names, beside that rule's proof.

## What I did meanwhile

One new describe block, 'a domain contract (PRD 1796)', is appended to the file; no existing test in it is changed or removed, so BR-PRODUCT-95's proof (the laws.requireProof block) runs as before. The testing form allows a law's proof file to gain tests of other behaviour (PRD 1739, s2-01).

## What it costs to change later

Moving the block to its own test file later is a cut and paste, with no stored shape involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the coverage guard should tell an added test from a changed proof in a law's test file (author)
