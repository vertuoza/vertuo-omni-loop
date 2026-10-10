---
id: s9-06-mockup-convention-for-pages-about-screens
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

Our before-and-after pages are documents that explain a change with small drawings of screens inside, and the word check reads the whole document as one screen when nothing is marked, so almost everything it reports is about the explanations, not the screens. How should it treat such pages?

## The decision, in plain words

Nothing was changed: the word check ran over all one hundred and forty pages, one of them marked, and its two thousand six hundred and fifty-three warnings are recorded with the few real faults picked out by hand.

## The intro, for fun

The proofreader was handed the whole magazine to check one advert.

## The punchline, for fun

It underlined every article and missed the typo in the ad.

## The options, in plain words

A. Run the word check as it is and record its findings by hand (built)
B. Make unmarked pages report nothing, and fix how strings and primaries are read
C. Mark the screens in every past before-and-after page

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: a page with no marked screen reports "no screen marked: nothing read" instead of reading the page whole, or reads its explanatory prose apart from any screen; the strings are split at every element, not only block tags, so a heading and its caption are not one sentence; an element marked primary counts as a control for the long-label rule; a page's screens are named by a mockup convention the kit's skills already write; and omni check warns on a new before/after page that marks no screen.

## What I did meanwhile

Nothing of the kit changed in this slice. The word pass ran on every before-after.html of the inbox and shipped folders; its findings by rule, per page, are in dogfood.md. PRD 1407's own page marks its "today" mock, whose ten-word label on a primary was reported as text at rest, not as a long label. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether old shipped pages should be marked after the fact is not settled: they are records of a decision, and editing them changes the record
