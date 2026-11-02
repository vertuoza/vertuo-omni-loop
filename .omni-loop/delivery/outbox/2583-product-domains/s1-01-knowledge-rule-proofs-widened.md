---
id: s1-01-knowledge-rule-proofs-widened
prd: 2583
slice: s1
rank: high
bears-on: BR-PRODUCT-116
raised: 2026-11-02
wave: 1
---

## The question, in plain words

The tests that prove who answers for product knowledge, and that naming an owner is logged, now also cover the new Domains kind. Is it right to widen those proofs rather than keep the domain checks only in their own file?

## The decision, in plain words

The existing proofs were only added to: every earlier check still runs unchanged, and new lines prove that Domains is a third kind with its own owner, delegate and history, and that a kind outside the three is still refused.

## The intro, for fun

Three old rules just learned about a new neighbour.

## The punchline, for fun

Nobody moved out; the house simply got one more room.

## The options, in plain words

A. Keep the widened proofs: the old checks unchanged, new lines for the Domains kind beside them.
B. Leave the older proofs untouched and prove the Domains kind only in its own check file.

## What I had to decide

Answer A to keep the widened proofs as they are; answer B to move the domain lines out into supabase/checks/product_domains.sql and leave the older proofs exactly as they were.

## What I did meanwhile

The wave carries on with the widened proofs; the Domains rules are also proven on their own in supabase/checks/product_domains.sql.

## What it costs to change later

Undoing it is moving about forty lines of checks and tests from one file to another; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a rule's proof may be widened by a later PRD without its owner's word is not written in the playbook (author).
