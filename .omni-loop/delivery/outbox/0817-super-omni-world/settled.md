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
