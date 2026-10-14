---
id: s2-01-skills-check-beside-bundle-law
prd: 1890
slice: s2
rank: high
bears-on: N-PRODUCT-5
raised: 2026-10-14
wave: 1
---

## The question, in plain words

The check that the kit carries every skill now lives in the same test file that proves the kit builds the same bytes wherever it starts. Is it fine there?

## The decision, in plain words

The new check sits beside the law's proof, in the file the plan names. The proof itself is untouched: it builds and compares exactly as before.

## The intro, for fun

One test file, two jobs, no elbows thrown.

## The punchline, for fun

The old proof did not even notice its new neighbour.

## The options, in plain words

A. Keep the skills check beside the bundle law's proof, the proof untouched (built).
B. Move the skills check to a test file of its own, leaving the law's file as it was.

## What I had to decide

Keep the skills check in kit/test/dist.test.ts beside N-PRODUCT-5's proof (A), or move it to a test file of its own (B).

## What I did meanwhile

kit/test/dist.test.ts gained one test that builds the bundle to a scratch file, imports it and compares every file under kit/plugin/skills/ byte for byte; N-PRODUCT-5's own test is unchanged and green.

## What it costs to change later

Moving one test to a new file: a few minutes, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person would rather keep a law's proof file to the law alone (author).
