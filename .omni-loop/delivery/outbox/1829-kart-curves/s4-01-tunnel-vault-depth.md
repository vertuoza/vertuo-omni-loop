---
id: s4-01-tunnel-vault-depth
prd: 1829
slice: s4
rank: medium
bears-on: none
raised: 2026-10-13
wave: 3
---

## The question, in plain words

How far should the tunnel's ceiling sink toward its walls, and how round should the curve of that sinking be?

## The decision, in plain words

The ceiling sinks 10 units from the centre of the road to the walls, which keeps it above the player's eye, along a gentle arc that meets the walls without a step.

## The intro, for fun

The tunnel got a roof with a bit of belly.

## The punchline, for fun

Ten units of sag, and nobody has to duck.

## The options, in plain words

A. A. 10 units of sag, a shallow circular arc (built)
B. B. 6 units of sag: a flatter roof, a less visible vault
C. C. 14 units of sag: a deeper vault, closer to the player's eye

## What I had to decide

Pick the sag in rules.ts (vault) once you have driven the tunnel; it is one number.

## What I did meanwhile

The vault is 10 units deep, and the arc is a shallow part of a circle so the walls can meet it.

## What it costs to change later

A different depth is a one-number change; a different arc is one constant in mode7.ts.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec gives the vault's name but not its depth or the exact shape of its arc (author)
