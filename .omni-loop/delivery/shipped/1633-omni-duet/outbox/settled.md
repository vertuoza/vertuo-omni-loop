# Settled outbox items — PRD 1633

Append-only. Each entry below is one outbox item a human answered: the question exactly as it
was raised, the answer exactly as it was given, who approved it, when, through which channel,
and the verdict. Nothing here is ever rewritten — see `.omni-loop/delivery/README.md`.

<!-- omni-outbox-settled: s1-01-score-tables-list-the-fourth-game -->

## s1-01-score-tables-list-the-fourth-game — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s1-01-score-tables-list-the-fourth-game
prd: 1633
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Two tests of the arcade's score tables listed exactly three games, so adding the fourth game broke them, and the plan did not give this slice the files they live in. Should this slice fix them?

## The decision, in plain words

Yes: both tests now expect the fourth game's score table beside the other three. Only the expected lists changed; no code that reads or saves scores changed.

## The intro, for fun

The plan counted every test that counts games. Two more were hiding behind the score board.

## The punchline, for fun

They counted to three, and now they count to four.

## The options, in plain words

A. A. Fix the two score-table tests in this slice, outside its territory, by adding the fourth game to their expected lists
B. B. Leave them red and add the files to a later slice's territory

## What I had to decide

Keep A: the two score-table tests expect OMNI DUET's table, as they expect every game of the registry. B would leave the full test run red on the feature branch until another slice fixed them.

## What I did meanwhile

Built as A: apps/galaxy/src/data/scores.test.ts and apps/galaxy/src/data/arcade.test.ts expect a `duet` table, read and unreadable alike.

## What it costs to change later

A constant: two expected lists in two test files. Undoing it is reverting those lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's shared-ground note said every test that counts games belongs to s1, but listed neither file in s1's territory (author).

```

<!-- /omni-outbox-settled: s1-01-score-tables-list-the-fourth-game -->

<!-- omni-outbox-settled: s2-01-duet-listed-among-the-tall-scenes -->

## s2-01-duet-listed-among-the-tall-scenes — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s2
- Wave: 2

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s2-01-duet-listed-among-the-tall-scenes
prd: 1633
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

On a phone held upright, the arcade lays a screen out tall only when it is on one shared list, and the plan did not give this slice the file that holds it. Should this slice add the new game to that list?

## The decision, in plain words

Yes: one line adds the new game's screen to the shared list, so a phone held upright draws the game on its full tall screen, as the plan asks. Nothing else in that file changed.

## The intro, for fun

Every screen in the arcade has to sign one guest book before a phone will show it standing up.

## The punchline, for fun

The new game signed it, in its own handwriting, one line long.

## The options, in plain words

A. Add the new game to the shared list of tall screens, outside this slice's files
B. Leave the list alone until a later slice is given its file, with the test run red meanwhile

## What I had to decide

Keep A: the game's screen is on the shared list of tall screens, as every other game's is. B would leave the full test run red on the feature branch and draw the game sideways inside a phone held upright, against the plan's done-when.

## What I did meanwhile

Built as A: apps/galaxy/src/arcade/grid.ts imports the duet scene group beside the others, so its TALL_SCENES joins the list gridFor reads.

## What it costs to change later

A constant: one import and one entry in a list. Undoing it is reverting those two lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s2 names scenes/common.ts and scenes/index* for the new scene name, but not grid.ts, which grid.test.ts requires for every scene name (author).

```

<!-- /omni-outbox-settled: s2-01-duet-listed-among-the-tall-scenes -->

<!-- omni-outbox-settled: s3-01-last-life-ends-on-a-plain-line -->

## s3-01-last-life-ends-on-a-plain-line — agreed

- Verdict: agreed
- Approved by: martl-vertuoza
- Approved at: 2026-10-11T22:21:03Z
- Channel: feature pull request #1636
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1636#issuecomment-6114534999
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: P-PRODUCT-54
- Raised: 2026-10-11
- Slice: s3
- Wave: 3
- Stays here: an interim state between slices 3 and 4 of one PRD; slice 4 replaces it with the full game over screen and the score send, so nothing lasting about the product is stated.

### The answer, as it was given

```text
A. End the run on a plain GAME OVER line with the score, A to play again, B to the room, and leave the save to slice 4
```

### The item, as it was raised

```text
---
id: s3-01-last-life-ends-on-a-plain-line
prd: 1633
slice: s3
rank: high
bears-on: P-PRODUCT-54
raised: 2026-10-11
wave: 3
---

## The question, in plain words

This part of the game had to say what happens when the last life is lost, but the full game over screen and saving the score belong to the next part. What should the game do in between?

## The decision, in plain words

The game ends on a plain GAME OVER line with the score, A to play again and B to go back to the room. The score is not saved yet: the next part adds the full screen and the save.

## The intro, for fun

Three lives, one ending, and the ending was booked for next week.

## The punchline, for fun

So the game says goodbye politely and promises a proper farewell soon.

## The options, in plain words

A. End the run on a plain GAME OVER line with the score, A to play again, B to the room, and leave the save to slice 4
B. Restart chapter I with three lives after the last hit, with no game over at all until slice 4
C. Stay on the ready screen with no lives left until slice 4

## What I had to decide

Keep A: the last life lost moves the run to its over phase, which shows GAME OVER and the score, A plays again from chapter I with three lives and score 0, and B goes back to the room. Slice 4 replaces the line with the full game over screen and sends the score reached once, on the move into over.

## What I did meanwhile

Built as A: duet/run.ts adds the `over` phase (the last hit moves there, nothing moves, A gives a new run, B leaves); scenes/duet.tsx shows GAME OVER, the score and the two hints; scenes/duet.test.ts and duet/run.test.ts pin it.

## What it costs to change later

A constant: the over phase stays, and slice 4 adds the send on entering it and widens its screen. Undoing it is a few lines in run.ts and duet.tsx.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives the last life lost and the game over screen to slice 4, but says nothing of what slice 3 does when a third hit lands (author).
- Until slice 4 merges, B on a ready screen after a life lost and B on the game over line both go back to the room without saving the score; P-PRODUCT-54 holds only once slice 4 is in (author).

```

<!-- /omni-outbox-settled: s3-01-last-life-ends-on-a-plain-line -->

<!-- omni-outbox-settled: s4-01-quitting-shows-the-game-over -->

## s4-01-quitting-shows-the-game-over — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-01-quitting-shows-the-game-over
prd: 1633
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 4
---

## The question, in plain words

The controls say that quitting from the pause, or pressing B on a ready screen after a life lost, goes back to the game room, but the stories say the player sees their score saved whichever way they leave. Where should these two ways out land?

## The decision, in plain words

Both now end the game on the game over screen, which shows the score being saved, then the best or the failure with a retry; B from there goes back to the game room. The pause screen labels its quit key END GAME, and so does the ready screen once play has started.

## The intro, for fun

Two doors out of the game, and the plan drew them opening straight onto the corridor.

## The punchline, for fun

We put a little lobby in between, where the score signs the guest book.

## The options, in plain words

A. A. Both ways out end on the game over screen, which shows the save; B from there goes to the room
B. B. Both go straight to the game room, the score still sent once but its save not shown

## What I had to decide

Keep A: quitting from the pause and B on a later ready screen both move the run to its game over, which sends the score once and shows its save, as losing the last life does. One more press of B reaches the room. B would go straight to the room while the score is still sent, so the player never sees whether it was saved.

## What I did meanwhile

Built as A: apps/galaxy/src/arcade/duet/run.ts moves the run into over on SELECT on the pause and on B on a ready screen once started; scenes/duet.tsx shows the game over with the send line and labels both keys END GAME; scenes/duet.test.ts and duet/run.test.ts pin each route and the single send.

## What it costs to change later

A constant: one branch in the scene's press handling would send the score and leave for the room instead. Undoing it is a few lines in duet.live.ts and duet.tsx.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's controls table says SELECT on the pause quits to the room and B goes back to the room, while user story 6 and acceptance criterion 7 say the player sees the save on every route; the spec does not say which wins.

```

<!-- /omni-outbox-settled: s4-01-quitting-shows-the-game-over -->

<!-- omni-outbox-settled: s4-02-endless-waves-from-chapter-four-rows -->

## s4-02-endless-waves-from-chapter-four-rows — adopted

- Verdict: adopted
- Approved by: nobody
- Approved at: 2026-10-11
- Basis: adopted-when-raised — a medium item is adopted the moment it is raised — nobody approves it, and it stands unless someone later objects
- Closed: yes — adopted when it was raised; nothing to rework unless someone objects
- Rank: medium
- Bears on: none
- Raised: 2026-10-11
- Slice: s4
- Wave: 4

### The answer, as it was given

```text
Adopted the moment it was raised — nobody approved it, and it stands unless someone objects.
```

### The item, as it was raised

```text
---
id: s4-02-endless-waves-from-chapter-four-rows
prd: 1633
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 4
---

## The question, in plain words

The spec says the endless waves come from one fixed seed, at the last chapter's speed or above, rising slowly and never ending, but not what they are made of or how fast they may get. What should they be?

## The decision, in plain words

Each endless wave is one to three rows taken from the last chapter's own rows, drawn from the fixed seed. The speed starts just above the last chapter's fastest, rises a little every five waves and stops rising after about 150 waves, so every wave stays passable however long a run lasts.

## The intro, for fun

Endless mode needed an endless supply of trouble, and the last chapter had a full pantry.

## The punchline, for fun

So the storm keeps cooking from the same recipes, just a little faster each round.

## The options, in plain words

A. A. One to three of the last chapter's rows a wave, speed 120 rising one every five waves up to 150
B. B. The same rows, with the speed rising without a ceiling
C. C. New rows written for endless mode alone

## What I had to decide

Keep A: endless waves are built from chapter IV's rows, one to three a wave, starting at speed 120, one more every five waves, and no faster than 150; the check proves the first 200 passable from any angle. B would keep speeding up without a ceiling, which no check can prove passable forever.

## What I did meanwhile

Built as A: apps/galaxy/src/arcade/duet/waves.ts adds ENDLESS_SEED, the ENDLESS constants block, the row pool and endlessWave; duet/waves.test.ts runs waveProblems on the first 200 endless waves, chained and each from any angle.

## What it costs to change later

A constant: the numbers sit in one block and the rows in one list, so a follow-up tunes them without touching the engine; the passability test keeps any tuning honest.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec does not say whether endless speed keeps rising forever or stops at a ceiling; a ceiling of 150 was chosen by eye so the check can hold.

```

<!-- /omni-outbox-settled: s4-02-endless-waves-from-chapter-four-rows -->

<!-- omni-outbox-settled: s1-02-law-proof-files-widened-for-the-fourth-game -->

## s1-02-law-proof-files-widened-for-the-fourth-game — agreed

- Verdict: agreed
- Approved by: martl-vertuoza
- Approved at: 2026-10-11T23:25:43Z
- Channel: feature pull request #1636
- Channel URL: https://github.com/vertuoza/vertuo-omni-loop/pull/1636#issuecomment-6115086623
- Basis: stated — the answer is settled as "agreed" because a human said so, not because a comparison read it
- Closed: yes — the answer matches what was built, so there is nothing to rework
- Rank: high
- Bears on: BR-PRODUCT-77
- Raised: 2026-10-11
- Slice: s1
- Wave: 1

### The answer, as it was given

```text
A. Keep the widened tests: the law proofs are unchanged, only the pinned game list and unlocks grew to four
```

### The item, as it was raised

```text
---
id: s1-02-law-proof-files-widened-for-the-fourth-game
prd: 1633
slice: s1
rank: high
bears-on: BR-PRODUCT-77
raised: 2026-10-11
wave: 1
---

## The question, in plain words

Two test files that also prove product laws had to change so they know about the fourth game. Is it fine that they now expect OMNI DUET, while the laws' own tests stay exactly as they were?

## The decision, in plain words

The files now expect four games and the LV 4 unlock, as the spec asks; the tests that prove the two laws were not touched.

## The intro, for fun

Two rulebooks counted to three, and the arcade just learned to count to four.

## The punchline, for fun

The laws kept their lines; only the head count changed.

## The options, in plain words

A. Keep the widened tests: the law proofs are unchanged, only the pinned game list and unlocks grew to four
B. Move the duet assertions out of the law-proof files into new test files, leaving those files untouched
C. Amend the laws themselves to name the fourth game

## What I had to decide

Keep A. game/rulebook.test.ts pins xp.unlocks, which the spec makes { invaders: 1, platformer: 2, kart: 3, duet: 4 }; apps/galaxy/src/arcade/games/room.test.ts pins the game list and cabinet count, which the spec makes four, and gains the duet cabinet and window tests (spec, Test seams, 'The room'). The proofs of BR-PRODUCT-77 and N-PRODUCT-10 in those files are unchanged.

## What I did meanwhile

Built as A in s1 and s2: the pinned unlocks gained duet: 4, the pinned game list and count gained OMNI DUET, and new tests cover the duet cabinet and the wide grid's window. The law tests in both files are byte for byte as on main.

## What it costs to change later

A constant: reverting is dropping duet from two pinned lists, and the game would then not exist.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The coverage guard marks any change to a file that holds a law's proof as a change to that law, and only a high item may account for it, so a person confirms the laws still hold (author).

```

<!-- /omni-outbox-settled: s1-02-law-proof-files-widened-for-the-fourth-game -->
