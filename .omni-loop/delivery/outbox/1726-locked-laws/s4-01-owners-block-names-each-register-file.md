---
id: s4-01-owners-block-names-each-register-file
prd: 1726
slice: s4
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

Should the list of protected files name each knowledge file one by one, principles included, or protect the whole knowledge folder in one line?

## The decision, in plain words

Each file one by one: the thesis, every principles, rules and invariants file, every cross-domain file, and each law's test. A new knowledge area makes the list out of date until the command is run again.

## The intro, for fun

Someone had to decide how long the guest list is.

## The punchline, for fun

Every name is on it, so a newcomer has to be added by hand.

## The options, in plain words

A. A. Name each register file, principles included, and each law's test, one line each.
B. B. Own the rules and invariants files only, leaving principles to anyone.
C. C. Own the whole knowledge folder with one pattern, the playbook and decision records included.

## What I had to decide

Whether the owners block lists each register file, principles included, or one pattern for the whole knowledge folder.

## What I did meanwhile

The block lists the thesis (even before it exists), every principles.md, rules.md and invariants.md of the product and of each domain, every cross-domain file, then every path a locked law's Enforced by: line names, each path once and anchored at the root. The playbook, the decision records and domain READMEs are not owned. Adding a domain makes omni check knowledge red until omni kb owners is run again.

## What it costs to change later

Changing it later is a few lines in one function and its tests; the next omni kb owners run rewrites the block.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says "the register files" without saying whether principles count or whether a folder pattern would do; principles are owned because a principle is a register file and the thesis rests on them.
