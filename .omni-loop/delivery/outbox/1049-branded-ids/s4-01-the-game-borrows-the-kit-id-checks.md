---
id: s4-01-the-game-borrows-the-kit-id-checks
prd: 1049
slice: s4
rank: medium
bears-on: none
raised: 2026-10-03
wave: 3
---

## The question, in plain words

The game was written never to borrow code from the delivery tool, so that either can be removed alone. Should it now borrow the tool's new identifier checks, or keep its own copy?

## The decision, in plain words

The game borrows the tool's identifier checks and nothing else of it. Removing the game still leaves the delivery tool untouched, but the game now needs those checks to run.

## The intro, for fun

The game swore it would never borrow a thing from the toolbox next door.

## The punchline, for fun

It now borrows one ruler, and has written that down on the fridge.

## The options, in plain words

A. A. The game imports the kit's ID brands, and only them (built).
B. B. The game keeps a mirrored copy of the brands, as it mirrors the folder name rule.
C. C. The brands move to a shared package both the kit and the game import.

## What I had to decide

Whether the game imports the kit's identifier brands (one small module that depends on zod only), against its own rule that it never imports the kit, or keeps a mirrored copy of them.

## What I did meanwhile

game/ imports kit/lib/ids.ts, as the plan and the spec ask of every package; the two headers that stated the rule (game/sources/parsers.ts, game/dossiers/folders.ts) now say it holds but for the ID brands. Deleting game/ still leaves the delivery layer untouched.

## What it costs to change later

A copy of the brands inside game/ instead: one small file and changed imports in about ten game files, no stored data and no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says ids.ts is importable by every package as narrow.ts is, and the plan gives game/ to s4; it does not say whether the game's own rule (never import the kit, so game/ can be deleted alone) gives way. The rule's direction (deleting game/ touches nothing else) still holds.
