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

<!-- omni-outbox-settled: s3-01-score-table-as-ready-screen -->

## s3-01-score-table-as-ready-screen — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-score-table-as-ready-screen
prd: 160
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

The design shows a screen with the score table, what each alien is worth. Where should players see it, and does a game then start by itself?

## The decision, in plain words

Choosing Entropy Invaders opens the game on the score table for three seconds, then the aliens start moving. Pressing A starts at once.

## The intro, for fun

Every arcade cabinet has a card saying what each alien is worth, and almost nobody reads it.

## The punchline, for fun

So ours shows it for three seconds, right before the aliens start marching.

## The options, in plain words

A. Show the score table for three seconds before each game, A skipping it, the option built.
B. Wait on the score table until the player presses A.
C. Start at once, and show the score table only on the pause screen.

## What I had to decide

The spec says an attract screen shows the score table and that A on the unlocked cabinet starts a game. It does not say whether the table is a screen of its own, how long it shows, or whether the game waits for a press.

## What I did meanwhile

`newGame()` in `apps/galaxy/src/arcade/games/invaders.ts` opens on a ready phase (`READY_SECONDS`, 3 s) and the text layer shows the score table over the formation, read from the view's `rules.woundClose`. `press()` with A or START skips it, and B goes back to the room.

## What it costs to change later

Low: one constant for the time, and one phase of the engine to keep or drop.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person pictured the table as a looping attract mode on the cabinet in the room instead.

```

<!-- /omni-outbox-settled: s3-01-score-table-as-ready-screen -->

<!-- omni-outbox-settled: s3-02-game-feel-numbers -->

## s3-02-game-feel-numbers — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-game-feel-numbers
prd: 160
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

How fast should the game be, how often do the aliens fire back, and what do the back button and the end of a game do?

## The decision, in plain words

I picked the game's speeds and difficulty myself and kept them together so they are easy to tune. The back button during play pauses instead of leaving, and the game over waits for a button before going back to the room.

## The intro, for fun

Every arcade game hides a dial that decides how mean the aliens are.

## The punchline, for fun

Ours is set to friendly but firm, and the dial sits in one place in case you disagree.

## The options, in plain words

A. Keep these numbers until a person has played a game on a laptop and on a phone, the option built.
B. Make the game harder from the first wave: a faster march and more bombs.
C. Go back to the room by itself a few seconds after the game over.

## What I had to decide

The spec sets the two fields, the shields, three lives, faster waves and the controls. It gives no speeds, no fire rate, no protection after a hit, nothing on shields between waves, and does not say what B does during play or whether the game over returns to the room by itself.

## What I did meanwhile

The numbers sit in `FIELDS` and the constants at the top of `apps/galaxy/src/arcade/games/invaders.ts`: a march step every 0.6 s with the whole formation, down to a tenth of that as it thins out, 15% faster each wave (never under 0.2 s at full strength); a bomb every 0.4 to 1.5 s, at most three in flight wide and two tall; 1.5 s of blinking after a hit; the shields rebuilt each wave. The game over shows its score for 1 s, then A, B or START returns to the room. B during play pauses, as START does.

## What it costs to change later

Low: constants in one file.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No one has played it on a phone yet: the spec's manual check (one game on a laptop, one on a phone) is still to do.

```

<!-- /omni-outbox-settled: s3-02-game-feel-numbers -->

<!-- omni-outbox-settled: s3-03-a-game-keeps-its-field -->

## s3-03-a-game-keeps-its-field — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-03-a-game-keeps-its-field
prd: 160
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

If a player turns their phone in the middle of a game, the screen changes shape. Should the game restart on the new screen, or carry on as it was?

## The decision, in plain words

The game carries on as it was: it keeps the field it started on, shown smaller with bars around it, until it ends. The next game uses the new screen.

## The intro, for fun

Turning the phone mid-game is the pocket version of tilting the arcade cabinet.

## The punchline, for fun

Nothing is lost: the aliens stay right where they were, just framed a little smaller.

## The options, in plain words

A. Keep the game's field and letterbox it, the option built.
B. Pause the game and ask the player to turn the phone back.
C. Restart the game on the new field.

## What I had to decide

The wide field has ten columns and four shields, the tall one six and three. The spec gives both but not what happens to a game when the phone turns from one to the other; the arcade's rule elsewhere is that turning the phone never changes the game's state.

## What I did meanwhile

`ArcadeApp.tsx` draws the invaders scene on the grid its game was laid out for (`GAME_GRID[hud.layout]`), so a game begun upright is letterboxed when the phone turns sideways, and the other way round. A new game takes the grid of the moment.

## What it costs to change later

Low: one line picks the grid.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a letterboxed field is still comfortable to play on a small phone held sideways.

```

<!-- /omni-outbox-settled: s3-03-a-game-keeps-its-field -->

<!-- omni-outbox-settled: s3-04-rows-follow-the-close-values -->

## s3-04-rows-follow-the-close-values — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s3
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-04-rows-follow-the-close-values
prd: 160
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

Each row of aliens is one kind of Entropy, the kind that pays most on top. If someone later changes what each kind pays, should the rows change order?

## The decision, in plain words

Yes: the rows are sorted by what each kind pays, highest on top, so the top row always pays most. Today's values give exactly the order in the design.

## The intro, for fun

In every arcade, the aliens at the top of the screen are the ones worth the most.

## The punchline, for fun

Ours keep that promise even if the rulebook reshuffles the prices.

## The options, in plain words

A. Sort the rows by what each kind pays, highest on top, the option built.
B. Keep the design's row order whatever the values become.

## What I had to decide

The spec lists the rows top to bottom (beacon 25, fault line 20, unconfirmed ground 15, zone under fire 10, transmission 5) and the person asked that the top row pay most. It does not say which wins when a rule change reorders the values.

## What I did meanwhile

`rowKinds()` in `apps/galaxy/src/arcade/games/invaders.ts` sorts the five kinds by the view's `woundClose`, highest first, a tie kept in the spec's order; the score table reads the same order. `games/invaders.test.ts` checks today's order and a reordered one.

## What it costs to change later

Low: one sort to swap for the fixed list.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the colours of the rows matter more to the person than which row pays most.

```

<!-- /omni-outbox-settled: s3-04-rows-follow-the-close-values -->

<!-- omni-outbox-settled: s4-01-levels-shows-the-first-five-levels -->

## s4-01-levels-shows-the-first-five-levels — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s4
- Wave: 3

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-levels-shows-the-first-five-levels
prd: 160
slice: s4
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

The design says How to play shows how many XP each level needs, but not how much of that list. Levels run up to 99, far more than a Game Boy screen can hold: which ones should the page show?

## The decision, in plain words

The page shows the XP needed for the first five levels and says how high levels go, beside what each kind of point is worth and the level each game opens at.

## The intro, for fun

A staircase with ninety-nine steps is lovely, until you have to draw every step on a Game Boy.

## The punchline, for fun

So we drew the first five and hung a sign saying how high it goes.

## The options, in plain words

A. Show the XP for the first five levels, and say how high levels go.
B. Show every level up to the top one, over as many pages as it takes.
C. Show the rule as a sentence instead of a list of levels.

## What I had to decide

The spec (The arcade, How to play) and the plan's s4 done-when ask for a LEVELS section with "the weighted credits, the curve's first levels and each game's unlock level, all read from the rules", its own page on the tall grid and laid out on the wide one. Neither says how many of the curve's levels to show, how a weight of 0 reads, or how a third section fits the wide page beside EARN and ENTROPY. The cap is 99, so the whole curve cannot fit the tall grid's 320×288 page.

## What I did meanwhile

`BriefingOverlay` in `apps/galaxy/src/arcade/scenes/menu.tsx` gains a `levels` section, a third entry in `BRIEFING_PAGES` (`scenes/menu.ts`): its own page on the tall grid, across both columns under EARN and ENTROPY on the wide one. XP PER POINT lists the five weights as `×n` (a weight of 0 reads NOT COUNTED); XP TO REACH lists LV 1 to LV 5 (`CURVE_SHOWN`, fewer under a lower cap) through `xpForLevel()`; UNLOCKS lists each game in `xp.unlocks`, lowest level first, by its registry title; a note says UP TO LV 99. Every number comes from `view.rules.xp`, which `buildGalaxy()` now fills with the rulebook's `xp` block. To fit, the wide page's gaps are a few pixels tighter. `menu.test.ts` changes the rules and sees the new values.

## What it costs to change later

Low. Showing more or fewer levels is one constant, and each wording is one line. Nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether players would rather read the rule itself (25 × n × (n − 1) XP) than the first five levels.
- (author) Whether ENTROPY CLEARED, EXPEDITION BONUS and CLOSER BONUS are the names players know: the closer bonus was not on How to play before.

```

<!-- /omni-outbox-settled: s4-01-levels-shows-the-first-five-levels -->

<!-- omni-outbox-settled: s5-01-scores-leave-with-the-player -->

## s5-01-scores-leave-with-the-player — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-01-scores-leave-with-the-player
prd: 160
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

A player's best scores are stored against their player record. When someone leaves a company space and their player record goes with them, what happens to their scores?

## The decision, in plain words

Their scores go with their player record, as the record already goes when they leave. A departed player no longer holds a line in the crew's table, and the weekly backup still has their scores for three months.

## The intro, for fun

Every high score table has a legend who left years ago.

## The punchline, for fun

Ours clears their line when they go, so nobody chases a ghost.

## The options, in plain words

A. Scores leave with the player record: the option built.
B. Keep a departed player's scores on the table, under the name they had.
C. Refuse to remove a member who holds a score until someone clears it.

## What I had to decide

The spec's table gives arcade_scores the key (workspace_id, user_id, game) pointing at players, and says scores cannot be rebuilt, so the weekly backup keeps them. It does not say what a removed player's scores become. PRD 100 made a player row go when its membership goes (players references workspace_members on delete cascade).

## What I did meanwhile

`supabase/migrations/20260926180000_arcade_scores.sql` references `players (workspace_id, user_id) on delete cascade`: removing a member removes their player row, then their scores. Without the cascade, removing a member who holds a score would be refused by the foreign key.

## What it costs to change later

Medium: another answer is a migration that changes the foreign key; the scores of anyone removed before it come back only from the weekly backup, kept 90 days.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the crew wants a departed player's best to stay on the cabinet.

```

<!-- /omni-outbox-settled: s5-01-scores-leave-with-the-player -->

<!-- omni-outbox-settled: s5-02-backup-test-outside-the-slice -->

## s5-02-backup-test-outside-the-slice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-02-backup-test-outside-the-slice
prd: 160
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

Keeping the crew's scores in the weekly backup broke an older test of the backup command, which this piece of work was not planned to touch. May it change there?

## The decision, in plain words

I updated that older test so it expects the scores file among the backup's files, and checks the file holds only the chosen company space's scores.

## The intro, for fun

The backup bag got a new pocket, and the old packing list only knew five.

## The punchline, for fun

The list now says six, and checks the new pocket holds nobody else's things.

## The options, in plain words

A. Update the older backup test to expect the scores file: the option built.
B. Write the scores in a backup step of their own, so the older test stays as it was.

## What I had to decide

The plan's territory for s5 names game/cli/export.mjs and game/workflow.test.mjs. The test that runs the game scripts as processes, game/cli/scripts.test.mjs, pins the export to exactly five files, so writing arcade_scores.jsonl fails it.

## What I did meanwhile

`game/cli/scripts.test.mjs` › game:export now expects six files, arcade_scores.jsonl among them, with a score in each of two workspaces and only the named one's written. The export's tables come from `backupFiles()` in `game/cli/export.mjs`, which now runs its command only as a script (the same isMain guard as game/cli/xp.mjs), so `game/workflow.test.mjs` imports it and pins arcade_scores in and player_xp out against the fake PostgREST.

## What it costs to change later

Low: one test's expected list of files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan left that test out of the slice's territory on purpose.

```

<!-- /omni-outbox-settled: s5-02-backup-test-outside-the-slice -->

<!-- omni-outbox-settled: s5-03-game-over-keys -->

## s5-03-game-over-keys — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-03-game-over-keys
prd: 160
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

When a game ends, the score is now saved, and a save that fails can be tried once more. Which buttons do what on that end screen, and what does it say while the score is being saved?

## The decision, in plain words

A tries a failed save once more and the other button goes back to the game room, as A does once the score is saved or the second try has failed too. The screen says the score is saving, then shows a new best, the player's best so far, or that the score was not saved.

## The intro, for fun

The end screen used to have one job: send you back to the game room.

## The punchline, for fun

Now it also posts your score to the crew, and gets one second try when the post office is shut.

## The options, in plain words

A. A tries a failed save once more, the other button goes back to the room, and the screen says saving, new best, your best, or not saved: the option built.
B. Try a failed save once more by itself a moment later, and keep A for going back to the room.
C. Show only what the spec names, a new best or a score not saved, and nothing while saving or when the score is not a best.

## What I had to decide

The spec (Entropy Invaders, Lives and game over) says game over sends the score once through submit_score(), shows NEW BEST when it is one, and on a failed send shows SCORE NOT SAVED with A retrying once. s3 left A, B and START all going back to the room once the score has shown for OVER_SECONDS (item s3-02-game-feel-numbers). The spec does not say what B and START do while a retry is offered, what shows while the score is on its way, what shows when a saved score is not a best, or whether a tie or a first game of 0 is a NEW BEST.

## What I did meanwhile

`overPress()` in `apps/galaxy/src/arcade/scenes/invaders-score.ts`: once the score has shown for OVER_SECONDS, A retries a send that failed while its one retry is left (`SEND_TRIES` = 2); every other press goes to the engine's `press()` unchanged, so B and START go back to the room, and A too once the score is saved, still sending, or its retry spent. The game over shows SAVING SCORE… while sending; NEW BEST (blinking, still under reduced motion) when the stored best is the score and beats the player's best before it, none counting as 0, so a tie or a first game of 0 is not one; YOUR BEST n otherwise; and SCORE NOT SAVED with [A] RETRY [B] GAME ROOM, then [A] GAME ROOM once the retry has failed. `ArcadeApp.tsx` sends the score when the canvas loop first sees the game over, once per game, 0 included; a game left from the pause sends nothing.

## What it costs to change later

Low: one pure function and the text layer's lines; no stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No one has played a failed save on a phone: it was checked in the demo, in a browser whose guest was removed from storage mid-game.

```

<!-- /omni-outbox-settled: s5-03-game-over-keys -->

<!-- omni-outbox-settled: s5-04-scores-read-on-their-own -->

## s5-04-scores-read-on-their-own — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-04-scores-read-on-their-own
prd: 160
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

The crew's high scores are read from the database along with the galaxy. What should the game room show when that read fails, who gets them read at all, and what does the demo's table hold?

## The decision, in plain words

The scores are read on their own, only for players who linked GitHub; when that fails, the galaxy and the level still show, the cabinet says the scores are out of reach, and the game still plays. The demo's table holds only the guest's own best.

## The intro, for fun

The scoreboard lives in a back room, and sometimes its door sticks.

## The punchline, for fun

When it does, the arcade stays open and the cabinet admits it cannot see the board.

## The options, in plain words

A. Read the scores on their own for players, say they are out of reach when that fails, and keep only the guest's best in the demo: the option built.
B. Read the scores together with the galaxy, so a failed read shows the whole galaxy as out of reach.
C. Fill the demo's table with made-up crew scores around the guest's.

## What I had to decide

The spec (The arcade, Reading) says the page reads the game's top five from arcade_scores, with the players' names and heroes, along with the galaxy, as the signed-in member, and the Account gains submitScore() and scores(). It does not say what a failed read shows, whether a visitor's page reads them (every cabinet is locked to a visitor), how NEW BEST knows a player's best before the game when they are not in the top five, or what the demo's table holds beside the guest.

## What I did meanwhile

`readScores()` in `apps/galaxy/src/data/scores.ts`, called by `arcadeFor()` beside `readXp()` only when the member has a GitHub login, reads per registry game the top five (best first, the earlier of two equal scores first, names, heroes and fleets embedded from players) and the player's own best. A failed read is logged and becomes 'unreadable': the lit cabinet says SCORES OUT OF REACH and A still plays; the galaxy and the XP are untouched, as for XP (item s2-01-xp-read-in-the-workspace-played). `app/page.tsx` passes an empty table to everyone else, so the Supabase arcade never reads scores in the browser at start. After a game, `ArcadeApp.tsx` merges the returned best into the table, then reads it again through `Account.scores()`. The demo and the artifact ask the demo account's `scores()` on the first render: the guest's own best only, kept in browser storage.

## What it costs to change later

Low: a condition in `arcadeFor()`, one line on the cabinet, and the demo account.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the demo should show made-up crew scores beside the guest's, so its table looks like the approved design's.

```

<!-- /omni-outbox-settled: s5-04-scores-read-on-their-own -->

<!-- omni-outbox-settled: s5-05-hi-without-a-name-upright -->

## s5-05-hi-without-a-name-upright — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s5
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s5-05-hi-without-a-name-upright
prd: 160
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

The approved design puts the crew's best score and its holder's name in the middle of the game's top line, but a phone held upright has no room for both beside the wave and the pause hint the game already shows. What gives way?

## The decision, in plain words

On a phone held upright, the crew's best shows without the holder's name, and everything else keeps its place. On a computer and on a phone held sideways, it shows with the name in the middle, as designed, and the pause hint moves beside the score.

## The intro, for fun

The top line of a phone screen is a very small shelf.

## The punchline, for fun

The name stepped down, so the score, the best, the wave and the pause all stay on it.

## The options, in plain words

A. Show the crew's best without the name on a phone held upright: the option built.
B. Show the name and drop the pause hint on a phone held upright.
C. Show the name and drop the wave on a phone held upright, as the design draws it.

## What I had to decide

The approved design (before-after, section 4) draws HI · DIME 12 480 in the middle of the score line on both grids; its tall drawing has neither the wave nor a pause hint, which s3 added (WAVE at 96 px, [START] PAUSE at 146 px, both at the middle of the wide grid's line or near it). 320 px holds SCORE, a HI up to 9 999 999, WAVE, the pause hint and three lives only without the name.

## What I did meanwhile

`InvadersOverlay` in `apps/galaxy/src/arcade/scenes/invaders.tsx` labels the HI `HI · <name>` on the wide grid and `HI` on the tall one. `invaders.css` centres it on the wide grid and moves `.inv-foot` (the pause hint) to 112 px, beside the score; on the tall grid it lays out SCORE at 10 px, HI at 66, WAVE at 144, the pause hint at 186 and the lives 8 px from the right. HI is the top line of the crew's table as read; none shows before anyone has a score, or when the table is out of reach.

## What it costs to change later

Low: a label and a few positions in one stylesheet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether s3's wave and pause hint on the upright phone matter more than the holder's name the design draws there.

```

<!-- /omni-outbox-settled: s5-05-hi-without-a-name-upright -->

<!-- omni-outbox-settled: s6-01-level-memory-when-storage-refused -->

## s6-01-level-memory-when-storage-refused — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s6
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-01-level-memory-when-storage-refused
prd: 160
slice: s6
rank: medium
bears-on: none
raised: 2026-09-26
wave: 5
---

## The question, in plain words

The level last celebrated is kept in the browser. When the browser refuses to keep anything, as a private or embedded page may, should the level-up still play?

## The decision, in plain words

It plays once each time the page is opened, and not again until the page is reloaded. The level is remembered per GitHub name written in lower case, the same way the XP is saved.

## The intro, for fun

A browser that forgets everything is a goldfish at a party: every lap round the bowl is the first.

## The punchline, for fun

So it gets the cake once per visit, and nobody sings twice in the same room.

## The options, in plain words

A. Play it once each time the page opens when the browser keeps nothing, the option built.
B. Never play it when the browser keeps nothing, as the NEW label on the games entry already does.
C. Keep the level celebrated with the player's saved record instead, so every device agrees.

## What I had to decide

The spec keeps the level celebrated in browser storage and says losing it only replays a fanfare. It does not say what to do when storage cannot be read at all, which the single-file demo page may meet, nor how the login in the storage key is written.

## What I did meanwhile

`createSeen()` in `apps/galaxy/src/arcade/levelup.ts` reads and writes `omni-loop:level-seen:<login>` inside try/catch, the login lower-cased as `player_xp` stores it, and also remembers the level in the page: storage that refuses replays the level-up once per page load, never at every arrival at the menu. The NEW tag on GAMES (s2-02) takes the other side: no storage, no tag.

## What it costs to change later

Low: one fallback in one function. Keeping the level in the database instead would need a migration, and is not what this built.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person wants the demo page to replay the level-up on every visit when its browser keeps nothing.

```

<!-- /omni-outbox-settled: s6-01-level-memory-when-storage-refused -->

<!-- omni-outbox-settled: s6-02-levels-climbed-between-visits -->

## s6-02-levels-climbed-between-visits — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s6
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-02-levels-climbed-between-visits
prd: 160
slice: s6
rank: medium
bears-on: none
raised: 2026-09-26
wave: 5
---

## The question, in plain words

A player can climb several levels between two visits, for example from no level to level 3. Should the level-up screen then say a new game opened, when the game opened at a level they climbed through rather than the one they reached?

## The decision, in plain words

Yes: the screen names a game when any level climbed since this device last celebrated opened it, and the player's saved record holds that game as unlocked. So the demo guest, at level 3, sees Entropy Invaders unlocked.

## The intro, for fun

Three floors up in one lift ride, and nobody mentioned the arcade on the first floor.

## The punchline, for fun

So the lift now points it out, even though you never pressed that button.

## The options, in plain words

A. Name a game opened by any level climbed since the last celebration on this device, the option built.
B. Name a game only when the exact level reached opened it, so a player who jumps past it is never told.
C. Name every game the player holds that this device never celebrated, whatever the level.

## What I had to decide

The plan says NEW GAME UNLOCKED shows only when that level opened a game, and the approved design says crossing an unlock level adds the new game. Neither says what happens when a player climbs past an unlock level between two visits, which is the demo guest's case and any returning player's.

## What I did meanwhile

`levelUpFor()` in `apps/galaxy/src/arcade/levelup.ts` names the first registry game whose unlock level (the rulebook's `xp.unlocks`) lies above the level this device last celebrated and at or below the level reached, and which the player's `player_xp.unlocked` holds. On a new device the first level-up names it once more, as the design's replayed fanfare does. Tested in `levelup.test.ts`.

## What it costs to change later

Low: one condition in one pure function, and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person reads "that level" as the level reached, or as every level passed on the way.

```

<!-- /omni-outbox-settled: s6-02-levels-climbed-between-visits -->

<!-- omni-outbox-settled: s6-03-level-up-words-and-keys -->

## s6-03-level-up-words-and-keys — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s6
- Wave: 5

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s6-03-level-up-words-and-keys
prd: 160
slice: s6
rank: medium
bears-on: none
raised: 2026-09-26
wave: 5
---

## The question, in plain words

The approved design shows the level-up for the first point only. What should it say at higher levels and when no game opened, and does it move on by itself?

## The decision, in plain words

Above level 1 it opens on the XP earned instead of the first point, and with no new game it offers one button to continue to the menu. It waits for a button and never moves on alone, since pressing one is what marks the level as seen.

## The intro, for fun

The party was drawn for the first point, and the later birthdays were left to imagination.

## The punchline, for fun

Later birthdays get the same cake, with the candle count written on top.

## The options, in plain words

A. Open on the XP earned above level 1, offer continue when no game opened, and wait for a button, the option built.
B. Keep the first point's line at every level, and move on to the menu after a few seconds, saving the level then.
C. Open on what the next level needs instead of the XP earned, and wait for a button.

## What I had to decide

Section 3 of the approved before/after page draws LEVEL UP! LV 1 with FIRST POINT EARNED, NEW GAME UNLOCKED, A · PLAY NOW and B · LATER. It does not draw a later level, a level that opened no game or the tall grid, nor say whether the screen hands over on a timer as the welcome back does.

## What I did meanwhile

`eyebrowOf()` in `apps/galaxy/src/arcade/levelup.ts` says FIRST POINT EARNED at LV 1 and `<xp> XP EARNED` above it. `LevelUpOverlay` shows [A] CONTINUE when no game opened, and A, START and B then all go on to the menu. The scene has no timer. On the tall grid the same pieces stack: the line, LEVEL UP!, the hero at 2x with the level beside it, the XP bar, NEW GAME UNLOCKED.

## What it costs to change later

Low: two strings and a hint in the text layer, or one timer.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the person pictured other words above level 1, or a hand-over to the menu on its own.

```

<!-- /omni-outbox-settled: s6-03-level-up-words-and-keys -->

<!-- omni-outbox-settled: s7-01-stale-docs-outside-the-slice -->

## s7-01-stale-docs-outside-the-slice — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-26
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-26
- Slice: s7
- Wave: 6

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s7-01-stale-docs-outside-the-slice
prd: 160
slice: s7
rank: medium
bears-on: none
raised: 2026-09-26
wave: 6
---

## The question, in plain words

Two pages outside this piece of work still describe the game as it was before XP: the repository's front page lists the backup without the high scores and leaves out the new XP command, and the team's architecture notes say the game writes only the ledger, a weekly comment and a backup. Should this piece of work have corrected them?

## The decision, in plain words

I left both pages as they are, since this piece of work may only change the two guides it was given, and I name the stale lines here so a person can fix them in one small follow-up.

## The intro, for fun

Two guides got a fresh coat of paint, while the neighbours' signs still point down the old road.

## The punchline, for fun

We left them a map with the new road circled in red.

## The options, in plain words

A. Leave both pages as they are, and fix them in a small follow-up change.
B. Fix both pages in this piece of work, although they are outside what it may change.
C. Fix only the front page here, and leave the architecture notes, which a person wrote, to a person.

## What I had to decide

The slice's territory is `game/README.md` and `apps/galaxy/README.md`. PRD 160 also made two lines outside it untrue or incomplete. `README.md` › Run it by hand lists `game:banner`, `game:project`, `game:score` and `game:export` but not `pnpm game:xp`, and describes `game:export` as "its row, ledger, sectors, fleets and players as JSONL", while it now also writes `arcade_scores.jsonl`. `.omni-loop/knowledge/playbook/architecture.md` › Boundaries, a section marked by-human, says the game's "only outputs are the ledger in Supabase, one weekly comment and a backup (game/README.md)", while `pnpm game:xp` now also writes `player_xp` at every poll.

## What I did meanwhile

Changed nothing outside the territory. `game/README.md` now names the game's outputs with `player_xp`, lists `pnpm game:xp`, and lists `arcade_scores` in the backup, so both stale lines have a correct source to follow.

## What it costs to change later

None: two one-line doc edits, in any later pull request. The playbook line is in a by-human section, so a person edits it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The PRD's scope names `game/README.md` and `apps/galaxy/README.md` as the docs it changes and says nothing of the root README or the playbook, so whether they belong to this feature or to a follow-up is not settled.

```

<!-- /omni-outbox-settled: s7-01-stale-docs-outside-the-slice -->
