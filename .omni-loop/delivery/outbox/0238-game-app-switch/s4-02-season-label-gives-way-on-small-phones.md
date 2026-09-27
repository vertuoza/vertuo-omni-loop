---
id: s4-02-season-label-gives-way-on-small-phones
prd: 238
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

On a phone held upright, the new switch shares a row with the OMNI LOOP name and the season, and on the narrowest phones all three do not fit. How much of the row should the switch take?

## The decision, in plain words

The switch is kept compact, so the whole season (SEASON 2026-09) still shows on phones 390 pixels wide or wider. On narrower phones the end of the season is cut and replaced by three dots, as the spec asks, and the switch always stays on the body.

## The intro, for fun

Three things wanted one short shelf: a name, a season and a brand-new switch.

## The punchline, for fun

On the smallest phones, the season agreed to lose its last few letters.

## The options, in plain words

A. A compact switch: the whole season shows from 390 pixels wide and is cut below that, the option built.
B. A roomier switch, easier to hit with a thumb, with the season cut on more phones.

## What I had to decide

How wide the GAME ▮▯ APP switch is on the upright (Handheld) body, which sets the phone width below which the season label is cut. The spec asks for the ellipsis before the switch leaves the body; it gives no size for the switch or for its touch area.

## What I did meanwhile

In src/arcade/shell.css the upright body's grid gains an auto column beside the wordmark that only the switch takes (zero wide without it), and the season label shrinks with an ellipsis. The switch's button is 98×34 px to touch: an 8 px lead-in, GAME, a 26×12 px track with its knob, and APP, its words at 8 px. Measured by hand in Chromium: SEASON 2026-09 shows whole at 393 and 390 px wide and is cut at 375, 360 and 320; OMNI LOOP and every other part of the body keep their places, and the switch ends 12 px inside the screen's edge.

## What it costs to change later

Two lengths in shell.css (the switch's padding and gap); nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the long season label and asks for the ellipsis, but gives no size for the switch or its touch area, and no phone width at which the whole label must still fit.
