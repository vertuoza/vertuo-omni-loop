---
id: s6-01-share-words-beside-home
prd: 261
slice: s6
rank: medium
bears-on: none
raised: 2026-09-27
wave: 2
---

## The question, in plain words

Where should the words and the picture a shared link shows live, so they can be tested?

## The decision, in plain words

They live in a small file of their own beside the rest of the home page, where tests can reach them; the two page files only point to it.

## The intro, for fun

Every ad needs a proof sheet before it goes to print.

## The punchline, for fun

So the proof sheet got its own drawer, right next to the poster.

## The options, in plain words

A. Keep the words and the card in their own tested file beside HOME, the option built.
B. Inline them in the two page files, untested, inside the row's territory as written.

## What I had to decide

The slice's territory is `apps/galaxy/app/opengraph-image`, `apps/galaxy/app/page.tsx` and the README, but tests only run under `apps/*/src/` (vitest.config.mjs), so nothing in the territory can hold a test of the metadata or the Open Graph card.

## What I did meanwhile

Added `apps/galaxy/src/home/share.tsx` (the title, the description, the card's size and its drawing) and `apps/galaxy/src/home/share.test.ts` beside it. `app/page.tsx` exports `HOME_METADATA` and `app/opengraph-image.tsx` renders `shareCard()`. The spec's Scope already puts the metadata and the Open Graph image under `apps/galaxy/src/home/`; both files are new, so no other slice's ground is touched.

## What it costs to change later

Moving two new files; no stored shape, no contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the plan meant the territory to include a test beside HOME (author)
