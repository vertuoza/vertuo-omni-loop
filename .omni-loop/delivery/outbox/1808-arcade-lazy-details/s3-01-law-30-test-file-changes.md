---
id: s3-01-law-30-test-file-changes
prd: 1808
slice: s3
rank: high
bears-on: BR-PRODUCT-30
raised: 2026-10-13
wave: 2
---

## The question, in plain words

The file that proves the arcade's rule about people it cannot place (they still read as crew, with the galaxy out of reach) had to change, because the game no longer reads every planet's dossier on load. Is it right that the dossier checks in that file were replaced, while the rule's own check stays as it was?

## The decision, in plain words

The rule's own check is untouched and still passes. The old checks that the first load reads every dossier were replaced by checks that it reads none and sends planets without their logs.

## The intro, for fun

The rule's proof lives in a busy house, and the dossier tenants just moved out.

## The punchline, for fun

The rule kept its room and its key; only the neighbours changed.

## The options, in plain words

A. A. Keep the new checks beside the rule's check in the same file, the rule's check unchanged (as built)
B. B. Move the new first-load checks to a file of their own, so the rule's proof file only loses the old dossier checks

## What I had to decide

Whether the rule's proof file may change around the rule's own check, as built, or whether the new checks should live in a file of their own.
Decided by: Jev (hardToRevert 0.56) · agent said true

## What I did meanwhile

The rule's check runs as before and passes. The file's dossier section now proves the first load reads no dossier, and every planet arrives with an empty log.

## What it costs to change later

Moving the new checks to a file of their own is a small test-only change: one new file, one section removed, no product change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Nothing says whether a rule's proof file may hold checks of other behaviour that change later; the testing form allows it as long as the rule's own checks stay.
