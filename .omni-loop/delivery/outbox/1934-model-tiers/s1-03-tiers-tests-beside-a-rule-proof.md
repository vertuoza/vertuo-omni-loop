---
id: s1-03-tiers-tests-beside-a-rule-proof
prd: 1934
slice: s1
rank: high
bears-on: BR-PRODUCT-23
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The new checks for the setting that maps each kind of slice to a model were added to the test file that also proves the config refuses a bad signature. Is it fine that this file now carries more than that proof?

## The decision, in plain words

Yes: the signature rule and its checks are untouched. The file only gained checks that the new setting is read, is absent unless a team sets it, and refuses a bad entry by its name.

## The intro, for fun

The signature rule's proof got new neighbours, and they promise to keep the noise down.

## The punchline, for fun

Same building, same locks, just one more name on the mailbox.

## The options, in plain words

A. Keep the tiers checks in the config's test file, beside the signature rule's proof (built).
B. Move the tiers checks to a test file of their own, leaving the proof file as it was.

## What I had to decide

Where the checks of the new tiers setting live: in the config's test file, beside the signature rule's proof, as the spec's test seams name, or in a file of their own.

## What I did meanwhile

The checks sit in the config's test file; the signature rule's checks are unchanged and still prove it.

## What it costs to change later

Moving the checks to a file of their own is a cut and paste of two test blocks.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the config's test file for these checks; whether a rule's proof file should hold only that proof is not settled anywhere (author).
