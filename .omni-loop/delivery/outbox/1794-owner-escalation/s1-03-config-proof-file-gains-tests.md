---
id: s1-03-config-proof-file-gains-tests
prd: 1794
slice: s1
rank: high
bears-on: BR-PRODUCT-23
raised: 2026-10-15
wave: 1
---

## The question, in plain words

The test file that proves the settings refuse a bad signature also gained the tests of the new stand-in and leadership settings. Is that acceptable, with the signature checks themselves left exactly as they were?

## The decision, in plain words

The new settings are tested in the same file as every other setting, beside the signature checks, which were not changed. The testing rules allow a proof file to gain tests of other behaviour this way.

## The intro, for fun

The settings' test file got a few new roommates.

## The punchline, for fun

The old tenant, the signature check, kept its room exactly as it was.

## The options, in plain words

A. A. Keep the new settings' tests in the settings test file, beside the unchanged signature checks.
B. B. Move the new tests into a test file of their own, so the proof file is left untouched.

## What I had to decide

Answer A to keep the new tests where they are, or B to move them into a test file of their own.

## What I did meanwhile

The signature rule is proven by the same checks as before; only tests of other settings were added beside them.

## What it costs to change later

Moving the new tests to their own file later is a cut and paste, with no change to any code.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The coverage guard counts any change to a proof file as a change to the rule, so it asks for this item (author).
