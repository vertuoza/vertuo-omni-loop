---
id: s1-05-first-contract-written-as-law-text
prd: 1796
slice: s1
rank: high
bears-on: DC-PRODUCT-1
raised: 2026-10-16
wave: 2
---

## The question, in plain words

This change writes the repository's first domain contract, and a change to a contracts file now counts as a change to the knowledge's text. Do you approve the contract as worded?

## The decision, in plain words

We wrote the one contract the spec asks for, word for word: an outbox item has exactly one rank, human-action, high or medium, and the file that enforces it is the front-matter schema.

## The intro, for fun

The new rule said every contract needs a signature, and the first contract arrived before the rule did.

## The punchline, for fun

So it waited at the door, holding its own permission slip.

## The options, in plain words

A. Keep DC-PRODUCT-1 as written, pointing to the front-matter schema.
B. Reword it, or point it to another file, before the feature merges.

## What I had to decide

Slice s1 wrote `.omni-loop/knowledge/product/contracts.md` before slice s2 made `law-text` fire on a `contracts.md` file. Once both merged, the feature's coverage grade named the file as an unaccounted law-text change, and a law-text change is accounted only by a high item. The spec settles the words (Solution, "This repository's first contract", and acceptance criterion 9); only a person can approve them as knowledge.

## What I did meanwhile

Kept the contract exactly as the spec words it, and accounted for the file with this item in s1's account. Nothing else changed.

## What it costs to change later

Rewording the contract or its `Points to:` line is a one-file edit; `omni check knowledge` checks the pointed file exists.

## What I could not know

(author) The spec does not say whether the first contract, written by the PRD that introduces the kind, needs the same approval as any later contract change.
