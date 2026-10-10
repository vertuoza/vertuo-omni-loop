---
id: s9-02-copy-laws-scoped-to-an-area
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

The front page must never say six of the loop's inside words, but the reading pages use one of them on purpose, and the kit keeps one list of avoided words for the whole product. Should a list apply only where it belongs?

## The decision, in plain words

No product-wide list was written. Tried as one, it raised three hundred and twenty-nine warnings on pages where those words are the right ones, and it missed a plural the front page's own test catches.

## The intro, for fun

A word banned in the shop window is the name of the product in the back office.

## The punchline, for fun

One list for both rooms shouts at the wrong one all day.

## The options, in plain words

A. Leave the avoided-word list product-wide and write none for omni-loop (built)
B. Scope avoided words to an area or a set of screens, with plurals and exceptions
C. Move copy laws into locked laws of the Language section

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: avoided words scoped to an area or to a screen (a glob of screens or routes), matched with their plural like apps/galaxy/src/home/lingo.ts does, with the parts of a page they skip (code, a glossary sidebar) named; plus a "say instead" column, since a copy law names the word to use as well as the one to avoid.

## What I did meanwhile

Nothing of the kit changed in this slice. The form's Product section records HOME's list as HOME's, from lingo.ts, and asks a person whether a product-wide list exists. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether copy laws belong in the Language slot (locked laws) or in Product (described voice) is not settled
