---
id: s9-03-motion-vocabulary
prd: 1407
slice: s9
rank: medium
bears-on: none
raised: 2026-10-10
wave: 6
---

## The question, in plain words

Our screens move in a handful of ways on purpose: a blinking start button, a turning planet, a flyby, a level-up flash, each stilled when a person asks for less motion, and nothing in the design page records how things move. Should it?

## The decision, in plain words

Motion is left unwritten: the design page describes colours, faces and widths, and each slice keeps finding the moving parts in the stylesheets.

## The intro, for fun

The planet spins, the button blinks, and nobody wrote the dance down.

## The punchline, for fun

Every new step gets invented again, a little out of time.

## The options, in plain words

A. Leave motion out of the design page (built)
B. Add an optional motion slot: named moments, timing and the reduced-motion version of each
C. Keep motion in each screen of the library instead

## What I had to decide

Not built here: the dogfood records it for a person to decide whether it becomes a follow-up PRD. The fix it would make: an optional motion slot in the design form: the named moments (enter, blink, celebrate, page change), their durations and easings, what each becomes under reduced motion, and which areas allow which; the craft floor's motion rule reads it.

## What I did meanwhile

Nothing of the kit changed in this slice. The reduced-motion handling exists in twenty galaxy files (src/arcade/scenes/*.css, src/home/home.css, src/ask/ask.css), and the form names none of it. The finding and its evidence are in .omni-loop/delivery/inbox/1407-design-memory/dogfood.md.

## What it costs to change later

A constant: a follow-up PRD adds the concept, or this item is dropped. Nothing written here needs a migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists motion skills as out of scope; a motion slot is a written vocabulary, not a skill, but the line between them is the person's to draw
