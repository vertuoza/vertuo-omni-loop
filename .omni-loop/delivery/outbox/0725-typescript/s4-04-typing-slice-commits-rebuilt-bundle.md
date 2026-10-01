---
id: s4-04-typing-slice-commits-rebuilt-bundle
prd: 725
slice: s4
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

Typing a module changes a few lines of the built tool that other repositories install, a file no typing slice owns. Should each typing slice commit that rebuilt file?

## The decision, in plain words

Yes: this slice commits the rebuilt tool beside its own changes, so the check that it matches the source stays true. When several slices merge, the merger rebuilds it once more instead of resolving its lines by hand.

## The intro, for fun

A tidy-up of the source nudged a few lines in the built tool nobody owns.

## The punchline, for fun

The built tool shrugged and said it would just be rebuilt again anyway.

## The options, in plain words

A. A: each typing slice commits the rebuilt tool, and the wave rebuilds it again when slices collide on it
B. B: typing slices leave the built tool alone, and the wave rebuilds it once after merging them all
C. C: give the built tool to the command line slice, and let the check stay red until then

## What I had to decide

Whether s4 may commit kit/dist/omni.mjs, outside its territory, after typing its modules changed a handful of statements in the bundle (destructuring defaults, `?.`/`??` for noUncheckedIndexedAccess, key-by-key reads of config.paths).

## What I did meanwhile

kit/dist/omni.mjs is rebuilt with `pnpm kit:build` and committed in its own commit on the slice branch; the full suite (kit/test/dist.test.ts included) is green against it. The bundle's behaviour is unchanged: every change is a rewrite TypeScript asked for that computes the same values.

## What it costs to change later

If the wave would rather rebuild the bundle itself after merging every slice of the wave, drop this commit and run `pnpm kit:build` on the feature branch: a generated file, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names no owner for kit/dist/omni.mjs after s2, though every typing slice of the kit changes it (author)
