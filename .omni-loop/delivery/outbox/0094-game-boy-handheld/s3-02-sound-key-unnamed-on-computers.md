---
id: s3-02-sound-key-unnamed-on-computers
prd: 94
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

On a computer, nothing on screen says any more that the M key switches the sound off, because the plate under the screen that said so is gone. Should the screen say it?

## The decision, in plain words

For now nothing on screen names the M key: it still works as before, and phones get the speaker grille and its light instead.

## The intro, for fun

The volume knob is still on the machine; it just lost its little printed label.

## The punchline, for fun

Players who find it anyway will feel they have unlocked a secret level.

## The options, in plain words

A. Show nothing: the key works as before, unannounced. This is what was built.
B. Show a short message on the screen each time M is pressed, saying whether the sound is now on or off.
C. Name the key on the title screen, next to the credits at the bottom.

## What I had to decide

The spec retires the deck plates (decision 16), and the right-hand plate was the only place on `full` that read SOUND ON (M) or SOUND OFF (M). The spec gives the two Game Boy bodies the grille and the LED, and keeps M, but says nothing about the sound state or the M key on `full`, where no body and no LED is drawn.

## What I did meanwhile

Nothing is shown: on `full`, M toggles `omni-loop:muted` as before (`toggleSound()` in `ArcadeApp.tsx`, the same one the grille calls), with no indicator. The key hints on the screens belong to the scene groups in wave 3, and their wording to s7, so s3 adds none.

## What it costs to change later

Small either way: a toast on M is one line in `ArcadeApp.tsx`; a hint in the title's footer is a line in the attract group's text layer.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether desktop players found the M key through the plate: nothing measures it.
