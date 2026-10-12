---
id: s2-03-shared-fixtures-home
prd: 1665
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The page and the kit must agree on sample answers, but the kit may not borrow the page's code. Where should the one set of samples live?

## The decision, in plain words

The samples sit in one plain data file beside the page's shapes. The page checks every sample against its shapes, and the kit's own test will read the same file by its path, which borrows no code.

## The intro, for fun

One recipe card, two kitchens, and only one is allowed to cook from the other's pantry.

## The punchline, for fun

So the card is pinned on the wall where both can read it.

## The options, in plain words

A. A. Keep the samples beside the page's shapes, read by the kit's test by path (built).
B. B. Move them beside the kit's reader in landing 2, read by the page's test by path.
C. C. Keep two copies, one per side, held equal by a check.

## What I had to decide

Where the contract's shared fixtures live: apps/galaxy/src/loop/fixtures/contract.json (built, inside this slice's territory), read by s3's kit adapter test through fs, which ADR-0058's import rules do not cover; or under kit/lib/loop-reads/ in landing 2, with the galaxy reading it there.

## What I did meanwhile

Wrote apps/galaxy/src/loop/fixtures/contract.json with one example per answer (changes, change with review, comments, issues, issue, refusal) and apps/galaxy/src/loop/loop.contract.test.ts, which parses each unchanged and checks every check state appears.

## What it costs to change later

A file move and two paths, in either landing.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a kit test reading a file under apps/galaxy by path is welcome, given the kit ships to other repositories; it is a test, not shipped code.
