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

<!-- omni-outbox-settled: s2-01-xp-read-in-the-workspace-played -->

## s2-01-xp-read-in-the-workspace-played — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-xp-read-in-the-workspace-played
prd: 160
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

The design says the arcade reads a player's XP along with the galaxy, but it was written before a person could belong to several company spaces. Whose XP should a person in two spaces see, and should a failed XP read hide the galaxy too?

## The decision, in plain words

I show the XP earned in the space the arcade already plays for that person, the one they joined first. I read it on its own, so when it fails the galaxy still shows and the game room says the XP is out of reach.

## The intro, for fun

The recipe said to fetch the XP with the groceries, then the town opened a second market.

## The punchline, for fun

So we shop at the market we always go to, and a missing loaf no longer cancels dinner.

## The options, in plain words

A. Show the XP of the space the arcade plays, the one joined first, read on its own so a failure never hides the galaxy.
B. Read the XP together with the galaxy, so any failed read shows the whole galaxy as out of reach.
C. Add up a person's XP across every space they belong to.

## What I had to decide

The spec (The arcade, Reading) says the page reads the player's `player_xp` row by lower-cased login "along with the galaxy, as the signed-in member". PRD 100 landed `arcadeFor()` in `apps/galaxy/src/data/arcade.ts`: it plays the workspace the member joined first (`memberWorkspace()` in `apps/galaxy/src/data/workspace.ts`) and loads the galaxy, the fleets, the player and the crew in one `Promise.all`, so one failed read makes the whole page out of reach. The spec names neither which workspace's XP a member of several sees, nor whether a failed XP read takes the galaxy with it; it only says an unreadable XP shows no level. A drift between the spec and the code #100 landed.

## What I did meanwhile

`apps/galaxy/src/data/xp.ts` (`loadXp`, `readXp`) reads `player_xp` with `workspace_id` set to the workspace `arcadeFor()` plays and `github_login` set to the player row's login (or the session's linked one), lower-cased, after the other reads. A failed read is logged and becomes `'unreadable'`: the menu and the room say XP out of reach and show no level, and the galaxy, the fleets and the crew stay as read. `apps/galaxy/src/data/arcade.test.ts` pins both: a member of Acme and Vertuoza reads Acme's row only, and XP out of reach keeps the galaxy.

## What it costs to change later

Low. Reading XP inside the galaxy's `Promise.all` is a two-line change in `arcadeFor()`; reading another workspace's row is one filter, once switching workspaces exists.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a member of two workspaces should see each workspace's XP on its own, as `player_xp` stores it, or one total across them, which would need a new read.

```

<!-- /omni-outbox-settled: s2-01-xp-read-in-the-workspace-played -->

<!-- omni-outbox-settled: s2-02-games-new-tag-until-the-room-is-seen -->

## s2-02-games-new-tag-until-the-room-is-seen — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-games-new-tag-until-the-room-is-seen
prd: 160
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

The approved drawing of the menu shows a NEW label beside the games entry, but nothing says when it should go away. Should it stay for good, or disappear once the player has looked inside the game room?

## The decision, in plain words

The NEW label shows until the player first opens the game room on a device, and then it is gone on that device.

## The intro, for fun

Every shop window loves a NEW sticker, until it has been there so long it is the oldest thing in the shop.

## The punchline, for fun

Ours peels itself off the moment you walk in.

## The options, in plain words

A. Show NEW until the game room is opened once on a device.
B. Show NEW for good, exactly as drawn.
C. Show no NEW label at all.

## What I had to decide

Section 1 of `before-after.html` draws a red NEW tag beside GAMES on the menu. The spec and the plan never mention it. The menu's existing `fresh` flag (on PLAY, MY HERO and CHANGE FLEET in `scenes/menu.tsx`) is not drawn anywhere, so there was no rule to follow for when a tag goes away.

## What I did meanwhile

`menuItems({ newGames })` in `apps/galaxy/src/arcade/scenes/menu.tsx` puts `tag: 'NEW'` on GAMES, drawn beside its label. `ArcadeApp.tsx` reads `omni-loop:games-seen` from the browser's storage on the first render and writes it when the `games` scene opens. With storage refused, no tag shows, so it can never stick. `menu.test.ts` covers the tag on GAMES only, and its absence once seen.

## What it costs to change later

Low. One key in browser storage and one flag in `menuItems()`: dropping the tag, or keeping it for good, is a one-line change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether NEW should come back when a later PRD adds a game to the room; a key that names the newest game would do it.

```

<!-- /omni-outbox-settled: s2-02-games-new-tag-until-the-room-is-seen -->

<!-- omni-outbox-settled: s2-03-game-room-needs-the-galaxy -->

## s2-03-game-room-needs-the-galaxy — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-03-game-room-needs-the-galaxy
prd: 160
slice: s2
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When the galaxy cannot be loaded, the other screens on the menu refuse to open and say why. Should the game room refuse the same way, or open anyway with every cabinet locked?

## The decision, in plain words

The game room opens only when the galaxy is loaded, like the other screens. When it is not, choosing the games entry says the galaxy is out of reach.

## The intro, for fun

When the power is out, every ride at the fair closes, but the arcade tent wondered if it could stay open by candlelight.

## The punchline, for fun

It closes with the rest, and the sign on the door says why.

## The options, in plain words

A. Refuse the game room without the galaxy, as the other screens do.
B. Open the game room anyway, with XP OUT OF REACH and every cabinet locked.

## What I had to decide

The spec says GAMES shows to everyone signed in and a visitor sees every cabinet locked; it says nothing of the room when the galaxy itself is out of reach. `doorOf()` in `apps/galaxy/src/arcade/scenes/menu.tsx` refuses every galaxy screen without a galaxy, with the page's problem or "SIGN IN TO SEE THE GALAXY". When the galaxy is out of reach, `arcadeFor()` has read no XP either, so an open room could only show XP OUT OF REACH.

## What I did meanwhile

GAMES goes through the same `doorOf()` as the galaxy's screens: without a galaxy it buzzes with the page's problem, as `menu.test.ts` pins. The menu still lists GAMES, with the hint "XP out of reach".

## What it costs to change later

Low. Opening the room without the galaxy is one line in `doorOf()`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a room that can only say XP out of reach is worth opening when everything else on the menu is closed.

```

<!-- /omni-outbox-settled: s2-03-game-room-needs-the-galaxy -->
