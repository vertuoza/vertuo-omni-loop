---
id: s2-01-pinned-box-height-on-a-laptop
prd: 476
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

On a small laptop screen, the pinned header box of a PRD page takes a bit less than half the screen height, more than the third the design aimed for. Is that fine, or should the box get smaller?

## The decision, in plain words

The box keeps its three rows exactly as designed: the title, the facts and the tabs. On a small laptop it covers a bit less than half the screen while pinned; on a big screen it covers about a fifth.

## The intro, for fun

A header that stays with you is lovely, until it sits on half of your sofa.

## The punchline, for fun

It keeps every fact in reach; the spec below just gets a slightly smaller window.

## The options, in plain words

A. Keep the three rows as designed: the full box pins from 900 by 700 pixels.
B. Make the pinned box more compact: a smaller title and a tighter facts strip while pinned, to stay near a third of a 720 px screen.
C. Pin only on taller screens: raise the height threshold (for example to 800 px), so a 720 px laptop scrolls the box away.

## What I had to decide

Whether the pinned header box may cover a bit less than half of a 1280 by 720 screen, or must be made smaller there.

## What I did meanwhile

The box is pinned from 900 by 700 pixels with all three rows. Measured on the demo PRD: 315 px of 720 at 1280 by 720, 233 px of 1080 at 1920 by 1080.

## What it costs to change later

A CSS change inside the dossier stylesheet: a smaller title, a tighter strip, or a taller threshold. No data, no markup contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The height depends on the title length and the repository count; measured on the demo PRD only, not on PRD 459's page (author)
