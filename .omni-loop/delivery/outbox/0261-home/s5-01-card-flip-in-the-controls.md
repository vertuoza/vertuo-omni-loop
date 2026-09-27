---
id: s5-01-card-flip-in-the-controls
prd: 261
slice: s5
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

A trading card has to turn over on a tap, Enter or Space, which needs a little script, and the page allows only one piece of script, owned by another part of the plan. Where should the flip live?

## The decision, in plain words

The flip was added to that one piece of script, a two-line change, so the page still ships a single script and every card turns over on a tap, Enter or Space.

## The intro, for fun

The cards wanted to flip, but the page only hires one stagehand.

## The punchline, for fun

So the stagehand learned a card trick on the side.

## The options, in plain words

A. Flip inside the one client component: What is built: one script on the page, the flip logic tested in the spreads folder.
B. A second client component in the spreads: Stays inside the slice's files, but the page ships two scripts, against the spec.
C. No script: hover and focus only: No change outside the slice, but Enter, Space and a tap on some phones would not flip a card.

## What I had to decide

Whether the cards' flip on a tap, Enter or Space goes into HOME's one client component, which the plan gave to the interactions slice, or somewhere this slice owns.

## What I did meanwhile

apps/galaxy/src/home/spreads/flip.ts holds the flip (a card is a button with data-flip; a click toggles aria-pressed, which home.css turns over), tested on its own; Controls.tsx calls it first in its click handler, two lines. Hover flips a card with CSS alone.

## What it costs to change later

Moving it out is a matter of deleting the two lines from Controls.tsx and mounting a second small client component in spreads/, at the price of a second script on the page.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gives Controls.tsx to s3 only and the spreads' territory does not name it, while the spec says one client component carries every interaction including the cards; the spec was followed over the territory list.
