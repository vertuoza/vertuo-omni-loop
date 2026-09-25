---
id: s1-02-theme-colours-lowercase
prd: 100
slice: s1
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

Should a workspace's colours be accepted only in lowercase, as the fleets' colours are, or in any case?

## The decision, in plain words

Only lowercase six-digit colours are accepted, the same rule the fleet colours already follow. A browser's colour picker gives colours in that form.

## The intro, for fun

Is a colour written in capital letters shouting, or just very excited about purple?

## The punchline, for fun

The database decided it is shouting, and asked for its indoor voice.

## The options, in plain words

A. Lowercase only, like the fleet colours. This is what was built.
B. Any case, turned into lowercase when it is stored.
C. Any case, stored exactly as typed.

## What I had to decide

`valid_theme()` checks each value against `^#[0-9a-f]{6}$`, as `teams_color_hex` does. The spec writes `#rrggbb` but does not say whether `#A45CFF` passes. s6's zod schema must apply the same rule, since its `theme.test.ts` reads the token list from this migration.

## What I did meanwhile

Lowercase only. `supabase/checks/access.sql` pins it: `{"plasma": "#A45CFF"}` is refused.

## What it costs to change later

The regex in `valid_theme()` (a forward migration that redefines it) and the matching zod rule in s6. Themes already stored stay valid either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how PRD 3's settings page will let people type a colour, and so whether capitals will reach the database at all, is not known yet (author)
