# Settled outbox items — PRD 160

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-xp-writer-upsert -->

## s1-01-xp-writer-upsert — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
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

```

<!-- /omni-outbox-settled: s1-01-xp-writer-upsert -->

<!-- omni-outbox-settled: s1-02-fake-postgrest-moved-by-workspaces -->

## s1-02-fake-postgrest-moved-by-workspaces — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
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

```

<!-- /omni-outbox-settled: s1-02-fake-postgrest-moved-by-workspaces -->

<!-- omni-outbox-settled: s1-03-no-level-stored-as-zero -->

## s1-03-no-level-stored-as-zero — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-03-no-level-stored-as-zero
prd: 160
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

Someone who has not earned a point yet has no level. Should their saved record say level 0, or leave the level empty?

## The decision, in plain words

I save level 0 for no level, so every saved record always holds a number. The game room still to be built must read 0 as no level and show none.

## The intro, for fun

Zero or nothing? Philosophers have argued about it for centuries; databases just want a number.

## The punchline, for fun

We gave them a zero, and asked the screens to keep it to themselves.

## The options, in plain words

A. Save 0 for no level, and have every screen read 0 as no level.
B. Leave the level empty for no level, so an empty value, not a number, means no level.

## What I had to decide

The spec says 0 XP is no level and stores `level smallint`, but not how "no level" is stored. `player_xp` holds a row for every login the ledger names (D14), so a login with no counted credit needs some level value.

## What I did meanwhile

`levelFor()` returns 0 below the first point, and `player_xp.level` is `not null check (level >= 0)`: such a login is stored as `xp 0, level 0, unlocked {}`, by `pnpm game:xp` and by the demo seed. s2's badge and game room must treat 0 as no level.

## What it costs to change later

Low while nothing reads it: making the column nullable is a one-statement follow-up migration, plus one line in `levelFor()`. Once s2 reads 0, each screen that shows a level changes too.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Nothing yet enforces that a screen never shows LV 0: that lands with s2.

```

<!-- /omni-outbox-settled: s1-03-no-level-stored-as-zero -->
