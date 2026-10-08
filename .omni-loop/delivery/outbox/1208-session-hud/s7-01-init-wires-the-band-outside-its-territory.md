---
id: s7-01-init-wires-the-band-outside-its-territory
prd: 1208
slice: s7
rank: medium
bears-on: N-PRODUCT-6
raised: 2026-10-08
wave: 3
---

## The question, in plain words

Setting up the loop now also turns on the band above the prompt, which needed a small change to the setup command this piece of work was not given. Is it fine that setup now writes two settings outside its own folder instead of one?

## The decision, in plain words

Yes: setup now writes one more setting in the same shared settings file, the line that turns the band on, by the same care rules, and commits that file whenever either of its two lines is the loop's.

## The intro, for fun

The setup was allowed to touch exactly one setting. The band politely asked for a second one.

## The punchline, for fun

Same file, same manners, one more line.

## The options, in plain words

A. Setup writes the band's line too, wired by a two-line change in the setup command, and commits the settings file when either line is the loop's (built).
B. Fold the band's line into the status-line writer so the setup command stays untouched; the settings file then goes uncommitted when the status line is someone else's but the band's line was added.
C. Leave setup alone and ask each person to turn the band on themselves.

## What I had to decide

Whether setup may write the band's line in the shared settings file, through a small change to the setup command outside this slice's paths, and whether the rule that setup writes only the status line there should now name the band too.

## What I did meanwhile

Setup adds the band's line after the status line. The setup command calls the new writer and commits the settings file when either line is the loop's. A value someone else set is never touched.

## What it costs to change later

A constant: removing the one call in the setup command, and its printed line, takes setup back to the status line alone.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gave this slice the setup library and its tests but not the setup command, which is the only place the new writer can be called from.
- (author) The knowledge entry saying setup writes only the status line outside its folder is still proposed and was not updated here: its folder is outside this slice.
