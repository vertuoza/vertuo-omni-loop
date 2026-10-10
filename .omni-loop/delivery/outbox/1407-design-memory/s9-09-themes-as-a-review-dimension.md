---
id: s9-09-themes-as-a-review-dimension
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

The reading pages come in three themes, the default dark one, a light one and a dark one, and our screenshot script shoots each; a locked screen has one mockup, and the review checks widths, not themes. Should a screen be reviewed and locked in every theme it has?

## The decision, in plain words

The design page lists the three themes under how to review a screen; the library has no way to say which theme a mockup shows.

## The intro, for fun

The same room, painted three ways, photographed in one light.

## The punchline, for fun

The other two coats dry with nobody looking at them.

## The options, in plain words

A. List the themes in the design page only (built)
B. Review and lock each screen in every theme the product ships
C. Pick one reference theme and review only that one

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: the review slot names the themes (or modes) the product ships, the review shoots each of them, and a screen's mockup may hold one view per theme, a locked screen being compared in each.

## What I did meanwhile

Nothing of the kit changed in this slice. The form's Review section names Omni, Light and Dark from apps/galaxy/scripts/shots.ts. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Which theme is the reference when only one mockup exists is asked in dashboard.md
