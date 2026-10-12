---
id: s1-01-contract-home
prd: 1665
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The shapes the Omni page answers for the loop's reads now live with the page, while the kit, which cannot read the page's code, will need the same shapes. Where should the one copy live?

## The decision, in plain words

I kept the shapes with the page for now, so the page could be built and tested alone, and left moving them next to the kit's reader for the slices that share them.

## The intro, for fun

Two programs, one handshake, and only one of them holds the rulebook.

## The punchline, for fun

For now the page writes the rules, and the kit learns them by heart.

## The options, in plain words

A. Keep the shapes with the page for this slice, and move them next to the kit's reader in the slice that shares them.
B. Move them next to the kit's reader now, before the kit's reader is written.
C. Keep two copies, held equal by shared sample answers.

## What I had to decide

Whether the loop contract's zod shapes stay in apps/galaxy/src/loop/loop.contract.ts, or move to kit/lib/loop-reads/ with the galaxy re-exporting them, as the product links' contract already does (kit/lib/product/targets.ts).

## What I did meanwhile

Wrote apps/galaxy/src/loop/loop.contract.ts with Change, ChangeDetail, the list query and the refusal shape. The kit may not import apps/galaxy (ADR-0058), so s2's shared fixtures or s3's adapter will have to hold a copy or move the shapes into kit/lib/loop-reads/.

## What it costs to change later

A file move and a re-export: the routes and their tests keep their imports through loop.contract.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The list's `state` defaults to `open` when the kit names none, as `gh pr list` does; the spec does not say. (author)
