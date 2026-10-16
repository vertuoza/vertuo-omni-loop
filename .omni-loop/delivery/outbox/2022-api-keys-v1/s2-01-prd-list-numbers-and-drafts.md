---
id: s2-01-prd-list-numbers-and-drafts
prd: 2022
slice: s2
rank: medium
bears-on: none
raised: 2026-10-16
wave: 2
---

## The question, in plain words

The list of PRDs a program reads does not say whether a PRD still being written belongs in it, nor which number a product PRD carries. Should drafts show, and should a product PRD give its number on its product?

## The decision, in plain words

We list only PRDs that already have a number, so a draft still being brainstormed never shows. A product PRD gives its number on its product, and its name reads like the loop writes it, such as mobile-12.

## The intro, for fun

A draft is a PRD that has not picked its name yet.

## The punchline, for fun

We let it finish its coffee before the guest list goes out.

## The options, in plain words

A. A. List numbered PRDs only; a product PRD's number is its number on its product, as built.
B. B. List drafts too, with no number and no name until the PRD is numbered.
C. C. Keep drafts out, and give a product PRD no number, leaving its name, such as mobile-12, as the only way to tell it.

## What I had to decide

Whether GET /api/v1/prds lists draft dossiers (kind prd, no number yet), and what `number` holds for a product PRD, whose `ref` the spec gives as `<product key>-<seq>`.

## What I did meanwhile

The list keeps only numbered dossiers (`numbered_at` set, which a product PRD has from its birth). A repository PRD answers `number` = its issue and `ref` = that number. A product PRD answers `number` = its sequence on its product, `ref` = `<key>-<seq>`, `repo` and `issue` null, `stage` null. A product PRD whose product was deleted answers `ref` as the bare sequence and `product` null. The bug-fix list keeps only numbered dossiers too.

## What it costs to change later

A constant: drop the `numbered_at` filter in public-api.repository.ts and let `number` be nullable in the contract. Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names `number` in the PRD shape without saying what it holds for a product PRD.
- (author) Whether a program wants to see PRDs still at the idea stage.
