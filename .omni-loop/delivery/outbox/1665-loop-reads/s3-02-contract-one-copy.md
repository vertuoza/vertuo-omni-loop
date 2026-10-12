---
id: s3-02-contract-one-copy
prd: 1665
slice: s3
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The page and the kit must read the same answer shapes, and the kit may not borrow the page's code. Where does the one copy of those shapes live now that the kit reads them?

## The decision, in plain words

The one copy now lives with the kit's reader, and the page builds its own stricter answers from it, as the earlier decision planned. The kit tolerates extra fields so an older kit still reads a newer page.

## The intro, for fun

One rulebook, two players, and only one of them may walk into the other's house.

## The punchline, for fun

So the rulebook moved to the house both are allowed into.

## The options, in plain words

A. One copy in the kit, the page building strict answers from it, as built.
B. Two copies, one per side, held equal by the shared examples only.
C. One copy in the kit, the page re-exporting it as is, loose.

## What I had to decide

Settled item s1-01 (option A) said to move the contract next to the kit's reader in the slice that shares it. Built: kit/lib/loop-reads/contract.ts holds the fields (z.object, unknown keys dropped, so a newer page still reads), with Loop-prefixed names (LoopChangeSchema, LoopChange…) so no export name is declared twice; apps/galaxy/src/loop/loop.contract.ts, outside s3's territory, now builds its strict answer schemas from those shapes (z.strictObject, url as z.url(), the 200 caps), its own query schemas unchanged. The kit's copy drops LoopRefusal for LoopErrorSchema. Two copies held equal only by the shared examples were refused by the repository's duplication gate.

## What I did meanwhile

Both sides still parse apps/galaxy/src/loop/fixtures/contract.json (kit/lib/loop-reads/contract.test.ts reads it by path); the galaxy's loop tests and typecheck pass unchanged.

## What it costs to change later

A file's imports: the galaxy contract can go back to its own fields in one edit, the routes and their tests keep their imports.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The galaxy now answers with schemas whose fields come from kit/lib; a kit change to a shape changes what the page sends on its next deploy. The shared examples catch a mismatch on either side, but the order of deploys still matters (landing 1 first).
- (author) The Loop prefix on the kit's names is mine; the spec names the shapes Change, Issue and so on.
