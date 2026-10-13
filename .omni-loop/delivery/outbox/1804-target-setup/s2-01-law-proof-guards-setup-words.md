---
id: s2-01-law-proof-guards-setup-words
prd: 1804
slice: s2
rank: high
bears-on: N-PRODUCT-15
raised: 2026-10-13
wave: 1
---

## The question, in plain words

To check the new install step, this slice added checks to the test file that also proves that only a person merges. Is it fine to change that file this way?

## The decision, in plain words

The new checks only read the words about the install step. Every check that proves an agent never merges is kept exactly as it was.

## The intro, for fun

One file guards two promises, and we just taught it a new trick.

## The punchline, for fun

The old promise still stands; the file just learned to read one more line.

## The options, in plain words

A. A. Keep the new install-step checks in the shared test file, beside the unchanged merge checks.
B. B. Move the install-step checks into a test file of their own, leaving the merge law's proof file untouched.

## What I had to decide

Answer A to keep the new checks beside the merge checks in the same test file. Answer B to move them into a test file of their own, so the file that proves the merge law stays untouched.

## What I did meanwhile

The new checks sit in the same file as the merge checks; nothing about merging changed.

## What it costs to change later

Moving the new checks to another file later is a small test-only change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the coverage guard should treat additions to a law's proof file that leave its assertions unchanged as risky is not settled by the spec (author).
