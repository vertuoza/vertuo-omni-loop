---
id: s1-01-xp-writer-upsert
prd: 160
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

Saving everyone's XP in one go needed a way to update records that already exist, which the game's shared database helper did not have. May that helper and its stand-in for tests gain it, although this piece of work was not planned to touch them?

## The decision, in plain words

I added the missing update-or-insert ability to the shared database helper and taught its stand-in for tests to behave the same way, so the XP writer saves every player in one request.

## The intro, for fun

The XP writer showed up with a full cart and found the shop only sold brand-new shelves.

## The punchline, for fun

So it built a shelf that also fits the old ones, and left a note at the till.

## The options, in plain words

A. Keep the update-or-insert ability in the shared database helper, where every other database call of the game already lives.
B. Move the write into the XP command itself, with its own request code, and put the shared helper back as it was.
C. Keep it, and widen this piece of work's planned scope after the fact to name the helper and its stand-in for tests.

## What I had to decide

The slice's territory (`game/rulebook.mjs`, `game/experience`, `game/cli/xp`, `game/workflow.test.mjs`, `.github/workflows/game.yml`, `package.json`, `supabase/…`, the seed) does not include `game/sources/supabase.mjs` or `game/test/fake-supabase.mjs`. The spec asks `pnpm game:xp` to upsert every row in one request, with the REST client injected and tested against the fake PostgREST. The client only had `select` and `insertNew` (ignore-duplicates), and the fake only knew ignore-duplicates, so a second poll could not have updated a login's row through them.

## What I did meanwhile

Added `upsert(table, rows, onConflict)` to `supabaseRest` in `game/sources/supabase.mjs` (one POST, `Prefer: resolution=merge-duplicates,return=minimal`), with two tests beside it in `game/sources/supabase.test.mjs`, and taught `game/test/fake-supabase.mjs` merge-duplicates and `return=minimal`. Every existing caller and test is unchanged. Checked against a local Supabase's real PostgREST: one request inserted the missing rows and updated the stored ones, and a second run changed nothing.

## What it costs to change later

Low. The method is additive. Removing it means moving the write into `game/cli/xp.mjs` with its own fetch: one file and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan left the shared database helper out of this slice on purpose, or only because nobody knew it could not update a stored row.
