---
id: s9-01-design-areas-per-surface
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

Our app has three looks that live side by side: the public front page, the game, and the reading pages, yet the design page can describe only one look. Should it be able to describe each area on its own?

## The decision, in plain words

For now the design page describes the three areas in one block of text, and a reviewer has to work out which look applies to the screen in front of them.

## The intro, for fun

One wardrobe, three costumes, and a single label on the door.

## The punchline, for fun

The reviewer opens it and guesses which outfit today is.

## The options, in plain words

A. Keep one design page for the whole product, areas told apart in prose (built)
B. Add an optional areas list to the design form, read by the review and the word pass
C. Let each screen carry its own look, with no shared area

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: an optional areas list in the design form, each area with its own product, system, deliberate and review text and the paths or routes it covers; a screen of the library names its area; the review and the word pass read the area of the screen they look at.

## What I did meanwhile

Nothing of the kit changed in this slice. The form's System section says "Two surfaces read it differently" in prose (arcade.css and home.css use the named colours, ask.css the Ask reading tokens in three themes). The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a third look (the GitHub comments and check runs the app writes) is an area too is not settled by the spec
