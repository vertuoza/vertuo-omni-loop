---
id: s8-04-themes-in-one-colour-list
prd: 1559
slice: s8
rank: medium
bears-on: none
raised: 2026-10-11
wave: 4
---

## The question, in plain words

The design file format holds one list of colours, while our app has three themes and the sample has two. Is writing each other theme as its own named colours, which the format's checker then calls unused, the way we want?

## The decision, in plain words

I wrote the other themes as colours named with light and dark in front, and accepted the checker's unused-colour warnings: it still accepts both files.

## The intro, for fun

Three themes, one colour list, and a checker that counts every spare paint pot.

## The punchline, for fun

Forty pots unused, all of them for the night shift.

## The options, in plain words

A. A. Keep the other themes as prefixed colours and accept the unused-colour warnings.
B. B. Keep only the default theme in the file, and name where the others live in its prose.
C. C. Add a component entry per theme so the checker sees every colour used.

## What I had to decide

Google's DESIGN.md has a single `colors` map. omni-loop's Omni theme is the unprefixed semantic set, Light and Dark are `light-*` and `dark-*`; the fixture's light is unprefixed and dark is `dark-*`. `npx @google/design.md lint` (v0.4.0) accepts both, 0 errors, with 40 and 53 `orphaned-tokens` warnings: a token no `components` entry references, mostly the other theme and the primitives.

## What I did meanwhile

Both files keep their themes as prefixed tokens; the warnings are counted in dogfood.md.

## What it costs to change later

A constant: renaming tokens in two DESIGN.md files, and one line in init.md.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the format will gain themes of its own; its spec calls itself alpha (author).
