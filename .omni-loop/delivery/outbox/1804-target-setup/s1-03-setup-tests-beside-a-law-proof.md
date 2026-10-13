---
id: s1-03-setup-tests-beside-a-law-proof
prd: 1804
slice: s1
rank: high
bears-on: N-PRODUCT-13
raised: 2026-10-13
wave: 1
---

## The question, in plain words

The new checks for the preparation step were added to two test files that also prove that the install writes only inside its own folder, and that the config refuses a bad signature. Is it fine that those files now carry more than those proofs?

## The decision, in plain words

Yes: both rules are untouched and still proven by the same checks. The files only gained new checks that the config reads the preparation step and that the install proposes and writes it.

## The intro, for fun

Two test files guard the install's manners, and now they guard a little more.

## The punchline, for fun

Same guard dogs, one extra gate to watch.

## The options, in plain words

A. A. Keep the setup checks in the files that already test init and the config, beside the rules' proofs (built).
B. B. Move the setup checks to test files of their own, so the proof files stay as they were.

## What I had to decide

Confirm the proofs of N-PRODUCT-13 (kit/bin/init.test.ts) and BR-PRODUCT-23 (kit/lib/config.test.ts) stand as they are, or ask for the setup checks to move to test files of their own.

## What I did meanwhile

The setup checks live beside the existing init and config tests, as the testing form allows (PRD 1739, s2-01); no existing check of either rule changed.

## What it costs to change later

Moving the new tests to separate files: a few dozen lines, no code change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person wants proof files kept to their proof alone was settled once for PRD 1739 only (author).
