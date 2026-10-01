---
id: s2-01-demo-pitch-wiring
prd: 859
slice: s2
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

The demo should show the Pitch panel switched off, but the demo's sample PRD is still being built, so it never shows a Pitch button at all. Should the demo's sample PRD be moved to shipped so the switched-off panel can be seen?

## The decision, in plain words

The page now knows when it is the demo and draws the Pitch panel switched off there, but the demo's sample PRD keeps its current stage, so the demo shows no Pitch button today.

## The intro, for fun

A demo that can pitch, if only its sample would ever ship.

## The punchline, for fun

The panel is ready and waiting; the sample is still at work.

## The options, in plain words

A. A. Keep the demo flag wiring and leave the demo PRD at building: the disabled panel is proven by tests but not visible in the demo.
B. B. Also move the demo PRD's stored stages to shipped, so the demo shows the disabled Pitch panel (and loses its building badge).
C. C. Add a second demo PRD at shipped beside the current one, so both the building badge and the disabled Pitch panel show.

## What I had to decide

Whether the demo dossier's built-in stages move to shipped (or a second demo PRD at shipped is added) so the disabled Pitch panel is visible in demo mode, and whether the two one-line changes outside the slice's territory (view.ts gains an optional demo flag, DossierPage.tsx passes it to StageAction) are kept.

## What I did meanwhile

DossierView carries an optional demo flag, set only on the demo dossier; DossierPage passes it to StageAction, which opens the Pitch panel disabled. demo.ts is unchanged, so the demo PRD stays at building and shows no Pitch.

## What it costs to change later

One line in demo.ts to move the demo's stages, or dropping the optional flag and its two lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether moving the demo PRD to shipped would hide the building-stage questions badge the demo shows today (author)
