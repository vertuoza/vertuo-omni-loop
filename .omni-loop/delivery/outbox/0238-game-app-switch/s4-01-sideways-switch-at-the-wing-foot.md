---
id: s4-01-sideways-switch-at-the-wing-foot
prd: 238
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 3
---

## The question, in plain words

On a phone held sideways, the new switch between the game and the app goes under the speaker grille on the right. Should it sit just below the grille, or lower down, level with the OMNI LOOP name under the screen?

## The decision, in plain words

It sits at the bottom of the right side, level with the OMNI LOOP name under the screen, still below the grille. Everything else on that side keeps its exact place.

## The intro, for fun

The switch went looking for a seat under the grille and found the whole bottom row free.

## The punchline, for fun

It sat down level with the name tag, and nobody had to scoot over.

## The options, in plain words

A. At the bottom of the right side, level with the name under the screen, the option built.
B. Just below the grille, a fixed short step under it, whatever the phone's height.

## What I had to decide

Where on the sideways (Advance) body's right wing the GAME ▮▯ APP switch sits. The spec says "under the speaker grille, on the right wing" and that nothing else on the body moves; the wing centres A, B and the grille as one column, so a switch added to that column would push them up.

## What I did meanwhile

In src/arcade/shell.css the switch is placed out of the wing's column (absolutely, centred on the wing, 34 px tall, 3 px into the bottom gutter), so its middle lines up with the wordmark row under the lens. At 852×393 the grille ends at y 303 and the switch's track sits at y 365 to 377. Measured by hand in Chromium, no other part of either wing, the lens or the wordmark moves.

## What it costs to change later

One rule in shell.css (the switch's place on .form-advance); nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names the wing and says under the grille, not how far under it; the before-and-after page draws only the upright body.
