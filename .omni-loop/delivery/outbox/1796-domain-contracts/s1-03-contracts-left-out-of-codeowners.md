---
id: s1-03-contracts-left-out-of-codeowners
prd: 1796
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The list of files whose changes need the law owners' approval names every register file. Should the new contracts file be on that list too?

## The decision, in plain words

We left it off. A contract is never a law, and the spec asks that any person can answer a change to one, through the usual high question, not only the law owners.

## The intro, for fun

Every register gets a bouncer at the door, except the new one.

## The punchline, for fun

It never serves anything strong enough to need one.

## The options, in plain words

A. Leave the contracts file out of the owners list, as built.
B. Put the contracts file on the owners list too, so a contract edit also needs a law owner's approving review.

## What I had to decide

Whether omni kb owners' CODEOWNERS block owns each contracts.md beside principles.md, rules.md and invariants.md.

## What I did meanwhile

The block owns only the three required register files; contracts.md is never added, so this repository's CODEOWNERS file does not change and a contract edit asks no law owner.

## What it costs to change later

One list in kit/lib/codeowners-laws.ts; adding the file later means switching that list and re-running omni kb owners once.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a principles.md, which also holds no law yet is owned, should have set the precedent instead (author)
