---
id: s9-05-accessibility-floor-per-area
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

The reading pages test every text colour for contrast, while the game uses tiny pixel text and the whole site turns off pinch zoom for the handheld look; nothing says which accessibility floor each part of the product keeps. Should the design page say so?

## The decision, in plain words

The design page asks a person whether zoom being off on the reading pages is on purpose, and records no floor of its own.

## The intro, for fun

The arcade locks the zoom so the handheld looks right on a phone.

## The punchline, for fun

The reading room next door inherited the lock without asking.

## The options, in plain words

A. Leave the floor to the generic craft floor and ask about zoom (built)
B. Add an accessibility floor per area to the design page
C. Fold it into each locked law of the Language section

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: an accessibility slot per area in the design form: the contrast level, the smallest text, zoom, reduced motion, keyboard or gamepad paths, and what each area sets aside on purpose; the review checks a screen against its own area's floor instead of the craft floor alone.

## What I did meanwhile

Nothing of the kit changed in this slice. apps/galaxy/app/layout.tsx sets maximumScale 1 and userScalable false for every page; apps/galaxy/app/app/layout.tsx overrides only the theme colour. The form's Deliberate section holds the question. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether zoom being off on the app pages is deliberate is unknown: the layout comment speaks of the Game Boy only
