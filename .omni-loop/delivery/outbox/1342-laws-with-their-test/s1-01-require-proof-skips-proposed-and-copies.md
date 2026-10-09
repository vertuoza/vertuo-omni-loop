---
id: s1-01-require-proof-skips-proposed-and-copies
prd: 1342
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

Once a repository says every law must name its test, should entries nobody has confirmed yet, and the copies a plan repository keeps of other repositories' knowledge, be held to it too?

## The decision, in plain words

No. An entry still waiting for a person's confirmation is not a law yet, so it may stay without a test; and a copied knowledge base follows its own repository's choice, not the plan repository's.

## The intro, for fun

A rule nobody has signed yet walks into the courtroom and asks to see its own test.

## The punchline, for fun

The judge says: come back once someone says you are a law.

## The options, in plain words

A. A. Skip both: a proposed entry is no law yet, and a copy follows its own repository (built).
B. B. Refuse proposed entries too: /omni:invade then has to write pending or a test for every entry it proposes.
C. C. Hold imported copies to the plan repository's own 'every law names its test' switch as well.

## What I had to decide

Whether the new 'every law names its proof' check also refuses unconfirmed (proposed) entries and imported copies.

## What I did meanwhile

Proposed entries and imported copies may stay untested when the switch is on; confirmed rules and invariants of the repository itself may not.

## What it costs to change later

A constant: two conditions in one function of the knowledge check, and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the check refuses 'a rule or an invariant' and does not name proposed entries or imported copies. (author)
- Whether a copy should read its target's requireProof once imported copies carry the target's config is left to a later PRD. (author)
