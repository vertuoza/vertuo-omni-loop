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
