---
id: s2-05-main-watch-setting-in-the-rule-proof
prd: 2410
slice: s2
rank: high
bears-on: BR-PRODUCT-23
raised: 2026-10-22
wave: 2
---

## The question, in plain words

May the new on and off setting for the watch be tested in the file that proves the rule about the signature's name and email?

## The decision, in plain words

Yes: the new setting is tested in that file, beside the rule's tests, as the last few settings were, and the file's list of every setting now names it. The rule's own tests are unchanged.

## The intro, for fun

The rule's proof keeps a list of every setting, and a new setting cannot hide from a list.

## The punchline, for fun

The rule's own tests did not move; the new neighbour just signed the guest book.

## The options, in plain words

A. Test the new setting in that file, beside the rule's tests, and add it to the file's list of settings (built).
B. Move the new setting's test to a file of its own; the list of settings in the rule's file still has to name it.

## What I had to decide

Whether s2 adds its `mainWatch.enabled` test to `kit/lib/config.test.ts`, which proves BR-PRODUCT-23, beside the retro guards' test (PRD 2338), and adds `mainWatch` to the test that lists every key `parseConfig` returns; BR-PRODUCT-23's own tests are left as they were. Decided by: Jev (hardToRevert 0.70) · agent said true

## What I did meanwhile

Built as option A: one new test and one word in the key list of `kit/lib/config.test.ts`; `omni check coverage` names the file as a law proof.

## What it costs to change later

Moving the new test to a file of its own is a cut and a paste; the key list has to name the setting wherever it lives.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the testing form asks that tests of other behaviour leave a proof's file untouched, while the plan gives this slice `kit/lib/config.test.ts` and the key list there must name every setting
