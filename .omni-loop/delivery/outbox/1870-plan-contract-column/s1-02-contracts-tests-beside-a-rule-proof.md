---
id: s1-02-contracts-tests-beside-a-rule-proof
prd: 1870
slice: s1
rank: high
bears-on: BR-PRODUCT-23
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The new checks that the config reads which contracts a repository asks for were added to the test file that also proves the config refuses a bad signature. Is it fine that this file now carries more than that proof?

## The decision, in plain words

Yes: the signature rule is untouched and still proven by the same checks. The file only gained checks for the new contracts setting, and its list of the config's top-level names gained that one name.

## The intro, for fun

The test file that guards the signature now also guards the contracts.

## The punchline, for fun

Same guard, one more door on the round.

## The options, in plain words

A. A. Keep the contracts checks in the file that already tests the config, beside the rule's proof (built).
B. B. Move the contracts checks to a test file of their own, so the proof file stays as it was.

## What I had to decide

Confirm the proof of BR-PRODUCT-23 (kit/lib/config.test.ts) stands as it is, or ask for the contracts checks to move to a test file of their own.
Decided by: Jev (hardToRevert 0.76) · agent said true

## What I did meanwhile

The contracts checks live beside the existing config tests, as the testing form allows (PRD 1739, s2-01) and as PRD 1804 did; no existing check of the signature rule changed, and the root key list test gained `contracts`.

## What it costs to change later

Moving the new tests to a separate file: a few dozen lines, no code change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person wants proof files kept to their proof alone was settled for PRD 1739 and PRD 1804 only (author).
