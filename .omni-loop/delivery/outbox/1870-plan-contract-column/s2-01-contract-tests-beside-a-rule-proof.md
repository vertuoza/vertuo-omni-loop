---
id: s2-01-contract-tests-beside-a-rule-proof
prd: 1870
slice: s2
rank: high
bears-on: BR-PRODUCT-69
raised: 2026-10-13
wave: 2
---

## The question, in plain words

The new checks that the plan check refuses a slice with no declared contract were added to the test file that also proves the rule about a slice that must come first. Is it fine that this file now carries more than that proof?

## The decision, in plain words

Yes: the rule about a slice that must come first is untouched and still proven by the same checks. The file only gained checks for the new contract column.

## The intro, for fun

The test file that guards who goes first now also checks what each slice promises.

## The punchline, for fun

Same guard, one more question at the door.

## The options, in plain words

A. A. Keep the contract checks in the plan grading test file, beside the rule's proof (built).
B. B. Move the contract checks to a test file of their own, so the proof file stays as it was.

## What I had to decide

Confirm the proof of BR-PRODUCT-69 (kit/lib/inbox/plan-grade.test.ts) stands as it is, or ask for the contract checks to move to a test file of their own.
Decided by: Jev (hardToRevert 0.74) · agent said false

## What I did meanwhile

The contract checks sit in a new describe block at the end of the plan grading tests, as PRD 1870's spec names that file among its test seams and as s1 did for the config tests; no existing check of BR-PRODUCT-69 changed.

## What it costs to change later

Moving the new tests to a separate file: about seventy lines, no code change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person wants proof files kept to their proof alone was settled for PRD 1739 and PRD 1804, and asked again by this PRD's s1 item; the spec names this file as the test seam.
