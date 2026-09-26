---
id: s1-02-fake-postgrest-moved-by-workspaces
prd: 160
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The design says the XP writer is tested against the pretend database kept in one test file, but the Workspaces work had already moved that pretend database into a shared helper. Is it right to follow where it lives now?

## The decision, in plain words

I followed the code: the XP writer's tests use the shared pretend database, the same one the other game commands are tested against.

## The intro, for fun

The map said the treasure was buried under the old oak, but the Workspaces crew had replanted the oak.

## The punchline, for fun

We dug where the tree stands today, and the treasure was right there.

## The options, in plain words

A. Follow the code: test the XP writer against the shared pretend database where it lives now.
B. Move the pretend database back into the one test file the design names.

## What I had to decide

The spec's test seams say `game/cli/xp.mjs` is tested "against the fake PostgREST of `game/sources/supabase.test.mjs`". PRD 100 (#101) moved that fake into `game/test/fake-supabase.mjs` (`fakeSupabase`, `serveFake`), which `game/sources/supabase.test.mjs` and `game/cli/scripts.test.mjs` now import. A drift between the spec and the code #100 landed.

## What I did meanwhile

`game/cli/xp.test.mjs` imports `fakeSupabase` and `serveFake` from `game/test/fake-supabase.mjs`: the first for the run with the REST client injected, the second for the script run as a process.

## What it costs to change later

None: the fake is the same one, only its file moved. Nothing to undo.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the design meant that one test file in particular, or simply the pretend database the game's tests share, which #100 moved after the spec was written.
