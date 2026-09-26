---
id: s6-02-what-follows-a-theme
prd: 100
slice: s6
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

When a workspace changes one of the arcade's named colours, which parts of the screen should change with it?

## The decision, in plain words

Every part drawn in exactly that colour changes with it, the animated scenes included: the glow around the heroes, the pulse of a planet in trouble, the planets' status labels. The see-through shading over panels, and the colour of a planet no fleet holds, keep today's colours.

## The intro, for fun

Change the purple, and you learn how many things were quietly purple all along.

## The punchline, for fun

Most of them now change along; the shadows stayed as they were, to keep the lights low.

## The options, in plain words

A. Every part drawn in exactly one of the named colours follows it; see-through shading and a planet no fleet holds keep today's colours. This is what was built.
B. The same, and the see-through shading over panels follows the colour it shades too.
C. Only the page's named colours follow a theme; the animated scenes keep today's colours, except the letter and the heroes' stripes.

## What I had to decide

The spec makes every colour custom property on `:root` a token and says the canvas scenes read the same resolved values, but not which of the canvas's colours are tokens. The scenes wrote their colours as literals: some are a token's value (`#a45cff` for OmniMan's glow and the plasma trail, `#6a2fd0` in the trail, `#ff3b5c` for a distress pulse and the map's hyperlanes, `#6ff0ff` for the away bar and a terraformed planet's atmosphere, `#ffd84a` for the map's brackets, `#07061c` for space), others are no token's (nebulae, star layers, the `#0b0a26` outlines). The stylesheets also write translucent shades of tokens as `rgba()` (panels over `deep`, `void` and `navy`), and `fleets.ts` gives a planet no fleet holds `#8a90d6`, `dim`'s value, which the canvas draws too.

## What I did meanwhile

A canvas literal equal to a token's default now reads that token from `FrameState.theme` (`scenes/common.ts`, `attract.ts`, `join.ts`, `map.ts`, `menu.ts`, `planet.ts`): `theme.test.ts` fails if a scene writes a token's default again, and `scenes/theme.test.ts` draws every scene with every token overridden. Every canvas sprite goes through `sprite()` in `scenes/common.ts`, which passes the theme's stripes. `STATE_LOOK` and `WOUND_LOOK` in `fleets.ts`, read only by the DOM panels, write their token colours as `var(--token)`. Translucent `rgba()` shades, the page background behind the Game Boy, and the uncrewed fleet's colour (read by the canvas, where a custom property cannot reach) keep their literals.

## What it costs to change later

Constants: a literal swapped for a theme read, or back, in the scene files and `fleets.ts`, and their tests. Nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a panel's see-through background should follow `deep` and `navy`: writing it as a mix of the token would need checking that it renders pixel for pixel as today (author)
- nobody but the author has looked at a themed workspace, and only at one teal test brand on a local copy (author)
