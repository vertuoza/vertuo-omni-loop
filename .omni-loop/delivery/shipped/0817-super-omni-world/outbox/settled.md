# Settled outbox items — PRD 817

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-jump-pose-and-pause-exit -->

## s1-01-jump-pose-and-pause-exit — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1
- Stays here: The jump pose is purely visual, and the pause-exit mapping is a local, one-line control choice that no principle depends on, so it stays in the ledger.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-jump-pose-and-pause-exit
prd: 817
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Which picture shows the hero in mid-air, and may B leave the paused game in the arcade as well as SELECT?

## The decision, in plain words

The hero jumps with a fist raised, the cheering pose we already draw, and on the pause screen both B and SELECT go back to the game room.

## The intro, for fun

Every hero needs a jumping face, and ours already knew how to cheer.

## The punchline, for fun

So he cheers his way over every pipe, and B still gets you home.

## The options, in plain words

A. Jump with the cheer pose, and let B or SELECT leave the pause, as built.
B. Jump with the second run stride instead, and let only SELECT leave the pause, exactly as the spec words it.
C. Draw a new jumping pose in the design system in a later slice.

## What I had to decide

The jump frame of the hero, and which buttons leave the pause screen in the arcade.

## What I did meanwhile

The jump frame is the existing cheer pose, and B or SELECT on the pause leaves for the game room; each is one line to change.

## What it costs to change later

One constant in the art and one line in the pause handling, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec names the run pose for the frames but no pose for the jump (author)
- the spec names SELECT for leaving the pause; the dock uses B for going back (author)

```

<!-- /omni-outbox-settled: s1-01-jump-pose-and-pause-exit -->

<!-- omni-outbox-settled: s1-02-view-rules-test-outside-territory -->

## s1-02-view-rules-test-outside-territory — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s1
- Wave: 1
- Stays here: A one-off territory choice about a single expected value in one test; nothing lasting about the product or the build to keep.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-02-view-rules-test-outside-territory
prd: 817
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Moving the new game's unlock level into the rules changed what one more test outside this slice's area expects. Should this slice update it?

## The decision, in plain words

Yes: the test that checks the rules the galaxy view carries now expects the new game at level 2, the only change made outside the slice's area.

## The intro, for fun

One new line in the rulebook, and a test next door noticed at once.

## The punchline, for fun

We told it the news instead of hiding it.

## The options, in plain words

A. Update the view's rules check in this slice, as built.
B. Hand the update to another slice, leaving the whole suite red until it lands.

## What I had to decide

Whether the rules check of the galaxy view may change in this slice, outside its listed area.

## What I did meanwhile

It expects the new game's unlock level beside Invaders'; nothing else in that area moved.

## What it costs to change later

One expected value in one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the plan lists the galaxy package's XP test but not its view test, which reads the same rulebook (author)

```

<!-- /omni-outbox-settled: s1-02-view-rules-test-outside-territory -->

<!-- omni-outbox-settled: s2-01-ready-screen-after-a-life-lost -->

## s2-01-ready-screen-after-a-life-lost — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 2
- Became: BR-PRODUCT-56, P-PRODUCT-53

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-ready-screen-after-a-life-lost
prd: 817
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

When the hero loses a life and the stage starts again, should play resume at once, or wait for the player to press start?

## The decision, in plain words

The stage waits on its ready screen, showing the stage and the lives left, until the player presses start, the same screen a new game opens on.

## The intro, for fun

Falling into a pit deserves a moment of quiet reflection.

## The punchline, for fun

So the game waits politely until you are ready to try again.

## The options, in plain words

A. Wait on the ready screen after each life lost, as built.
B. Restart play at once, with no screen between the life lost and the new try.
C. Show a short pause of about two seconds, then restart play by itself.

## What I had to decide

Whether losing a life puts the stage back on its ready screen or restarts play at once.

## What I did meanwhile

A life lost shows the ready screen with the lives left; start resumes play from the stage's start, the score kept.

## What it costs to change later

One line in the game's screen handling; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec names the ready screen for the start of a game only, and says a life lost restarts the stage, not which screen shows (author)

```

<!-- /omni-outbox-settled: s2-01-ready-screen-after-a-life-lost -->

<!-- omni-outbox-settled: s2-02-stage-clock-told-by-the-game -->

## s2-02-stage-clock-told-by-the-game — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s2
- Wave: 2
- Became: ADR-0063

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-02-stage-clock-told-by-the-game
prd: 817
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Who keeps the stage's 300-second clock: the game engine drawing the stage, or the scoring rules?

## The decision, in plain words

The game engine tells the rules each second of play, and the rules count the clock down, cost a life at zero and pay the time bonus; the engine starts the stage again once 300 seconds have gone.

## The intro, for fun

Somebody has to watch the clock while the hero admires the scenery.

## The punchline, for fun

The engine ticks, the rules count, and nobody argues about the time.

## The options, in plain words

A. The engine reports each second and the rules count down, as built.
B. The engine keeps the whole clock and reports only when it runs out, the rules keeping the seconds left for the bonus from it.
C. The screen around the engine keeps the clock with its own timer, and the engine reports nothing about time.

## What I had to decide

How the clock reaches the rules, beside the five things the spec says the engine reports.

## What I did meanwhile

One more report, one per second of play, joins the five; a paused game sends none, so the clock stops with it.

## What it costs to change later

A small change to the engine's side and the rules; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec lists five reports from the engine and puts the timer in the rules, without saying how time reaches them (author)

```

<!-- /omni-outbox-settled: s2-02-stage-clock-told-by-the-game -->

<!-- omni-outbox-settled: s4-01-dock-platformer-score-not-sent -->

## s4-01-dock-platformer-score-not-sent — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s4
- Wave: 2
- Stays here: A temporary sequencing choice between slices, cheap to change later; no lasting guarantee or build pattern to record.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-dock-platformer-score-not-sent
prd: 817
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Should the corner game box save the new platform game's score, the way it saves the space game's?

## The decision, in plain words

Not yet: the platform game has no score of its own until later slices add one, so the corner box plays it without saving anything, and the space game saves as before.

## The intro, for fun

The new game can be played in the corner already, but it cannot count yet.

## The punchline, for fun

Nothing to save means nothing lost, for now.

## The options, in plain words

A. Play it in the dock without saving the score for now, and wire the saving in a small follow-up once the game keeps a score, as built.
B. Widen the third slice's area to the dock so it saves the score from both places at once.
C. Never save scores from the corner box for this game: only the full arcade saves them.

## What I had to decide

Whether the play dock sends SUPER OMNI WORLD's score in this slice, when the score itself is only built by the next two slices, and the slice that adds score saving does not cover the dock.

## What I did meanwhile

The dock's score sending now takes the game's key, the space game passes its own, and the platform game in the dock sends nothing. Wiring it is one call at game over in the dock's platformer file.

## What it costs to change later

One call and one status line in the dock's platformer screen, once the game keeps a score; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan gives score saving to the third slice, whose area does not include the dock, and the dock's slice only makes the sending take the game's key
- (author) the game's score and game-over screen do not exist yet when this slice is built

```

<!-- /omni-outbox-settled: s4-01-dock-platformer-score-not-sent -->

<!-- omni-outbox-settled: s4-02-dock-select-stays-with-the-page -->

## s4-02-dock-select-stays-with-the-page — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s4
- Wave: 2
- Became: BR-PRODUCT-57

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-dock-select-stays-with-the-page
prd: 817
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

In the corner game box, should the select button fold the box from the platform game's pause screen, as the spec says?

## The decision, in plain words

The corner box still ignores the select keys, which are also the page's own keys for moving between links; Escape folds the box instead, and B goes back to the game list.

## The intro, for fun

Two buttons wanted the same key, and the page had it first.

## The punchline, for fun

Escape still gets you out, and your links still work.

## The options, in plain words

A. Keep SELECT for the page, fold with Escape and go back with B, as built.
B. Hear Shift as SELECT in the dock and fold on it, leaving Tab to the page.
C. Hear both Tab and Shift in the dock while a game is open.

## What I had to decide

Whether SELECT folds the dock from SUPER OMNI WORLD's pause screen. SELECT is Tab or Shift on the keyboard, and the dock has always left those to the page so a reader can still move between links.

## What I did meanwhile

The dock's pure steps fold on SELECT from the pause, but the dock's keyboard never sends it, so in practice Escape folds and B goes back to the picker. Hearing SELECT is one line in the dock's key handling.

## What it costs to change later

One line in the dock's keyboard handling; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the spec says SELECT folds the dock from the pause, while the dock built earlier deliberately ignores SELECT so Tab keeps moving focus on the page

```

<!-- /omni-outbox-settled: s4-02-dock-select-stays-with-the-page -->

<!-- omni-outbox-settled: s3-01-stage-clear-goes-on -->

## s3-01-stage-clear-goes-on — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 3
- Became: BR-PRODUCT-58, P-PRODUCT-54

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-01-stage-clear-goes-on
prd: 817
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

When a stage is cleared, which buttons go on to the next stage, and can the player leave the game from there?

## The decision, in plain words

A or START goes on to the next stage's ready screen with the score and lives kept, and B does nothing there, so a game can only end at the game over or at the world's end, where its score is saved.

## The intro, for fun

A flag reached, a whole new stage ahead, and one button between them.

## The punchline, for fun

B stays quiet on the way, so no score slips out the back door.

## The options, in plain words

A. A or START goes on, B does nothing, as built.
B. A or START goes on, and B quits to the room without saving the score.
C. A or START goes on, and B quits to the room after saving the score reached so far.

## What I had to decide

Whether the stage clear screen only goes forward, or also lets the player quit the game.

## What I did meanwhile

The stage clear screen shows A for the next stage; the new stage appears once START is pressed on its ready screen.

## What it costs to change later

One line in the game's press rules and one hint on the screen: a different answer is a small change, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the game over and WORLD CLEAR as the only ends, and says nothing of the buttons on a stage clear (author).

```

<!-- /omni-outbox-settled: s3-01-stage-clear-goes-on -->

<!-- omni-outbox-settled: s3-02-blob-colours-per-stage -->

## s3-02-blob-colours-per-stage — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-09-30
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-09-30
- Slice: s3
- Wave: 3
- Stays here: Purely a look choice (colours per stage), a one-line table change; entries never state colour, so it stays in the ledger.

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s3-02-blob-colours-per-stage
prd: 817
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 3
---

## The question, in plain words

Which colours do the enemies wear in each of the three stages?

## The decision, in plain words

The first stage keeps the enemy's own pink, the underground stage dresses them in the cyan of one kind of wound, and the castle in the red of another, so each stage looks different.

## The intro, for fun

Three stages, three wardrobes, and one very stubborn blob.

## The punchline, for fun

It kept its pink for the meadow and changed only for the dark places.

## The options, in plain words

A. Pink in the first stage, cyan underground, red in the castle, as built.
B. Give the first stage a wound colour too, so every stage is tinted.
C. Pick other wound colours for the underground and the castle.

## What I had to decide

Whether the first stage's enemies keep their own colour or also take a wound's colour.

## What I did meanwhile

Grass stage enemies are pink as before; underground ones are cyan; castle ones are red.

## What it costs to change later

One small table of colours in the game's drawing code: a different pick is a one-line change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the enemies are tinted per stage but names no colour for any stage (author).

```

<!-- /omni-outbox-settled: s3-02-blob-colours-per-stage -->
