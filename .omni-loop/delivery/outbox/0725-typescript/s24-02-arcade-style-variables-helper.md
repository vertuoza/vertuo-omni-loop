---
id: s24-02-arcade-style-variables-helper
prd: 725
slice: s24
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

The game screens colour many elements through style variables, which the typing rules only accept with a forced conversion on each line. Should each line carry its own marked conversion, or should one small shared helper do it once?

## The decision, in plain words

One small helper in the game's folder does the conversion once, and every screen in this slice uses it. The pages draw exactly the same.

## The intro, for fun

Eighteen screens each had to sign the same permission slip to wear a colour.

## The punchline, for fun

Now one slip sits at the front desk and everyone points at it.

## The options, in plain words

A. A: one helper in the game's folder, used by this slice's screens
B. B: a marked conversion on every line that sets a style variable
C. C: teach the typing rules about style variables once for the whole web app

## What I had to decide

How to type React styles that set CSS custom properties without a marked cast on every element.

## What I did meanwhile

Added apps/galaxy/src/arcade/css-vars.ts (cssVars, one `// ts-allow:` cast). It replaced 18 `['--x' as string]` keys in arcade/scenes and the `as CSSProperties` casts in fleets/FleetCard.tsx, people/FleetChip.tsx, design/DesignScreen.tsx and arcade/ArcadeApp.tsx. The non-null assertions the index checks needed are left unmarked, as builder.ts already had them: the guard names only `any` and `as`.

## What it costs to change later

Cheap: inline the casts back with a `// ts-allow:` each, or move the helper somewhere shared when the other arcade folders want it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) business/BusinessView.tsx and home/spreads/Game.tsx, in sibling slices, keep the same casts; whether s29 folds them onto this helper is not planned (author)
- (author) Whether the ratchet will also count non-null assertions is not written down (author)
